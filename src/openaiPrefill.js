import { createHmac } from 'node:crypto';
import { assertSafeVehicleText } from './privacy.js';

const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.6';

const CANONICAL_FUELS = Object.freeze(['diesel', 'petrol', 'electric', 'hybrid']);
const CANONICAL_TRANSMISSIONS = Object.freeze(['automatic', 'manual']);
const REPAIR_JOB_LABELS = Object.freeze({
  'front-brake-service': 'Front brake service',
  'rear-brake-service': 'Rear brake service',
  unknown: 'Job needs confirmation'
});

const nullableString = { type: ['string', 'null'] };
const nullableNumber = { type: ['number', 'null'] };
const nullableInteger = { type: ['integer', 'null'] };
const nullableEnum = (values) => ({ type: ['string', 'null'], enum: [...values, null] });

export const PREFILL_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    values: {
      type: 'object',
      properties: {
        make: nullableString,
        model: nullableString,
        year: nullableInteger,
        engineLiters: nullableNumber,
        fuel: nullableEnum(CANONICAL_FUELS),
        powerHp: nullableInteger,
        transmission: nullableEnum(CANONICAL_TRANSMISSIONS)
      },
      required: ['make', 'model', 'year', 'engineLiters', 'fuel', 'powerHp', 'transmission'],
      additionalProperties: false
    },
    repairJob: {
      type: 'object',
      properties: {
        id: { type: 'string', enum: Object.keys(REPAIR_JOB_LABELS) },
        label: { type: 'string' }
      },
      required: ['id', 'label'],
      additionalProperties: false
    }
  },
  required: ['values', 'repairJob'],
  additionalProperties: false
});

function validateClientId(clientId) {
  const value = String(clientId ?? '');
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(value)) {
    throw new Error('The anonymous browser session is invalid. Refresh and try again.');
  }
  return value;
}

export function safetyIdentifier(clientId, salt) {
  if (String(salt ?? '').length < 16) {
    throw new Error('AI prefill is unavailable until a safety salt is configured.');
  }
  return createHmac('sha256', salt).update(validateClientId(clientId)).digest('hex');
}

function normalizeText(value, field) {
  if (value === null) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`AI prefill returned an invalid ${field}. Use local prefill instead.`);
  }
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalized.length === 0 || normalized.length > 80) {
    throw new Error(`AI prefill returned an invalid ${field}. Use local prefill instead.`);
  }
  return normalized;
}

function normalizeNumber(value, field, { min, max, integer = false }) {
  if (value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`AI prefill returned an invalid ${field}. Use local prefill instead.`);
  }
  if (integer && !Number.isInteger(value)) {
    throw new Error(`AI prefill returned an invalid ${field}. Use local prefill instead.`);
  }
  return value;
}

function validateStructuredPrefill(value) {
  if (!value || typeof value !== 'object' || !value.values || !value.repairJob) {
    throw new Error('AI prefill returned an invalid structure. Use local prefill instead.');
  }

  const source = value.values;
  const result = {
    make: normalizeText(source.make, 'make'),
    model: normalizeText(source.model, 'model'),
    year: normalizeNumber(source.year, 'year', { min: 1886, max: 2100, integer: true }),
    engineLiters: normalizeNumber(source.engineLiters, 'engine size', { min: 0.1, max: 20 }),
    fuel: normalizeText(source.fuel, 'fuel'),
    powerHp: normalizeNumber(source.powerHp, 'power', { min: 1, max: 5000, integer: true }),
    transmission: normalizeText(source.transmission, 'transmission')
  };
  if (
    (result.fuel !== undefined && !CANONICAL_FUELS.includes(result.fuel)) ||
    (result.transmission !== undefined && !CANONICAL_TRANSMISSIONS.includes(result.transmission)) ||
    !Object.hasOwn(REPAIR_JOB_LABELS, value.repairJob.id)
  ) {
    throw new Error('AI prefill returned invalid field values. Use local prefill instead.');
  }

  const required = ['make', 'model', 'year'];
  const present = Object.values(result).filter((item) => item !== undefined).length;
  return {
    values: result,
    repairJob: {
      id: value.repairJob.id,
      label: REPAIR_JOB_LABELS[value.repairJob.id]
    },
    missingRequired: required.filter((field) => result[field] === undefined),
    fieldCoverage: Number((present / Object.keys(result).length).toFixed(2)),
    confirmationRequired: true,
    parser: 'openai-responses-structured-prefill'
  };
}

