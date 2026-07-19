import { CATALOG_SOURCES } from './fixtures.js';

const identityFields = [
  'make',
  'model',
  'year',
  'engineLiters',
  'fuel',
  'powerHp',
  'transmission',
  'variant'
];

const normalize = (value) => String(value ?? '').trim().toLowerCase();

function vehicleIdentity(vehicle) {
  return identityFields.map((field) => String(vehicle[field] ?? '')).join('|');
}
function matchesCriteria(vehicle, criteria) {
  return Object.entries(criteria).every(([field, expected]) => {
    if (expected === undefined || expected === null || expected === '') return true;
    return normalize(vehicle[field]) === normalize(expected);
  });
}

/**
 * Forms one deterministic union without hiding variants. Duplicate records are
 * collapsed only when their complete vehicle identity agrees; source priority
 * decides the primary record while provenance remains visible.
 */
export function unionVehicleOptions(criteria = {}, sources = CATALOG_SOURCES) {
  const grouped = new Map();

  for (const source of sources) {
    for (const vehicle of source.vehicles) {
      if (!matchesCriteria(vehicle, criteria)) continue;
      const key = vehicleIdentity(vehicle);
      const entries = grouped.get(key) ?? [];
      entries.push({ source, vehicle });
      grouped.set(key, entries);
    }
  }

  return [...grouped.values()]
    .map((entries) => {
      const ordered = [...entries].sort((a, b) => a.source.priority - b.source.priority);
      const primary = ordered[0];
      return {
        id: primary.vehicle.id,
        ...identityFields.reduce((result, field) => ({ ...result, [field]: primary.vehicle[field] }), {}),
        primarySource: primary.source.id,
        availableFrom: ordered.map(({ source }) => source.id),
        sourceRecords: ordered.map(({ source, vehicle }) => ({
          sourceId: source.id,
          sourceLabel: source.label,
          recordId: vehicle.id
        }))
      };
    })
    .sort((a, b) => {
      const aSource = sources.find((source) => source.id === a.primarySource)?.priority ?? Number.MAX_SAFE_INTEGER;
      const bSource = sources.find((source) => source.id === b.primarySource)?.priority ?? Number.MAX_SAFE_INTEGER;
      return aSource - bSource || a.id.localeCompare(b.id);
    });
}

export function sourceVehiclesForOption(option, sources = CATALOG_SOURCES) {
  const records = new Set(
    option.sourceRecords.map((record) => `${record.sourceId}\u0000${record.recordId}`)
  );
  return sources.flatMap((source) =>
    source.vehicles
      .filter((vehicle) => records.has(`${source.id}\u0000${vehicle.id}`))
      .map((vehicle) => ({ source, vehicle }))
  ).sort((a, b) => a.source.priority - b.source.priority || a.source.id.localeCompare(b.source.id));
}
