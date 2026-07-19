#!/usr/bin/env node
import { createServer } from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
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
const SUPPORTED_REPAIR_JOBS = new Set(['front-brake-service', 'rear-brake-service']);
const REVIEW_TOKEN_TTL_MS = 5 * 60 * 1000;
const MAX_CONSUMED_REVIEW_TOKENS = 10_000;
const REVIEW_FIELDS = ['make', 'model', 'year', 'engineLiters', 'fuel', 'powerHp', 'transmission'];

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
  const criteria = {};
  for (const field of ['make', 'model']) {
    if (input[field] === undefined || input[field] === null || input[field] === '') continue;
    if (typeof input[field] !== 'string') throw new Error(`${field} must be text.`);
    const value = input[field].trim().toLowerCase().replace(/\s+/g, ' ');
    if (value.length === 0 || value.length > 80) throw new Error(`${field} must be between 1 and 80 characters.`);
    criteria[field] = value;
  }
  const numeric = {
    year: { min: 1886, max: 2100, integer: true },
    engineLiters: { min: 0.1, max: 20, integer: false },
    powerHp: { min: 1, max: 5000, integer: true }
  };
  for (const [field, rule] of Object.entries(numeric)) {
    if (input[field] === undefined || input[field] === null || input[field] === '') continue;
    const value = input[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < rule.min || value > rule.max || (rule.integer && !Number.isInteger(value))) {
      throw new Error(`${field} must be a valid value between ${rule.min} and ${rule.max}.`);
    }
    criteria[field] = value;
  }
  const canonical = {
    fuel: new Set(['diesel', 'petrol', 'electric', 'hybrid']),
    transmission: new Set(['automatic', 'manual'])
  };
  for (const [field, allowed] of Object.entries(canonical)) {
    if (input[field] === undefined || input[field] === null || input[field] === '') continue;
    if (typeof input[field] !== 'string' || !allowed.has(input[field].trim().toLowerCase())) {
      throw new Error(`${field} must use a supported canonical value.`);
    }
    criteria[field] = input[field].trim().toLowerCase();
  }
  return criteria;
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

function reviewClientId(value) {
  const clientId = String(value ?? '');
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(clientId)) {
    throw new Error('Refresh the page before reviewing catalog options.');
  }
  return clientId;
}

function requiredRepairJob(value) {
  const repairNodeId = String(value ?? 'unknown');
  if (!SUPPORTED_REPAIR_JOBS.has(repairNodeId)) {
    throw new Error('Confirm a supported repair job before reviewing catalog options.');
  }
  return repairNodeId;
}

function reviewBinding({ criteria, repairNodeId, clientId, optionsList }) {
  return JSON.stringify({
    criteria,
    repairNodeId,
    clientId,
    optionIds: optionsList.map((option) => option.id)
  });
}

