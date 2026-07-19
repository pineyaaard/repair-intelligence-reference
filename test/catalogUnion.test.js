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
  assert.deepEqual(path.evidenceWarnings, []);
});

test('repair evidence uses composite source records and preserves conflicts', () => {
  const vehicle = (id, label, quantity) => ({
    id,
    make: 'brand-x',
    model: 'series-x',
    year: 2021,
    engineLiters: 1.5,
    fuel: 'petrol',
    powerHp: 110,
    transmission: 'manual',
    variant: 'X1',
    nodes: [{
      id: 'front-brake-service',
      label: 'Front brake service',
      diagram: ['wheel-end', 'caliper'],
      parts: [{ id: 'shared-part', label, quantity }]
    }]
  });
  const sources = [
    { id: 'low-priority', label: 'Low', priority: 2, vehicles: [vehicle('same-record-id', 'Alternate pad', 2)] },
    { id: 'high-priority', label: 'High', priority: 1, vehicles: [vehicle('same-record-id', 'Primary pad', 1)] },
    { id: 'collision-only', label: 'Collision', priority: 3, vehicles: [vehicle('same-record-id', 'Wrong record', 9)] }
  ];
  const [option] = unionVehicleOptions({ make: 'brand-x' }, sources.slice(0, 2));
  const path = buildRepairPath(option, 'front-brake-service', sources);

  assert.deepEqual(path.catalogProvenance, ['high-priority', 'low-priority']);
  assert.equal(path.parts[0].label, 'Primary pad');
  assert.equal(path.parts[0].quantity, 1);
  assert.deepEqual(path.parts[0].conflicts, [
    { sourceId: 'low-priority', label: 'Alternate pad', quantity: 2 }
  ]);
  assert.equal(path.evidenceWarnings[0].type, 'part-conflict');
  assert.equal(JSON.stringify(path).includes('Wrong record'), false);
});
