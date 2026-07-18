# Demo Video Script (2:30 target)

Record only the synthetic browser UI and a final test result. Keep personal tabs,
terminal history, environment values, bookmarks, notifications, and private
repositories out of frame.

## 0:00–0:15 — Problem and promise

**Screen:** Hero and four-stage navigation.

**Voice:** “Repair requests arrive as incomplete sentences, while catalog choices
need exact identity. This demo uses AI for language understanding, but keeps the
final vehicle decision human-confirmed and fully reviewable.”

## 0:15–0:38 — Zero-key path

**Screen:** AI status says offline mode ready. Click **Parse locally**.

**Voice:** “The entire workflow works without an account or API key. A deterministic
local parser creates a proposed prefill, and the interface immediately moves to a
visible review step.”

## 0:38–0:58 — Live GPT-5.6 evidence

**Screen:** Before recording, configure a reviewed server-side key and safety
salt. Return to the top, show the status pill reporting GPT-5.6 available, click
**Prefill with GPT-5.6**, and keep the successful green “Prefill ready via
GPT-5.6 Structured Output” result visible together with the populated editable
fields. A disabled button, local-parser result, mock, or failed request is not
acceptable evidence; do not finalize the video until a real response succeeds.

**Voice:** “When enabled, GPT-5.6 uses the Responses API and strict Structured
Outputs for this bounded extraction step. Requests use store false and a hashed
anonymous safety identifier. The model never sees the synthetic sources and can’t
select an option.”

## 0:58–1:22 — Human confirmation gate

**Screen:** Review the editable fields, click **Find synthetic options**, select
the first card, then pause before the confirm button.

**Voice:** “Prefill is not fitment. A person can correct every field, compare the
visible options, and choose the exact variant. Exact duplicates merge, but source
provenance remains visible and a distinct variant is never hidden.”

## 1:22–1:47 — Visual repair path

**Screen:** Click **Confirm selected option and build path**. Slowly show the
confirmed summary, diagram, parts rows, and provenance.

**Voice:** “Only explicit confirmation unlocks the deterministic repair path. The
result explains the node sequence, synthetic parts, and which sources contributed
each item. The model is outside this decision.”

## 1:47–2:08 — Privacy-safe issue report

**Screen:** Click **Report an issue**, choose catalog union and missing option,
enter “The expected variant is missing,” and submit.

**Voice:** “Issue reporting follows the same boundary. Optional note text is
discarded. The receipt keeps only a generic stage, category, count, redacted
fingerprint, and a human-review state. It cannot auto-fix code.”

## 2:08–2:25 — Verification and Codex

**Screen:** Show a clean `npm run check` result, then the short “How Codex was
used” section in `BUILD_WEEK.md`.

**Voice:** “Offline tests cover the no-key browser API, the confirmation conflict,
strict Structured Output payload, privacy rejection, deterministic source union,
error aggregation, secret scanning, and public-scope scanning. I used Codex to
build and review this clean-room workflow, its tests, safety boundaries, and
submission documentation.”

## 2:25–2:38 — Track and close

**Screen:** Return to the four-stage UI. Show a simple end card: “OpenAI Build
Week · Work and Productivity · GPT-5.6 + Codex.”

**Voice:** “AI interprets the request. Deterministic code preserves the evidence.
A person owns the decision. This is my Work and Productivity track entry.”

## Submission handoff — do not narrate or record placeholders

- **Track:** Work and Productivity
- **Repository URL:** `https://github.com/pineyaaard/repair-intelligence-reference`
- **Demo video URL:** Supplied directly in the Devpost submission.
- **/feedback Session ID:** Supplied directly in the Devpost submission from the
  final `/feedback` response.
- **Entrant identity:** Supplied directly in the Devpost submission.

The Session ID must come from the actual `/feedback` action; do not invent it for
the script or end card. Paste all submission-only values directly into Devpost.
