#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { parseVehiclePrefill, confirmVehicleChoice } from './vehiclePrefill.js';
import { unionVehicleOptions } from './catalogUnion.js';
import { buildRepairPath } from './repairPath.js';
import { PrivacySafeErrorRollup } from './errorRollup.js';
import { assertSafeVehicleText, privacyLimits } from './privacy.js';
import { openAIConfig, requestOpenAIPrefill } from './openaiPrefill.js';

const here = dirname(fileURLToPath(import.meta.url));
const publicRoot = join(here, '..', 'public');
const BODY_LIMIT = 16 * 1024;

const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']]
]);

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function safeError(error) {
  const message = error instanceof Error ? error.message : 'The request could not be completed.';
  return message.slice(0, 180);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

function catalogCriteria(input = {}) {
  const allowed = ['make', 'model', 'year', 'engineLiters', 'fuel', 'powerHp', 'transmission'];
  return Object.fromEntries(
    allowed
      .filter((field) => input[field] !== undefined && input[field] !== null && input[field] !== '')
      .map((field) => [field, input[field]])
  );
}

function requiredCatalogCriteria(input = {}) {
  const criteria = catalogCriteria(input);
  const missing = ['make', 'model', 'year'].filter(
    (field) => criteria[field] === undefined || criteria[field] === null || criteria[field] === ''
  );
  if (missing.length > 0) {
    throw new Error(`Review the required fields before searching: ${missing.join(', ')}.`);
  }
  return criteria;
}

function securityHeaders(res) {
  res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
}

function aiSettings(options) {
  const apiKey = options.openAIApiKey ?? process.env.OPENAI_API_KEY ?? '';
  const safetySalt = options.safetyIdSalt ?? process.env.SAFETY_ID_SALT ?? '';
  return {
    apiKey,
    safetySalt,
    model: options.openAIModel ?? process.env.OPENAI_MODEL ?? openAIConfig.defaultModel,
    available: Boolean(apiKey && safetySalt.length >= 16)
  };
}

export function createDemoServer(options = {}) {
  const rollup = new PrivacySafeErrorRollup();
  const ai = aiSettings(options);

  return createServer(async (req, res) => {
    securityHeaders(res);
    const pathname = new URL(req.url ?? '/', 'http://local.invalid').pathname;

    try {
      if (req.method === 'GET' && staticFiles.has(pathname)) {
        const [filename, contentType] = staticFiles.get(pathname);
        const content = await readFile(join(publicRoot, filename));
        res.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' });
        res.end(content);
        return;
      }

      if (req.method === 'GET' && pathname === '/api/config') {
        json(res, 200, {
          aiPrefillAvailable: ai.available,
          model: ai.model,
          storeResponses: false,
          dataMode: 'synthetic-only',
          maxInputLength: privacyLimits.maxInputLength
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/prefill') {
        const body = await readJson(req);
        const text = assertSafeVehicleText(body.text);
        const prefill = body.mode === 'ai'
          ? await requestOpenAIPrefill({
              text,
              clientId: body.clientId,
              apiKey: ai.apiKey,
              safetySalt: ai.safetySalt,
              model: ai.model,
              transport: options.openAITransport
            })
          : parseVehiclePrefill(text);
        json(res, 200, { prefill });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/catalog-options') {
        const body = await readJson(req);
        const optionsList = unionVehicleOptions(requiredCatalogCriteria(body.values));
        json(res, 200, { options: optionsList });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/confirm') {
        const body = await readJson(req);
        if (body.explicitConfirmation !== true) {
          json(res, 409, { error: 'Explicit human confirmation is required.' });
          return;
        }
        const visibleOptions = unionVehicleOptions(requiredCatalogCriteria(body.values));
        const option = visibleOptions.find((item) => item.id === body.selectedOptionId);
        if (!option) {
          json(res, 404, { error: 'The selected synthetic option does not exist.' });
          return;
        }
        const confirmation = confirmVehicleChoice({ confirmationRequired: true }, option);
        if (body.repairNodeId !== 'front-brake-service') {
          throw new Error('Confirm a supported repair job before building the path.');
        }
        const repairNodeId = body.repairNodeId;
        const path = buildRepairPath(option, repairNodeId);
        json(res, 200, { confirmation, path });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/error-report') {
        const body = await readJson(req);
        const stages = new Set(['input', 'confirmation', 'catalog-union', 'repair-path']);
        const categories = new Set(['unexpected-result', 'missing-option', 'display-problem', 'other']);
        const stage = stages.has(body.stage) ? body.stage : 'input';
        const reportCategory = categories.has(body.category) ? body.category : 'other';
        const noteReceived = typeof body.note === 'string' && body.note.trim().length > 0;
        const aggregate = rollup.record({
          route: `/demo/${stage}`,
          status: 422,
          error: `User report category: ${reportCategory}`
        });
        json(res, 201, {
          receipt: aggregate.id,
          aggregate,
          noteDisposition: noteReceived ? 'discarded-without-retention' : 'not-provided'
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/error-rollups') {
        json(res, 200, { rollups: rollup.list() });
        return;
      }

      json(res, 404, { error: 'Not found.' });
    } catch (error) {
      json(res, 400, { error: safeError(error) });
    }
  });
}

const isEntryPoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntryPoint) {
  const port = Number(process.env.PORT || 4173);
  const server = createDemoServer();
  server.listen(port, 'localhost', () => {
    console.log(`Repair Intelligence Reference is ready on local port ${port}.`);
  });
}
