# Security and Privacy Policy

## Security model

The deterministic demo is local, dependency-free, and uses invented data. An
optional server-side adapter may send a short, pre-screened vehicle description
to the OpenAI Responses API for Structured Output. That adapter is deliberately
isolated from catalog union, confirmation, repair-path generation, and issue
aggregation.

## Data lifecycle

| Data | Handling |
| --- | --- |
| Free-text vehicle/job request | Length-limited, sensitive-pattern checked, processed in memory, never logged or persisted |
| Anonymous browser session | Random per tab, HMAC-hashed server-side before optional API use |
| OpenAI response | `store: false`; parsed in memory into the fixed schema; never persisted |
| Human confirmation | Returned to the same browser; no database exists |
| Optional issue note | Accepted in memory and immediately discarded |
| Issue aggregate | Generic stage, category, status, count, timestamp, and redacted fingerprint only |

## API key handling

- Keep `OPENAI_API_KEY` and `SAFETY_ID_SALT` only in a private server environment.
- Never prefix either value into browser assets, URLs, logs, screenshots, commits,
  CI variables printed to output, or issue reports.
- Use a project-scoped key, least-privilege operational access, spend limits, and
  rotation appropriate to the deployment.
- The browser config endpoint discloses only whether optional AI is available,
  the configured model label, and the fixed `store: false` behavior.
- AI prefill fails closed when either the key or a sufficiently long safety salt
  is absent. The deterministic path remains fully available.

## Request controls

- Same-origin browser calls only; CSP restricts connections to the app origin.
- No third-party browser scripts, fonts, trackers, cookies, analytics, or storage
  beyond one random tab-scoped identifier.
- Fixed request-size and input-length limits.
- Sensitive-looking identifiers, contact details, phone values, and token-like
  strings are rejected before the optional model request.
- Optional API calls use strict JSON Schema, `store: false`, a timeout, and no retry.
- API failures are returned as generic messages without provider payloads.

## Limitations

This reference is not hardened for untrusted public internet exposure. It does
not include authentication, distributed rate limiting, durable audit storage,
abuse operations, multi-tenant isolation, or production observability. Add those
controls and complete a threat review before hosting it beyond a controlled demo.

The pattern-based scans are defense in depth, not proof that a repository is
safe. A human must inspect the final diff and history before publication.

## Reporting a concern

Do not open a public issue containing a suspected secret, private record, or
restricted asset. Use the repository owner's private security contact and share
only the minimum reproduction detail. If no private channel is published, request
one without including the sensitive material.

Maintainers should stop publication, remove the affected content from history,
rotate any external secret, rerun `npm run check`, and publish only a minimal
remediation note after exposure has been contained.
