# OpenAI Build Week Submission Package

This document contains concise, reproducible submission copy. Add only the final
repository and video links after they are reviewed. Do not add production claims,
customer names, private screenshots, or non-synthetic assets.

## Built during the Submission Period

This clean-room synthetic reference app was built on **18–19 Jul 2026** during
the Submission Period. It was newly written for this entry and contains no production
source, licensed catalog data, real customer data, or production-derived assets.

## Project name

**Repair Intelligence Reference**

## Track

**Work and Productivity**

## One-line description

A human-confirmed repair-intelligence workflow where GPT-5.6 structures an
incomplete multilingual request, while deterministic code preserves catalog
variants, source provenance, and a privacy-safe decision boundary.

## Short pitch

Repair intake begins in natural language, but catalog selection demands exactness.
Repair Intelligence Reference keeps those responsibilities separate. GPT-5.6
turns a multilingual vehicle-and-job sentence into a strict, canonical, editable
prefill. On the recorded Czech sample, the local baseline extracts 3 of 7 fields;
the live Structured Output resolves all 7 plus the repair job. A person must then
review the fields and select an exact synthetic option. Only after a short-lived,
one-use review token and explicit confirmation does deterministic code merge source
records and build a transparent node-to-part path. The model improves intake
without becoming a hidden fitment authority.

## The problem

An incomplete service request has three different uncertainties:

1. What did the person mean?
2. Which exact catalog identity is correct?
3. Which source records and repair nodes support the output?

Treating those as one generative task makes corrections hard to see and source
provenance easy to lose. A misidentified vehicle can become a wrong part order,
a returned delivery, a repeat appointment, and lost workshop time, while nobody
can show which source or assumption produced the mistake. Independent workshops,
parts counters, and fleet maintenance teams need language understanding without
silently turning a proposal into a parts decision.

## What we built

- A polished four-stage browser workflow for intake, confirmation, visual repair
  path, and privacy-safe issue reporting.
- A GPT-5.6 Responses API adapter with strict Structured Outputs, canonical enums,
  semantic range checks, and visible served-model evidence.
- A zero-key deterministic parser so every judge can run the full demo locally.
- A deterministic source-union algorithm that merges exact duplicates, preserves
  distinct variants, applies source precedence, and exposes provenance.
- Two synthetic repair jobs supported end to end.
- A hard human-confirmation gate with a short-lived, one-use review token bound to
  the exact fields, visible options, job, and browser session.
- Browser revision guards that invalidate stale paths and discard late responses
  after a user edit.
- An issue-report path that discards optional raw notes and stores only a generic
  redacted aggregate for human triage.
- Offline tests and publication scanners for secrets and out-of-scope content.

## How OpenAI is used

GPT-5.6 is used for one bounded but consequential task: translate a short
multilingual vehicle-and-job description into canonical fields in a fixed JSON
schema. Fuel, transmission, job IDs, and numeric ranges are enforced again after
the schema response, and the UI compares the result with the deterministic local
baseline. The request uses the
Responses API, `text.format` Structured Outputs, `store: false`, low reasoning
effort, and a privacy-preserving server-side `safety_identifier` derived from a
random anonymous browser session. The API key never reaches browser code.

The model output is visibly editable and always has `confirmationRequired: true`.
It cannot select an option, access source fixtures, construct the union, create a
repair path, submit an issue, or perform an external action. The browser displays
the served model returned by the completed response rather than merely echoing a
configured label.

## How Codex was used

Codex was the coding collaborator for this Build Week entry. It scaffolded and
reviewed the clean-room browser/server workflow, generated adversarial contract
and privacy tests, expanded the project from one to two repair jobs, and built
publication scanners. Browser review then exposed a stale confirmed-path bug;
Codex traced it to the client state boundary and added revision guards. A second
review caught that prompt-only multilingual canonicalization could accept a
localized fuel token and then produce zero catalog matches; Codex moved that
contract into schema enums, application validation, and a live synthetic eval.
The repository remains the reviewable source of truth; suggestions were kept only
after the same clean install and gate passed.

