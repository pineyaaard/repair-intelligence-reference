#!/usr/bin/env node
import process from 'node:process';
import { requestOpenAIPrefill } from '../src/openaiPrefill.js';

const apiKey = process.env.OPENAI_API_KEY ?? '';
const safetySalt = process.env.SAFETY_ID_SALT ?? '';
const model = process.env.OPENAI_MODEL ?? 'gpt-5.6';

if (!apiKey || safetySalt.length < 16) {
  console.error('Live AI eval requires OPENAI_API_KEY and SAFETY_ID_SALT in the process environment.');
  process.exit(1);
}

const cases = [
  {
    name: 'English front brake',
    text: 'brand-a series-1 2017 2.0 diesel 190 hp automatic; front brake service',
    expected: {
      values: {
        make: 'brand-a', model: 'series-1', year: 2017, engineLiters: 2,
        fuel: 'diesel', powerHp: 190, transmission: 'automatic'
      },
      repairJobId: 'front-brake-service'
    }
  },
  {
    name: 'Czech front brake',
    text: 'potřebuji přední brzdy: brand-a series-1, rok 2017, nafta, objem dva litry, 190 koní, automat',
    expected: {
      values: {
        make: 'brand-a', model: 'series-1', year: 2017, engineLiters: 2,
        fuel: 'diesel', powerHp: 190, transmission: 'automatic'
      },
      repairJobId: 'front-brake-service'
    }
  },
  {
    name: 'Czech rear brake',
    text: 'zadní brzdy pro brand-a series-1, rok 2017, dvoulitrový naftový motor, 190 koní, automatická převodovka',
    expected: {
      values: {
        make: 'brand-a', model: 'series-1', year: 2017, engineLiters: 2,
        fuel: 'diesel', powerHp: 190, transmission: 'automatic'
      },
      repairJobId: 'rear-brake-service'
    }
  }
];

for (const [index, item] of cases.entries()) {
  const result = await requestOpenAIPrefill({
    text: item.text,
    clientId: `liveaievalsession${String(index + 1).padStart(16, '0')}`,
    apiKey,
    safetySalt,
    model
  });
  const actual = JSON.stringify(result.values);
  const expected = JSON.stringify(item.expected.values);
  if (actual !== expected || result.repairJob.id !== item.expected.repairJobId) {
    console.error(`${item.name}: FAIL (review the structured fields; raw request and response were not logged).`);
    process.exit(1);
  }
  console.log(`${item.name}: PASS via ${result.aiEvidence.servedModel}`);
}

console.log(`Live AI eval passed: ${cases.length}/${cases.length} synthetic cases.`);
