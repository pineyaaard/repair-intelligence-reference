const VEHICLE_ID_LIKE = /\b[A-HJ-NPR-Z0-9]{17}\b/gi;
const EMAIL = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi;
const PHONE_CANDIDATE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const TOKEN_LIKE = /\b(?:[A-Za-z0-9_-]{24,})\b/g;

const MAX_INPUT_LENGTH = 500;

function truncate(value, limit = 180) {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

export function sensitiveInputKinds(value) {
  const text = String(value ?? '');
  const kinds = [];
  if (VEHICLE_ID_LIKE.test(text)) kinds.push('vehicle-identifier');
  VEHICLE_ID_LIKE.lastIndex = 0;
  if (EMAIL.test(text)) kinds.push('contact-address');
  EMAIL.lastIndex = 0;
  const phoneLike = [...text.matchAll(PHONE_CANDIDATE)].some(
    (match) => match[0].replace(/\D/g, '').length >= 8
  );
  if (phoneLike) kinds.push('phone-number');
  PHONE_CANDIDATE.lastIndex = 0;
  if (TOKEN_LIKE.test(text)) kinds.push('token-like-value');
  TOKEN_LIKE.lastIndex = 0;
  return kinds;
}

export function assertSafeVehicleText(value) {
  const text = String(value ?? '').trim();
  if (text.length < 3) {
    throw new Error('Enter a short vehicle description and repair job.');
  }
  if (text.length > MAX_INPUT_LENGTH) {
    throw new Error(`Keep the description under ${MAX_INPUT_LENGTH} characters.`);
  }
  if (sensitiveInputKinds(text).length > 0) {
    throw new Error('Remove vehicle identifiers and personal or secret data before continuing.');
  }
  return text;
}

export function sanitizeDiagnostic(value) {
  const redacted = String(value ?? 'unknown error')
    .replace(VEHICLE_ID_LIKE, '[vehicle-id]')
    .replace(EMAIL, '[contact]')
    .replace(PHONE_CANDIDATE, (match) => (match.replace(/\D/g, '').length >= 8 ? '[phone]' : match))
    .replace(TOKEN_LIKE, '[token]');
  return truncate(redacted);
}

export const privacyLimits = Object.freeze({ maxInputLength: MAX_INPUT_LENGTH });