function signReviewToken(binding, secret, currentTime) {
  const payload = Buffer.from(JSON.stringify({
    binding,
    expiresAt: currentTime + REVIEW_TOKEN_TTL_MS,
    nonce: randomBytes(12).toString('base64url')
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function pruneConsumedReviewTokens(consumedTokens, currentTime) {
  for (const [token, expiresAt] of consumedTokens) {
    if (expiresAt <= currentTime) consumedTokens.delete(token);
  }
}

function verifyReviewToken(token, binding, secret, currentTime, consumedTokens) {
  pruneConsumedReviewTokens(consumedTokens, currentTime);
  if (typeof token !== 'string' || consumedTokens.has(token)) return null;
  const [payload, encodedSignature, extra] = token.split('.');
  if (!payload || !encodedSignature || extra !== undefined) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const received = Buffer.from(encodedSignature, 'base64url');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return decoded.binding === binding && Number.isFinite(decoded.expiresAt) && decoded.expiresAt > currentTime
      ? decoded.expiresAt
      : null;
  } catch {
    return null;
  }
}

function rememberConsumedReviewToken(consumedTokens, token, expiresAt, currentTime, maximumSize) {
  pruneConsumedReviewTokens(consumedTokens, currentTime);
  if (consumedTokens.size >= maximumSize) return false;
  consumedTokens.set(token, expiresAt);
  return true;
}

function comparePrefills(localPrefill, aiPrefill) {
  const localCount = REVIEW_FIELDS.filter((field) => localPrefill.values[field] !== undefined).length;
  const aiCount = REVIEW_FIELDS.filter((field) => aiPrefill.values[field] !== undefined).length;
  return {
    localFieldCount: localCount,
    aiFieldCount: aiCount,
    resolvedFields: REVIEW_FIELDS.filter(
      (field) => localPrefill.values[field] === undefined && aiPrefill.values[field] !== undefined
    ),
    repairJobResolved:
      localPrefill.repairJob.id === 'unknown' && aiPrefill.repairJob.id !== 'unknown'
  };
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
  const reviewSecret = options.reviewTokenSecret ?? randomBytes(32);
  const now = options.now ?? Date.now;
  const maxConsumedReviewTokens = Number.isInteger(options.maxConsumedReviewTokens) && options.maxConsumedReviewTokens > 0
    ? options.maxConsumedReviewTokens
    : MAX_CONSUMED_REVIEW_TOKENS;
  const consumedReviewTokens = new Map();

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
          maxInputLength: privacyLimits.maxInputLength,
          repairJobs: [
            { id: 'front-brake-service', label: 'Front brake service' },
            { id: 'rear-brake-service', label: 'Rear brake service' }
          ]
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/prefill') {
        const body = await readJson(req);
        const text = assertSafeVehicleText(body.text);
        const localPrefill = parseVehiclePrefill(text);
        const prefill = body.mode === 'ai'
          ? await requestOpenAIPrefill({
              text,
              clientId: body.clientId,
              apiKey: ai.apiKey,
              safetySalt: ai.safetySalt,
              model: ai.model,
              transport: options.openAITransport
            })
          : localPrefill;
        json(res, 200, {
          prefill,
          comparison: body.mode === 'ai' ? comparePrefills(localPrefill, prefill) : null
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/catalog-options') {
        const body = await readJson(req);
        const criteria = requiredCatalogCriteria(body.values);
        const clientId = reviewClientId(body.clientId);
        const repairNodeId = requiredRepairJob(body.repairNodeId);
        const optionsList = unionVehicleOptions(criteria);
        const binding = reviewBinding({ criteria, repairNodeId, clientId, optionsList });
        json(res, 200, {
          options: optionsList,
          reviewToken: signReviewToken(binding, reviewSecret, now())
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/confirm') {
        const body = await readJson(req);
        if (body.explicitConfirmation !== true) {
          json(res, 409, { error: 'Explicit human confirmation is required.' });
          return;
        }
        const criteria = requiredCatalogCriteria(body.values);
        const visibleOptions = unionVehicleOptions(criteria);
        const clientId = reviewClientId(body.clientId);
        const repairNodeId = requiredRepairJob(body.repairNodeId);
        const binding = reviewBinding({ criteria, repairNodeId, clientId, optionsList: visibleOptions });
        const currentTime = now();
        const reviewTokenExpiry = verifyReviewToken(
          body.reviewToken,
          binding,
          reviewSecret,
          currentTime,
          consumedReviewTokens
        );
        if (reviewTokenExpiry === null) {
          json(res, 409, { error: 'The review changed or expired. Search and confirm the visible options again.' });
          return;
        }
        const option = visibleOptions.find((item) => item.id === body.selectedOptionId);
        if (!option) {
          json(res, 404, { error: 'The selected synthetic option does not exist.' });
          return;
        }
        const confirmation = confirmVehicleChoice({ confirmationRequired: true }, option);
        const path = buildRepairPath(option, repairNodeId);
        if (!rememberConsumedReviewToken(
          consumedReviewTokens,
          body.reviewToken,
          reviewTokenExpiry,
          currentTime,
          maxConsumedReviewTokens
        )) {
          json(res, 503, { error: 'Review capacity is temporarily full. Search and confirm again shortly.' });
          return;
        }
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

const selfPath = fileURLToPath(import.meta.url);
// pm2 fork mode loads this file through its ProcessContainerFork wrapper, so argv[1] is not this file.
const isEntryPoint = process.argv[1] === selfPath || process.env.pm_exec_path === selfPath;
if (isEntryPoint) {
  const port = Number(process.env.PORT || 4173);
  const server = createDemoServer();
  server.listen(port, 'localhost', () => {
    console.log(`Repair Intelligence Reference is ready on local port ${port}.`);
  });
}
