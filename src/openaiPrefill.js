import { createHmac } from 'node:crypto';
import { assertSafeVehicleText } from './privacy.js';

const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.6';

const nullableString = { type: ['string', 'null'] };
const nullableNumber = { type: ['number', 'null'] };
const nullableInteger = { type: ['integer', 'null'] };

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
        fuel: nullableString,
        powerHp: nullableInteger,
        transmission: nullableString
      },
      required: ['make', 'model', 'year', 'engineLiters', 'fuel', 'powerHp', 'transmission'],
      additionalProperties: false
    },
    repairJob: {
      type: 'object',
      properties: {
        id: { type: 'string', enum: ['front-brake-service', 'unknown'] },
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

function normalizeNullable(value) {
  return value === null ? undefined : value;
}

function validateStructuredPrefill(value) {
  if (!value || typeof value !== 'object' || !value.values || !value.repairJob) {
    throw new Error('AI prefill returned an invalid structure. Use local prefill instead.');
  }

  const source = value.values;
  const result = {
    make: normalizeNullable(source.make),
    model: normalizeNullable(source.model),
    year: normalizeNullable(source.year),
    engineLiters: normalizeNullable(source.engineLiters),
    fuel: normalizeNullable(source.fuel),
    powerHp: normalizeNullable(source.powerHp),
    transmission: normalizeNullable(source.transmission)
  };
  const validScalars = Object.values(result).every(
    (item) => item === undefined || ['string', 'number'].includes(typeof item)
  );
  if (!validScalars || !['front-brake-service', 'unknown'].includes(value.repairJob.id)) {
    throw new Error('AI prefill returned invalid field values. Use local prefill instead.');
  }

  const required = ['make', 'model', 'year'];
  const present = Object.values(result).filter((item) => item !== undefined).length;
  return {
    values: result,
    repairJob: {
      id: value.repairJob.id,
      label: String(value.repairJob.label || 'Job needs confirmation').slice(0, 80)
    },
    missingRequired: required.filter((field) => result[field] === undefined),
    confidence: Number((present / Object.keys(result).length).toFixed(2)),
    confirmationRequired: true,
    parser: 'openai-responses-structured-prefill'
  };
}

function extractStructuredOutputText(body) {
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
          'Extract only the explicitly stated generic vehicle fields and repair intent. Use null when absent. Never choose a catalog record. Map a front brake job to front-brake-service; otherwise use unknown.',
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
    return validateStructuredPrefill(JSON.parse(extractStructuredOutputText(body)));
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
