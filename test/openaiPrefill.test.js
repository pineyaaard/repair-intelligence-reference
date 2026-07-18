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
  assert.equal(payload.safety_identifier.length, 64);
  assert.equal(payload.safety_identifier.includes('anonymousbrowserid'), false);
  assert.equal(result.confirmationRequired, true);
  assert.equal(result.parser, 'openai-responses-structured-prefill');
});

test('raw Responses parser rejects the non-REST top-level output_text shortcut', async () => {
  await assert.rejects(
    requestOpenAIPrefill(prefillRequest({
      transport: async () => ({
        ok: true,
        async json() {
          return { output_text: JSON.stringify(structuredResult) };
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
