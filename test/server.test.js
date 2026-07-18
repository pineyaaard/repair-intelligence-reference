import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createDemoServer } from '../src/server.js';

async function startServer(options = {}) {
  const server = createDemoServer(options);
  server.listen(0, 'localhost');
  await once(server, 'listening');
  return server;
}

function jsonRequest(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = httpRequest(
      {
        hostname: 'localhost',
        port: server.address().port,
        method,
        path,
        headers: payload
          ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
          : undefined
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('browser API is fully functional without an OpenAI key', async (t) => {
  const server = await startServer({ openAIApiKey: '', safetyIdSalt: '' });
  t.after(() => server.close());

  const config = await jsonRequest(server, 'GET', '/api/config');
  assert.equal(config.status, 200);
  assert.equal(config.body.aiPrefillAvailable, false);
  assert.equal(config.body.dataMode, 'synthetic-only');

  const prefill = await jsonRequest(server, 'POST', '/api/prefill', {
    mode: 'local',
    text: 'brand-a series-1 2017 2.0 diesel 190 hp automatic; front brake service'
  });
  assert.equal(prefill.status, 200);
  assert.equal(prefill.body.prefill.values.model, 'series-1');
  assert.equal(prefill.body.prefill.confirmationRequired, true);

  const options = await jsonRequest(server, 'POST', '/api/catalog-options', {
    values: prefill.body.prefill.values
  });
  assert.equal(options.status, 200);
  assert.equal(options.body.options.length, 2);
  assert.deepEqual(options.body.options.map((option) => option.variant), ['P1', 'P2']);

  const blocked = await jsonRequest(server, 'POST', '/api/confirm', {
    selectedOptionId: options.body.options[0].id,
    values: prefill.body.prefill.values,
    explicitConfirmation: false
  });
  assert.equal(blocked.status, 409);

  const wrongVisibleSet = await jsonRequest(server, 'POST', '/api/confirm', {
    selectedOptionId: options.body.options[0].id,
    values: { ...prefill.body.prefill.values, model: 'series-that-does-not-exist' },
    repairNodeId: 'front-brake-service',
    explicitConfirmation: true
  });
  assert.equal(wrongVisibleSet.status, 404);

  const unknownJob = await jsonRequest(server, 'POST', '/api/confirm', {
    selectedOptionId: options.body.options[0].id,
    values: prefill.body.prefill.values,
    repairNodeId: 'unknown',
    explicitConfirmation: true
  });
  assert.equal(unknownJob.status, 400);

  const confirmed = await jsonRequest(server, 'POST', '/api/confirm', {
    selectedOptionId: options.body.options[0].id,
    values: prefill.body.prefill.values,
    repairNodeId: 'front-brake-service',
    explicitConfirmation: true
  });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.confirmation.confirmationSource, 'explicit-user-selection');
  assert.equal(confirmed.body.path.parts.length, 3);
});

test('issue report retains only a generic aggregate, not the optional note', async (t) => {
  const server = await startServer();
  t.after(() => server.close());
  const privateLookingNote = 'contact person@example.invalid about this screen';
  const response = await jsonRequest(server, 'POST', '/api/error-report', {
    stage: 'catalog-union',
    category: 'missing-option',
    note: privateLookingNote
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.noteDisposition, 'discarded-without-retention');
  assert.equal(JSON.stringify(response.body).includes(privateLookingNote), false);
  assert.equal(response.body.aggregate.route, '/demo/catalog-union');
  assert.equal(response.body.aggregate.automationEligible, false);
});

test('optional AI route is server-side and preserves the same human-gated prefill contract', async (t) => {
  let outboundPayload;
  const server = await startServer({
    openAIApiKey: 'test',
    safetyIdSalt: 'unit-test-safety-salt-0004',
    openAITransport: async (_url, options) => {
      outboundPayload = JSON.parse(options.body);
      return {
        ok: true,
        async json() {
          return {
            status: 'completed',
            output: [{
              type: 'message',
              status: 'completed',
              role: 'assistant',
              content: [{
                type: 'output_text',
                annotations: [],
                text: JSON.stringify({
                  values: {
                    make: 'brand-a', model: 'series-1', year: 2017, engineLiters: 2,
                    fuel: 'diesel', powerHp: 190, transmission: 'automatic'
                  },
                  repairJob: { id: 'front-brake-service', label: 'Front brake service' }
                })
              }]
            }]
          };
        }
      };
    }
  });
  t.after(() => server.close());

  const config = await jsonRequest(server, 'GET', '/api/config');
  assert.equal(config.body.aiPrefillAvailable, true);
  assert.equal(config.body.storeResponses, false);

  const response = await jsonRequest(server, 'POST', '/api/prefill', {
    mode: 'ai',
    clientId: 'anonymousbrowserid00000000000004',
    text: 'brand-a series-1 2017 2.0 diesel 190 hp automatic; front brake service'
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.prefill.confirmationRequired, true);
  assert.equal(outboundPayload.store, false);
  assert.equal(outboundPayload.text.format.strict, true);
});

test('browser assets expose the complete four-stage workflow without a browser-side API key', async () => {
  const [html, browserCode] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/app.js', import.meta.url), 'utf8')
  ]);
  for (const marker of ['Step 01', 'Step 02', 'Step 03', 'Step 04']) assert.match(html, new RegExp(marker));
  assert.match(html, /Prefill with GPT-5\.6/);
  assert.match(html, /id="path-status"/);
  assert.equal(browserCode.includes('OPENAI_API_KEY'), false);
  assert.match(browserCode, /explicitConfirmation: true/);
  assert.match(browserCode, /path-status'\)\.textContent = 'Confirmed path'/);
});