## Why GPT-5.6

The intake sentence may be incomplete, written in a variable order, or written in
another language. The same Czech request that leaves four local fields and the job
unresolved becomes a complete canonical prefill through GPT-5.6. The UI makes that
3-of-7 to 7-of-7 delta visible before any catalog option exists.
The architecture deliberately measures model value at the language boundary and
keeps deterministic business rules outside it. `OPENAI_MODEL` remains configurable
so the same tests can compare future model choices without changing the workflow.

## Privacy and safety

- Every repository record is invented; no production or licensed data is present.
- The UI tells users not to enter identifiers or personal data.
- Sensitive-shaped input is rejected before both local and optional model parsing.
- The OpenAI request is stateless with `store: false` and no retry.
- A stable-in-session anonymous ID is HMAC-hashed server-side for abuse safety.
- No free text, model output, vehicle selection, or issue note is logged or stored.
- Human confirmation is mandatory, token-bound, one-use, and separately tested.
- Editing any reviewed field invalidates the visible options and confirmed path.
- The output is explicitly not repair or fitment advice.

## What is technically interesting

The innovation is the boundary, not a bigger prompt. The model handles ambiguous
language; deterministic code owns identity, merging, precedence, provenance, and
the final gate. A signed review token binds what the person saw to what the server
will confirm, while client revisions prevent stale responses from restoring an old
decision. This makes every transition observable and testable. The deterministic
fallback isolates API value from core workflow correctness without making GPT-5.6
decorative.

## Reproducibility

```bash
npm install
npm run check
npm start
```

Open [the local demo](http://localhost:4173), click **Parse locally**, review the
prefill, find options, select one, and confirm it. For the recorded path, keep the
server-side key and safety salt in an environment file outside the clone, export
its absolute path as `OPENAI_ENV_FILE`, run `npm run eval:ai`, and then run
`npm run start:ai` before using the live GPT-5.6 button. The launcher rejects
relative or in-repository files, so no secret reaches browser code or the
repository.

## Suggested submission fields

**Track:** Work and Productivity

**Repository URL:** `https://github.com/pineyaaard/repair-intelligence-reference`

**Demo video URL:** Supplied directly in the Devpost submission after the final
recording is reviewed.

**/feedback Session ID:** Supplied directly in the Devpost submission from the
final `/feedback` response.

**Built with:** Node.js 20, browser-native JavaScript, OpenAI Responses API,
GPT-5.6, Structured Outputs, Codex

**Team:** Supplied directly in the Devpost submission.

## Evidence for judges

1. The live Czech request shows a measured 3/7 local baseline and 7/7 GPT-5.6
   Structured Output together with the served model.
2. The browser shows the editable prefill before source options exist.
3. A direct, stale, expired, or replayed confirmation token receives a conflict.
4. Editing any reviewed value clears the old options and confirmed path.
5. Duplicate provenance and a distinct variant appear together in the union.
6. Front and rear jobs build separate confirmed paths.
7. A note submitted through “Report an issue” is absent from the returned receipt.
8. `npm run check` proves the contract, privacy controls, and publication scans.

## Final owner checks before submission

- Verify current program eligibility and submit before **21 Jul 2026 17:00 PDT
  / 22 Jul 2026 02:00 CEST**.
- Upload the under-three-minute video as **Public** on YouTube, not Unlisted.
- Confirm the repository and video links point to the reviewed clean-room revision.
- Paste the reviewed public repository and video links into Devpost, then paste
  the exact Session ID returned by `/feedback`; do not guess or reuse a value.
- Use only synthetic UI footage from this repository.
- Confirm the live eval passed and the served GPT-5.6 model is visible in the
  recorded segment.
- Do not imply real fitment coverage, production deployment, customers, revenue,
  licensed catalog access, or performance benchmarks.
