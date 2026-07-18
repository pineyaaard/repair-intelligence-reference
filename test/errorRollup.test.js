import test from 'node:test';
import assert from 'node:assert/strict';
import { PrivacySafeErrorRollup, sanitizeErrorMessage } from '../src/errorRollup.js';

test('sanitizer removes identifier, email, and token-like values', () => {
  const vehicleId = 'A'.repeat(17);
  const message = sanitizeErrorMessage(
    `Failure for ${vehicleId} contact=a.person@example.invalid token=abcdefghijklmnopqrstuvwx`
  );

  assert.equal(message.includes(vehicleId), false);
  assert.equal(message.includes('a.person@example.invalid'), false);
  assert.equal(message.includes('abcdefghijklmnopqrstuvwx'), false);
  assert.match(message, /\[vehicle-id\]/);
});

test('rollup aggregates only sanitized, human-gated diagnostics', () => {
  const rollup = new PrivacySafeErrorRollup();
  const vehicleId = 'A'.repeat(17);
  rollup.record({
    route: '/estimate/abcdef1234567890?contact=a.person@example.invalid',
    status: 502,
    error: `Failure for ${vehicleId}`
  });
  rollup.record({
    route: '/estimate/abcdef1234567890?contact=a.person@example.invalid',
    status: 502,
    error: `Failure for ${vehicleId}`
  });

  const [entry] = rollup.list();
  const serialized = JSON.stringify(entry);
  assert.equal(entry.count, 2);
  assert.equal(entry.automationEligible, false);
  assert.equal(serialized.includes(vehicleId), false);
  assert.equal(serialized.includes('example.invalid'), false);
  assert.equal(entry.route.includes('?'), false);
});

test('redaction happens before truncation so a boundary cannot expose a secret fragment', () => {
  const token = 'x'.repeat(40);
  const message = sanitizeErrorMessage(`${'safe '.repeat(34)}${token}`);
  assert.equal(message.includes(token.slice(0, 10)), false);
  assert.match(message, /\[token\]/);
});
