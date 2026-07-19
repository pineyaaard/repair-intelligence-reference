import test from 'node:test';
import assert from 'node:assert/strict';
import { requestOpenAIPrefill, safetyIdentifier } from '../src/openaiPrefill.js';

const structuredResult = {
  values: {
    make: 'brand-a',
    model: 'series-1',
    year: 2017,
    engineLiters: 2,
    fuel: 'diesel',
    powerHp: 190,
    transmission: 'automatic'
  },
  repairJob: { id: 'front-brake-service', label: 'Front brake service' }
};

function rawResponsesBody(value = structuredResult) {
  return {
    model: 'gpt-5.6-2026-07-01',
    status: 'completed',
    output: [
      { type: 'reasoning', id: 'reasoning-test' },
      {
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: [
          { type: 'output_text', text: JSON.stringify(value), annotations: [] }
        ]
      }
    ]
  };
}

function prefillRequest(overrides = {}) {
  return {
    text: 'brand-a series-1 2017 2.0 diesel 190 hp automatic; front brake service',
    clientId: 'anonymousbrowserid00000000000001',
    apiKey: 'test',
    safetySalt: 'unit-test-salt-value-0001',
    ...overrides
  };
}

test('Responses request uses strict structured output, store false, and a hashed safety identifier', async () => {
  const calls = [];
  const transport = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return rawResponsesBody();
      }
    };
  };

  const result = await requestOpenAIPrefill(prefillRequest({ transport }));

  assert.equal(calls.length, 1);
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.model, 'gpt-5.6');
  assert.equal(payload.store, false);
  assert.equal(payload.text.format.type, 'json_schema');
  assert.equal(payload.text.format.strict, true);
  assert.equal(payload.text.format.schema.additionalProperties, false);
  assert.match(payload.instructions, /request in any language/);
  assert.match(payload.instructions, /rear-brake-service/);
  assert.deepEqual(payload.text.format.schema.properties.values.properties.fuel.enum, [
    'diesel', 'petrol', 'electric', 'hybrid', null
  ]);
  assert.deepEqual(payload.text.format.schema.properties.values.properties.transmission.enum, [
    'automatic', 'manual', null
  ]);
  assert.equal(payload.safety_identifier.length, 64);
  assert.equal(payload.safety_identifier.includes('anonymousbrowserid'), false);
  assert.equal(result.confirmationRequired, true);
  assert.equal(result.parser, 'openai-responses-structured-prefill');
  assert.equal(result.aiEvidence.servedModel, 'gpt-5.6-2026-07-01');
});

test('AI output is normalized and repair labels remain application-owned', async () => {
  const value = {
    values: {
      ...structuredResult.values,
      make: ' Brand-A ',
      model: ' SERIES-1 '
    },
    repairJob: { id: 'rear-brake-service', label: 'Untrusted label' }
  };
  const result = await requestOpenAIPrefill(prefillRequest({
    transport: async () => ({ ok: true, json: async () => rawResponsesBody(value) })
  }));

  assert.equal(result.values.make, 'brand-a');
  assert.equal(result.values.model, 'series-1');
  assert.equal(result.repairJob.id, 'rear-brake-service');
  assert.equal(result.repairJob.label, 'Rear brake service');
  assert.equal(result.fieldCoverage, 1);
});

test('noncanonical multilingual tokens fail closed before catalog search', async () => {
  for (const values of [
    { ...structuredResult.values, fuel: 'nafta' },
    { ...structuredResult.values, transmission: 'автомат' },
    { ...structuredResult.values, year: 2201 }
  ]) {
    await assert.rejects(
      requestOpenAIPrefill(prefillRequest({
        transport: async () => ({
          ok: true,
          json: async () => rawResponsesBody({ ...structuredResult, values })
        })
      })),
      /AI prefill returned.*invalid/
    );
  }
});

test('raw Responses parser rejects the non-REST top-level output_text shortcut', async () => {
  await assert.rejects(
    requestOpenAIPrefill(prefillRequest({
      transport: async () => ({
        ok: true,
        async json() {
          return { model: 'gpt-5.6-2026-07-01', output_text: JSON.stringify(structuredResult) };
        }
      })
    })),
    /invalid response envelope/
  );
});

test('raw Responses parser fails closed on malformed and ambiguous outputs', async () => {
  const malformedBodies = [
    { status: 'completed', output: {} },
    { status: 'incomplete', output: [] },
    { status: 'completed', output: [{ type: 'message', status: 'completed', role: 'assistant' }] },
    {
      status: 'completed',
      output: [{
        type: 'message', status: 'completed', role: 'assistant',
        content: [{ type: 'output_text', text: 7 }]
      }]
    },
    {
      status: 'completed',
      output: [
        rawResponsesBody().output[1],
        rawResponsesBody().output[1]
      ]
    },
    {
      status: 'completed',
      output: [{
        type: 'message', status: 'completed', role: 'assistant',
        content: [
          { type: 'output_text', text: JSON.stringify(structuredResult) },
          { type: 'output_text', text: JSON.stringify(structuredResult) }
        ]
      }]
    }
  ];

  for (const body of malformedBodies) {
    await assert.rejects(
      requestOpenAIPrefill(prefillRequest({
        transport: async () => ({ ok: true, json: async () => body })
      })),
      /AI prefill returned/
    );
  }
});

test('refusal and incomplete responses produce safe actionable errors', async () => {
  const refusal = rawResponsesBody();
  refusal.output[1].content = [{ type: 'refusal', refusal: 'No.' }];
  await assert.rejects(
    requestOpenAIPrefill(prefillRequest({
      transport: async () => ({ ok: true, json: async () => refusal })
    })),
    /declined this request/
  );

  await assert.rejects(
    requestOpenAIPrefill(prefillRequest({
      transport: async () => ({
        ok: true,
        json: async () => ({ model: 'gpt-5.6-2026-07-01', status: 'incomplete', output: [] })
      })
    })),
    /was incomplete/
  );
});

test('safety identifier is deterministic but does not expose the anonymous browser id', () => {
  const clientId = 'anonymousbrowserid00000000000002';
  const first = safetyIdentifier(clientId, 'unit-test-salt-value-0002');
  const second = safetyIdentifier(clientId, 'unit-test-salt-value-0002');
  assert.equal(first, second);
  assert.equal(first.includes(clientId), false);
});

test('sensitive input is rejected before the optional transport can run', async () => {
  let called = false;
  await assert.rejects(
    requestOpenAIPrefill({
      text: 'brand-a series-1; contact person@example.invalid',
      clientId: 'anonymousbrowserid00000000000003',
      apiKey: 'test',
      safetySalt: 'unit-test-salt-value-0003',
      transport: async () => {
        called = true;
      }
    }),
    /Remove vehicle identifiers/
  );
  assert.equal(called, false);
});
