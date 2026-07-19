import { CATALOG_SOURCES } from './fixtures.js';

const normalize = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

function knownValues(field) {
  return [...new Set(CATALOG_SOURCES.flatMap((source) => source.vehicles.map((vehicle) => vehicle[field])))];
}

function readKnownToken(text, field) {
  return knownValues(field).find((value) => text.includes(value));
}

function readYear(text) {
  const match = text.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

function readLiters(text) {
  const decimal = text.match(/\b([1-8][.,]\d)\b/);
  const explicit = text.match(/\b([1-8])\s*(?:l|liters?)\b/);
  const value = decimal?.[1] ?? explicit?.[1];
  return value ? Number(value.replace(',', '.')) : undefined;
}

function readPowerHp(text) {
  const match = text.match(/\b(\d{2,3})\s*(?:hp|bhp)\b/);
  return match ? Number(match[1]) : undefined;
}

function readFuel(text) {
  return ['diesel', 'petrol', 'electric', 'hybrid'].find((value) => text.includes(value));
}

function readTransmission(text) {
  if (text.includes('automatic')) return 'automatic';
  if (text.includes('manual')) return 'manual';
  return undefined;
}

function readRepairJob(text) {
  if (text.includes('rear brake')) {
    return { id: 'rear-brake-service', label: 'Rear brake service' };
  }
  if (text.includes('front brake')) {
    return { id: 'front-brake-service', label: 'Front brake service' };
  }
  return { id: 'unknown', label: 'Job needs confirmation' };
}

/**
 * Deterministic local parser. It intentionally returns a prefill only and
 * never treats a natural-language message as final catalog identity.
 */
export function parseVehiclePrefill(message) {
  const text = normalize(message);
  const values = {
    make: readKnownToken(text, 'make'),
    model: readKnownToken(text, 'model'),
    year: readYear(text),
    engineLiters: readLiters(text),
    fuel: readFuel(text),
    powerHp: readPowerHp(text),
    transmission: readTransmission(text)
  };
  const required = ['make', 'model', 'year'];
  const present = Object.values(values).filter((value) => value !== undefined).length;

  return {
    values,
    repairJob: readRepairJob(text),
    missingRequired: required.filter((field) => values[field] === undefined),
    fieldCoverage: Number((present / Object.keys(values).length).toFixed(2)),
    confirmationRequired: true,
    parser: 'deterministic-offline-reference'
  };
}

/**
 * Confirmation is explicit: a caller must submit a visible selected option.
 * This reference refuses to silently choose a catalog record from text alone.
 */
export function confirmVehicleChoice(prefill, selectedOption) {
  if (!prefill?.confirmationRequired) {
    throw new Error('A pending prefill is required before confirmation.');
  }
  if (!selectedOption?.id) {
    throw new Error('A catalog option must be selected by the user.');
  }

  return {
    confirmed: true,
    vehicle: {
      make: selectedOption.make,
      model: selectedOption.model,
      year: selectedOption.year,
      engineLiters: selectedOption.engineLiters,
      fuel: selectedOption.fuel,
      powerHp: selectedOption.powerHp,
      transmission: selectedOption.transmission,
      variant: selectedOption.variant
    },
    selectedOptionId: selectedOption.id,
    confirmationSource: 'explicit-user-selection'
  };
}
