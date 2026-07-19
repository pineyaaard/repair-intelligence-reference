/**
 * Entirely invented catalog fixtures. They demonstrate shape and precedence,
 * not real fitment, inventory, pricing, diagrams, or repair guidance.
 */

const frontBrakeNode = (parts) => ({
  id: 'front-brake-service',
  label: 'Front brake service',
  diagram: ['wheel-end', 'caliper', 'pad-set'],
  parts
});

const rearBrakeNode = (parts) => ({
  id: 'rear-brake-service',
  label: 'Rear brake service',
  diagram: ['wheel-end', 'rear-caliper', 'pad-set'],
  parts
});

export const CATALOG_SOURCES = [
  {
    id: 'source-alpha',
    label: 'Source Alpha',
    priority: 1,
    vehicles: [
      {
        id: 'alpha-brand-a-series-1-p1',
        make: 'brand-a',
        model: 'series-1',
        year: 2017,
        engineLiters: 2.0,
        fuel: 'diesel',
        powerHp: 190,
        transmission: 'automatic',
        variant: 'P1',
        nodes: [
          frontBrakeNode([
            { id: 'pad-set-a', label: 'Pad set', quantity: 1 },
            { id: 'rotor-a', label: 'Brake rotor', quantity: 2 }
          ]),
          rearBrakeNode([
            { id: 'pad-set-rear-a', label: 'Pad set', quantity: 1 },
            { id: 'rotor-rear-a', label: 'Brake rotor', quantity: 2 }
          ])
        ]
      },
      {
        id: 'alpha-brand-b-cargo-2-c1',
        make: 'brand-b',
        model: 'cargo-2',
        year: 2019,
        engineLiters: 1.6,
        fuel: 'petrol',
        powerHp: 120,
        transmission: 'manual',
        variant: 'C1',
        nodes: [
          frontBrakeNode([{ id: 'pad-set-c', label: 'Pad set', quantity: 1 }]),
          rearBrakeNode([{ id: 'shoe-kit-c', label: 'Shoe kit', quantity: 1 }])
        ]
      }
    ]
  },
  {
    id: 'source-beta',
    label: 'Source Beta',
    priority: 2,
    vehicles: [
      {
        id: 'beta-brand-a-series-1-p1',
        make: 'brand-a',
        model: 'series-1',
        year: 2017,
        engineLiters: 2.0,
        fuel: 'diesel',
        powerHp: 190,
        transmission: 'automatic',
        variant: 'P1',
        nodes: [
          frontBrakeNode([
            { id: 'pad-set-a', label: 'Pad set', quantity: 1 },
            { id: 'wear-sensor-b', label: 'Wear sensor', quantity: 1 }
          ]),
          rearBrakeNode([
            { id: 'pad-set-rear-a', label: 'Pad set', quantity: 1 },
            { id: 'park-shoe-b', label: 'Parking shoe kit', quantity: 1 }
          ])
        ]
      },
      {
        id: 'beta-brand-a-series-1-p2',
        make: 'brand-a',
        model: 'series-1',
        year: 2017,
        engineLiters: 2.0,
        fuel: 'diesel',
        powerHp: 190,
        transmission: 'automatic',
        variant: 'P2',
        nodes: [
          frontBrakeNode([{ id: 'pad-set-b', label: 'Pad set', quantity: 1 }]),
          rearBrakeNode([{ id: 'pad-set-rear-b', label: 'Pad set', quantity: 1 }])
        ]
      }
    ]
  },
  {
    id: 'source-gamma',
    label: 'Source Gamma',
    priority: 3,
    vehicles: [
      {
        id: 'gamma-brand-c-utility-3-u1',
        make: 'brand-c',
        model: 'utility-3',
        year: 2020,
        engineLiters: 2.2,
        fuel: 'diesel',
        powerHp: 165,
        transmission: 'manual',
        variant: 'U1',
        nodes: [
          frontBrakeNode([{ id: 'pad-set-u', label: 'Pad set', quantity: 1 }]),
          rearBrakeNode([{ id: 'pad-set-rear-u', label: 'Pad set', quantity: 1 }])
        ]
      }
    ]
  }
];

export const SAMPLE_MESSAGE =
  'brand-a series-1 2017 2.0 diesel 190 hp automatic; front brake service';
