import test from 'node:test';
import assert from 'node:assert/strict';
import { unionVehicleOptions } from '../src/catalogUnion.js';
import { buildRepairPath, renderRepairPath } from '../src/repairPath.js';

test('union preserves a distinct variant and exposes duplicate provenance', () => {
  const options = unionVehicleOptions({ make: 'brand-a', model: 'series-1', year: 2017 });

  assert.equal(options.length, 2);
  const p1 = options.find((option) => option.variant === 'P1');
  const p2 = options.find((option) => option.variant === 'P2');
  assert.deepEqual(p1.availableFrom, ['source-alpha', 'source-beta']);
  assert.equal(p1.primarySource, 'source-alpha');
  assert.deepEqual(p2.availableFrom, ['source-beta']);
});
test('confirmed option produces a visual node and unioned synthetic parts', () => {
  const [option] = unionVehicleOptions({
    make: 'brand-a',
    model: 'series-1',
    year: 2017,
    engineLiters: 2,
    fuel: 'diesel',
    powerHp: 190,
    transmission: 'automatic'
  });
  const path = buildRepairPath(option, 'front-brake-service');
  const rendered = renderRepairPath(path);

  assert.equal(path.parts.length, 3);
  assert.match(rendered, /\[wheel-end\] -> \[caliper\] -> \[pad-set\]/);
  assert.match(rendered, /Wear sensor/);
});
