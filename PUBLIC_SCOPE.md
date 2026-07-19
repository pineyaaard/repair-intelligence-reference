# Public Scope and Deliberate Exclusions

This repository is a newly written clean-room demonstrator. It may be published
only after the automated gates and final human review in `RELEASE_CHECKLIST.md`.
The original material that passes that publication boundary is released under
the [MIT License](LICENSE). That source-code license does not make excluded
private, confidential, production, or third-party material part of this project.

## Included

- Original browser and server code for a human-confirmed workflow.
- Invented vehicle labels, variants, source records, parts, paths, and issues.
- Generic product patterns: Structured Output prefill, source union, provenance,
  explicit confirmation, and privacy-safe observability.
- An optional server-side OpenAI Responses API call for bounded prefill only.
- Offline tests, CI, a competition draft, and a synthetic video script.

## Explicitly excluded

- Production source, copied algorithms, commits, branches, deployment scripts,
  infrastructure, server locations, environment files, operational logs, or access.
- Any customer, staff, prospect, partner, account, user, vehicle identifier,
  contact, payment, repair, inventory, price, telemetry, or support record.
- Licensed, scraped, copied, derived, or restricted catalog data, fitment records,
  diagrams, images, prices, supplier details, repair methods, or identifiers.
- Private product, market, partner, provider, campaign, or commercial names.
- Real coverage, accuracy, certification, availability, customer, performance,
  revenue, deployment, or model-use claims not reproducible from this revision.
- API keys, salts, tokens, session material, credentials, or private endpoints.

## Release rule

Treat every proposed addition as private by default. Include it only when it is
newly created, synthetic, necessary for the demonstrator, legally publishable,
and accepted by both automated scans and a human diff/history review. When in
doubt, omit it.
