import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVehiclePrefill, confirmVehicleChoice } from '../src/vehiclePrefill.js';
import { unionVehicleOptions } from '../src/catalogUnion.js';

test('natural language becomes a prefill, not a final selection', () => {
  const prefill = parseVehiclePrefill('brand-a series-1 2017 2.0 diesel 190 hp automatic');

  assert.deepEqual(prefill.values, {
    make: 'brand-a',
    model: 'series-1',
    year: 2017,
    engineLiters: 2,
    fuel: 'diesel',
    powerHp: 190,
    transmission: 'automatic'
  });
  assert.equal(prefill.confirmationRequired, true);
  assert.deepEqual(prefill.missingRequired, []);
  assert.equal(prefill.repairJob.id, 'unknown');
});

test('deterministic prefill also proposes a supported repair job', () => {
  const prefill = parseVehiclePrefill('brand-a series-1 2017; front brake service');
  assert.equal(prefill.repairJob.id, 'front-brake-service');
  assert.equal(prefill.confirmationRequired, true);
});

test('confirmation requires a user-selected catalog option', () => {
  const prefill = parseVehiclePrefill('brand-a series-1 2017');
  assert.throws(() => confirmVehicleChoice(prefill), /must be selected/);

  const [option] = unionVehicleOptions(prefill.values);
  const result = confirmVehicleChoice(prefill, option);
  assert.equal(result.confirmed, true);
  assert.equal(result.confirmationSource, 'explicit-user-selection');
  assert.equal(result.vehicle.variant, 'P1');
});