function extractStructuredOutputText(body) {
  if (body?.status === 'incomplete') {
    throw new Error('AI prefill was incomplete. Use local prefill instead.');
  }
  if (!body || typeof body !== 'object' || body.status !== 'completed' || !Array.isArray(body.output)) {
    throw new Error('AI prefill returned an invalid response envelope. Use local prefill instead.');
  }

  const unexpectedOutput = body.output.some(
    (item) => !item || typeof item !== 'object' || !['message', 'reasoning'].includes(item.type)
  );
  if (unexpectedOutput) {
    throw new Error('AI prefill returned an unexpected output type. Use local prefill instead.');
  }

  const messages = body.output.filter((item) => item.type === 'message');
  if (messages.length !== 1) {
    const reason = messages.length === 0 ? 'no' : 'multiple';
    throw new Error(`AI prefill returned ${reason} structured result. Use local prefill instead.`);
  }

  const [message] = messages;
  if (message.role !== 'assistant' || message.status !== 'completed' || !Array.isArray(message.content)) {
    throw new Error('AI prefill returned an invalid message envelope. Use local prefill instead.');
  }
  if (message.content.length !== 1) {
    throw new Error('AI prefill returned multiple or missing content results. Use local prefill instead.');
  }

  const [part] = message.content;
  if (part?.type === 'refusal') {
    throw new Error('AI prefill declined this request. Review the text or use local prefill instead.');
  }
  if (
    !part ||
    typeof part !== 'object' ||
    part.type !== 'output_text' ||
    typeof part.text !== 'string' ||
    part.text.trim() === ''
  ) {
    throw new Error('AI prefill returned no structured text result. Use local prefill instead.');
  }
  return part.text;
}

export async function requestOpenAIPrefill({
  text,
  clientId,
  apiKey,
  safetySalt,
  model = DEFAULT_MODEL,
  transport = globalThis.fetch,
  timeoutMs = 15_000
}) {
  const safeText = assertSafeVehicleText(text);
  if (!apiKey) throw new Error('AI prefill is not configured. Use local prefill instead.');
  if (typeof transport !== 'function') throw new Error('AI prefill transport is unavailable.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await transport(RESPONSES_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: String(model || DEFAULT_MODEL),
        store: false,
        safety_identifier: safetyIdentifier(clientId, safetySalt),
        reasoning: { effort: 'low' },
        instructions:
          'Extract only explicitly stated generic vehicle fields and repair intent from a request in any language. Use null when a field is absent; never guess a catalog record. Return make and model as lowercase tokens. Return fuel only as diesel, petrol, electric, or hybrid. Return transmission only as automatic or manual. Convert explicitly stated words and units to numeric year, engineLiters, and powerHp. Map a front brake job to front-brake-service, a rear brake job to rear-brake-service, and every other job to unknown.',
        input: safeText,
        text: {
          format: {
            type: 'json_schema',
            name: 'vehicle_job_prefill',
            strict: true,
            schema: PREFILL_SCHEMA
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error('AI prefill is temporarily unavailable. Use local prefill instead.');
    }
    const body = await response.json();
    if (typeof body.model !== 'string' || body.model.trim() === '') {
      throw new Error('AI prefill returned no served-model evidence. Use local prefill instead.');
    }
    return {
      ...validateStructuredPrefill(JSON.parse(extractStructuredOutputText(body))),
      aiEvidence: {
        servedModel: body.model.trim(),
        responseStatus: body.status
      }
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('AI prefill timed out. Use local prefill instead.');
    }
    if (error instanceof SyntaxError) {
      throw new Error('AI prefill returned invalid JSON. Use local prefill instead.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const openAIConfig = Object.freeze({ defaultModel: DEFAULT_MODEL });
