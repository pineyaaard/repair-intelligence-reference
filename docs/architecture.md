# Architecture and Trust Boundaries

## Runtime components

1. **Browser UI** — gathers a generic request, displays editable prefill fields,
   captures an explicit option selection, and renders the returned synthetic path.
2. **Minimal same-origin server** — validates body size and field allowlists,
   applies security headers, and owns all optional API configuration.
3. **Prefill adapters** — a zero-network deterministic parser and an optional
   GPT-5.6 Structured Output adapter with the same result shape.
4. **Catalog union** — deterministic identity matching, precedence, provenance,
   and variant preservation over invented fixtures.
5. **Confirmation boundary** — rejects any path request without both a selected
   option and the exact explicit-confirmation flag.
6. **Repair path** — deterministic node and parts projection from the confirmed
   synthetic option.
7. **Error rollup** — in-memory aggregate with a redacted fingerprint and no
   remediation capability.

## Data flow

```text
browser text
  -> length + sensitive-pattern gate
     -> local parser
     OR optional server-side Responses API (strict schema, store:false)
  -> editable prefill in browser
  -> deterministic catalog criteria
  -> visible union options
  -> explicit human selection
  -> deterministic repair path

optional issue note
  -> received in memory
  -> discarded
  -> generic stage/category aggregate only
```

## Fail-closed behavior

- Missing API key or safety salt disables only AI prefill.
- Sensitive input stops before parsing or external transfer.
- API timeout, refusal, non-success response, missing output text, invalid JSON, or
  schema mismatch produces a generic error and points back to local prefill.
- Missing explicit confirmation returns a conflict and no repair path.
- Unknown selected option returns no result.
- Unknown repair intent is shown for human correction; the model cannot invent a
  new executable repair node.

## Production work deliberately absent

Authentication, tenant isolation, durable storage, rate limiting, live catalogs,
licensing enforcement, billing, inventory, pricing, repair authority, production
monitoring, and automated remediation all remain outside this reference.
