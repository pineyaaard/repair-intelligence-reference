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

  const clientId = 'anonymousbrowserid00000000000010';
  const options = await jsonRequest(server, 'POST', '/api/catalog-options', {
    values: prefill.body.prefill.values,
    repairNodeId: 'front-brake-service',
    clientId
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

  const noReview = await jsonRequest(server, 'POST', '/api/confirm', {
    selectedOptionId: options.body.options[0].id,
    values: prefill.body.prefill.values,
    repairNodeId: 'front-brake-service',
    clientId,
    explicitConfirmation: true
  });
  assert.equal(noReview.status, 409);

  const wrongValues = { ...prefill.body.prefill.values, model: 'series-that-does-not-exist' };
  const wrongReview = await jsonRequest(server, 'POST', '/api/catalog-options', {
    values: wrongValues,
    repairNodeId: 'front-brake-service',
    clientId
  });
  const wrongVisibleSet = await jsonRequest(server, 'POST', '/api/confirm', {
    selectedOptionId: options.body.options[0].id,
    values: wrongValues,
    repairNodeId: 'front-brake-service',
    clientId,
    reviewToken: wrongReview.body.reviewToken,
    explicitConfirmation: true
  });
  assert.equal(wrongVisibleSet.status, 404);

  const unknownReview = await jsonRequest(server, 'POST', '/api/catalog-options', {
    values: prefill.body.prefill.values,
    repairNodeId: 'unknown',
    clientId
  });
  assert.equal(unknownReview.status, 400);
  assert.match(unknownReview.body.error, /supported repair job/);
  assert.equal(Object.hasOwn(unknownReview.body, 'reviewToken'), false);
  const unknownJob = await jsonRequest(server, 'POST', '/api/confirm', {
    selectedOptionId: options.body.options[0].id,
    values: prefill.body.prefill.values,
    repairNodeId: 'unknown',
    clientId,
    reviewToken: options.body.reviewToken,
    explicitConfirmation: true
  });
  assert.equal(unknownJob.status, 400);

  const confirmed = await jsonRequest(server, 'POST', '/api/confirm', {
    selectedOptionId: options.body.options[0].id,
    values: prefill.body.prefill.values,
    repairNodeId: 'front-brake-service',
    clientId,
    reviewToken: options.body.reviewToken,
    explicitConfirmation: true
  });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.confirmation.confirmationSource, 'explicit-user-selection');
  assert.equal(confirmed.body.path.parts.length, 3);

  const replay = await jsonRequest(server, 'POST', '/api/confirm', {
    selectedOptionId: options.body.options[0].id,
    values: prefill.body.prefill.values,
    repairNodeId: 'front-brake-service',
    clientId,
    reviewToken: options.body.reviewToken,
    explicitConfirmation: true
  });
  assert.equal(replay.status, 409);
});

test('a second supported repair job builds its own confirmed path', async (t) => {
  const server = await startServer();
  t.after(() => server.close());

  const values = { make: 'brand-a', model: 'series-1', year: 2017 };
  const clientId = 'anonymousbrowserid00000000000011';
  const options = await jsonRequest(server, 'POST', '/api/catalog-options', {
    values,
    repairNodeId: 'rear-brake-service',
    clientId
  });
  const rear = await jsonRequest(server, 'POST', '/api/confirm', {
    selectedOptionId: options.body.options[0].id,
    values,
    repairNodeId: 'rear-brake-service',
    clientId,
    reviewToken: options.body.reviewToken,
    explicitConfirmation: true
  });

  assert.equal(rear.status, 200);
  assert.equal(rear.body.path.node.id, 'rear-brake-service');
  assert.equal(rear.body.path.parts.length, 3);
  assert.deepEqual(rear.body.path.catalogProvenance, ['source-alpha', 'source-beta']);
});

test('review tokens expire and cannot confirm an old visible set', async (t) => {
  let clock = 1_000;
  const server = await startServer({ now: () => clock, reviewTokenSecret: 'unit-test-review-secret' });
  t.after(() => server.close());
  const values = { make: 'brand-a', model: 'series-1', year: 2017 };
  const clientId = 'anonymousbrowserid00000000000013';
  const options = await jsonRequest(server, 'POST', '/api/catalog-options', {
    values,
    repairNodeId: 'front-brake-service',
    clientId
  });
  clock += 5 * 60 * 1000 + 1;
  const response = await jsonRequest(server, 'POST', '/api/confirm', {
    selectedOptionId: options.body.options[0].id,
    values,
    repairNodeId: 'front-brake-service',
    clientId,
    reviewToken: options.body.reviewToken,
    explicitConfirmation: true
  });
  assert.equal(response.status, 409);
});

test('consumed review tokens are bounded fail-closed and pruned after their TTL', async (t) => {
  let clock = 2_000;
  const server = await startServer({
    now: () => clock,
    reviewTokenSecret: 'unit-test-bounded-review-secret',
    maxConsumedReviewTokens: 1
  });
  t.after(() => server.close());
  const values = { make: 'brand-a', model: 'series-1', year: 2017 };
  const clientId = 'anonymousbrowserid00000000000014';
  const review = async () => jsonRequest(server, 'POST', '/api/catalog-options', {
    values,
    repairNodeId: 'front-brake-service',
    clientId
  });
  const confirm = async (options) => jsonRequest(server, 'POST', '/api/confirm', {
    selectedOptionId: options.body.options[0].id,
    values,
    repairNodeId: 'front-brake-service',
    clientId,
    reviewToken: options.body.reviewToken,
    explicitConfirmation: true
  });

  const first = await review();
  const second = await review();
  assert.equal((await confirm(first)).status, 200);
  const atCapacity = await confirm(second);
  assert.equal(atCapacity.status, 503);
  assert.match(atCapacity.body.error, /capacity is temporarily full/);

  clock += 5 * 60 * 1000 + 1;
  const afterTtl = await review();
  assert.equal((await confirm(afterTtl)).status, 200);
});

test('catalog review rejects invalid numeric criteria instead of silently broadening', async (t) => {
  const server = await startServer();
  t.after(() => server.close());
  const response = await jsonRequest(server, 'POST', '/api/catalog-options', {
    values: { make: 'brand-a', model: 'series-1', year: null, engineLiters: '2,0' },
    repairNodeId: 'front-brake-service',
    clientId: 'anonymousbrowserid00000000000012'
  });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /engineLiters must be a valid value/);
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
            model: 'gpt-5.6-2026-07-01',
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
    text: 'potřebuji přední brzdy: brand-a series-1, rok 2017, nafta, objem dva litry, 190 koní, automat'
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.prefill.confirmationRequired, true);
  assert.equal(outboundPayload.store, false);
  assert.equal(outboundPayload.text.format.strict, true);
  assert.equal(response.body.prefill.aiEvidence.servedModel, 'gpt-5.6-2026-07-01');
  assert.equal(response.body.comparison.localFieldCount, 3);
  assert.equal(response.body.comparison.aiFieldCount, 7);
  assert.deepEqual(response.body.comparison.resolvedFields, [
    'engineLiters', 'fuel', 'powerHp', 'transmission'
  ]);
  assert.equal(response.body.comparison.repairJobResolved, true);
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
  assert.match(browserCode, /reviewToken: state\.reviewToken/);
  assert.match(browserCode, /Review changed/);
  assert.match(browserCode, /updateFieldValidity\(event\.target\)/);
  assert.match(browserCode, /path-status'\)\.textContent = 'Confirmed path'/);
});
