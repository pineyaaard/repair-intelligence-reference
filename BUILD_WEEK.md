# OpenAI Build Week Submission Package

This document contains concise, reproducible submission copy. Add only the final
repository and video links after they are reviewed. Do not add production claims,
customer names, private screenshots, or non-synthetic assets.

## Built during the Submission Period

This clean-room synthetic reference app was built on **18 Jul 2026** during the
Submission Period. It was newly written for this entry and contains no production
source, licensed catalog data, real customer data, or production-derived assets.

## Project name

**Repair Intelligence Reference**

## Track

**Work and Productivity**

## One-line description

A human-confirmed repair-intelligence workflow where GPT-5.6 can structure an
incomplete vehicle request, while deterministic code preserves catalog variants,
source provenance, and a privacy-safe decision boundary.

## Short pitch

Repair intake begins in natural language, but catalog selection demands exactness.
Repair Intelligence Reference keeps those responsibilities separate. GPT-5.6
optionally turns a generic vehicle-and-job sentence into a strict, editable
prefill. A person must then review the fields and select an exact synthetic option.
Only after that confirmation does deterministic code merge source records and
build a transparent node-to-part path. The entire experience works offline without
an API key; the model improves intake without becoming a hidden fitment authority.

## The problem

An incomplete service request has three different uncertainties:

1. What did the person mean?
2. Which exact catalog identity is correct?
3. Which source records and repair nodes support the output?

Treating those as one generative task makes corrections hard to see and source
provenance easy to lose. A safer product needs language understanding without
silently turning a proposal into a parts decision.

## What we built

- A polished four-stage browser workflow for intake, confirmation, visual repair
  path, and privacy-safe issue reporting.
- An optional GPT-5.6 Responses API adapter with strict Structured Outputs.
- A zero-key deterministic parser so every judge can run the full demo locally.
- A deterministic source-union algorithm that merges exact duplicates, preserves
  distinct variants, applies source precedence, and exposes provenance.
- A hard human-confirmation gate before any repair path can be produced.
- An issue-report path that discards optional raw notes and stores only a generic
  redacted aggregate for human triage.
- Offline tests and publication scanners for secrets and out-of-scope content.

## How OpenAI is used

When enabled, GPT-5.6 is used for one bounded task: translate a short generic
vehicle-and-job description into a fixed JSON schema. The request uses the
Responses API, `text.format` Structured Outputs, `store: false`, low reasoning
effort, and a privacy-preserving server-side `safety_identifier` derived from a
random anonymous browser session. The API key never reaches browser code.

The model output is visibly editable and always has `confirmationRequired: true`.
It cannot select an option, access source fixtures, construct the union, create a
repair path, submit an issue, or perform an external action.

## How Codex was used

Codex was the coding collaborator for this Build Week entry. It helped implement
and review the clean-room browser and server workflow, write offline contract and
privacy tests, add publication and credential-shape scanners, tighten the
human-confirmation boundary, and prepare the reproducible documentation. The
repository remains the reviewable source of truth; generated suggestions were
kept only after they passed the same local checks as the rest of the code.

## Why GPT-5.6

The intake sentence may be incomplete or written in a variable order, so a capable
model improves structured extraction while the strict schema bounds its output.
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
- Human confirmation is mandatory and separately tested.
- The output is explicitly not repair or fitment advice.

## What is technically interesting

The innovation is the boundary, not a bigger prompt. The model handles ambiguous
language; deterministic code owns identity, merging, precedence, provenance, and
the final gate. This makes every transition observable and testable. The demo also
remains useful when the model is unavailable, which isolates API value from core
workflow correctness.

## Reproducibility

```bash
npm install
npm run check
npm start
```

Open [the local demo](http://localhost:4173), click **Parse locally**, review the
prefill, find options, select one, and confirm it. Optional GPT-5.6 prefill is
enabled only when a server-side key and safety salt are configured.

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

1. The AI button is visibly optional; the same workflow runs without a key.
2. The browser shows the editable prefill before source options exist.
3. A request missing `explicitConfirmation: true` receives a conflict response.
4. Duplicate provenance and a distinct variant appear together in the union.
5. The path shows the node sequence, parts, and contributing sources.
6. A note submitted through “Report an issue” is absent from the returned receipt.
7. `npm run check` proves the contract, privacy controls, and publication scans.

## Final owner checks before submission

- Verify current program eligibility, deadline, required visibility, and video rules.
- Confirm the repository and video links point to the reviewed clean-room revision.
- Paste the reviewed public repository and video links into Devpost, then paste
  the exact Session ID returned by `/feedback`; do not guess or reuse a value.
- Use only synthetic UI footage from this repository.
- Confirm the named model was actually used in the recorded live-AI segment.
- Do not imply real fitment coverage, production deployment, customers, revenue,
  licensed catalog access, or performance benchmarks.
