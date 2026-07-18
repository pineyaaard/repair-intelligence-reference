import { createHash } from 'node:crypto';
import { sanitizeDiagnostic } from './privacy.js';

export function sanitizeErrorMessage(value) {
  return sanitizeDiagnostic(value);
}

function safeRoute(value) {
  return String(value ?? '/unknown')
    .split('?')[0]
    .replace(/\/[0-9a-f]{8,}/gi, '/:id')
    .slice(0, 120);
}

function category(status) {
  if (status >= 500) return 'server-error';
  if (status >= 400) return 'client-error';
  return 'unexpected';
}

/**
 * In-memory skeleton for a server-side adapter. It stores an aggregate key and
 * a sanitized sample only. It deliberately cannot trigger code changes, send
 * data externally, or automate remediation without a future human-approved
 * integration layer.
 */
export class PrivacySafeErrorRollup {
  #entries = new Map();

  record({ route, status = 500, error, at = new Date().toISOString() }) {
    const safeStatus = Number.isInteger(status) ? status : 500;
    const sanitized = sanitizeErrorMessage(error instanceof Error ? error.message : error);
    const sanitizedRoute = safeRoute(route);
    const fingerprint = createHash('sha256')
      .update(`${category(safeStatus)}|${safeStatus}|${sanitizedRoute}|${sanitized}`)
      .digest('hex')
      .slice(0, 16);
    const key = `${safeStatus}|${sanitizedRoute}|${fingerprint}`;
    const existing = this.#entries.get(key);

    const event = existing ?? {
      id: fingerprint,
      category: category(safeStatus),
      status: safeStatus,
      route: sanitizedRoute,
      safeMessage: sanitized,
      count: 0,
      firstSeen: at,
      lastSeen: at,
      triageState: 'new',
      automationEligible: false,
      automationNote: 'Human review is required before any remediation action.'
    };

    event.count += 1;
    event.lastSeen = at;
    this.#entries.set(key, event);
    return { ...event };
  }

  list() {
    return [...this.#entries.values()]
      .map((entry) => ({ ...entry }))
      .sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen));
  }
}
