# Demo Video Script (2:42 target, hard cap 3:00)

Record only the synthetic browser UI, a clean test result, and a brief safe view
of the primary Codex build task. Keep personal tabs, environment values,
notifications, private repositories, and production systems out of frame. Use
1280×720 or higher at 30 fps. Do not use copyrighted music.

The GPT-5.6 segment must be a real completed API response. Run the live synthetic
eval before recording; do not use a mock, fallback result, or configured model
label as proof. The UI must show the served model returned by the response.

## Synthetic camera inputs

English baseline already present in the textarea:

```text
brand-a series-1 2017 2.0 diesel 190 hp automatic; front brake service
```

Czech contrast sample:

```text
potřebuji přední brzdy: brand-a series-1, rok 2017, nafta, objem dva litry, 190 koní, automat
```

Show this English subtitle while the Czech text is on screen:

```text
Need front brakes for brand-a series-1, 2017, diesel, two liters, 190 hp, automatic.
```

## 0:00–0:12 — Problem, audience, promise

**Screen:** Hero, synthetic-data badge, and four-stage navigation.

**Voice:** “Workshop requests arrive as incomplete sentences, but parts desks
need exact identity. Repair Intelligence Reference uses GPT-5.6 for multilingual
intake while deterministic evidence and one human decision protect the catalog
choice.”

## 0:12–0:42 — Measurable GPT-5.6 moment

**Screen:** Paste the Czech sample and show its English subtitle. Click **Parse
locally**: make, model, and year fill; four fields remain visibly unresolved and
the job needs confirmation. Then click **Prefill with GPT-5.6**. Hold on the live
served-model card showing `3/7 local fields → 7/7 structured fields`, the resolved
field names, and the populated editable form.

**Voice:** “The local baseline understands only three of seven fields. On the
same Czech request, a real GPT-5.6 Responses API call with strict Structured
Outputs resolves engine, fuel, power, transmission, and the repair job. The
server enforces canonical enums and numeric ranges again after the schema, uses
store false, and never exposes the key to the browser.”

## 0:42–1:10 — Review and hard confirmation gate

**Screen:** Point at the editable fields. Click **Find synthetic options**, hover
both variants and their provenance, choose P1, pause, then confirm.

**Voice:** “Prefill is not fitment. A person can correct every field, compare
both visible variants, and choose one explicitly. The server binds that exact
review to a short-lived, one-use token. A direct, stale, changed, or replayed
confirmation is rejected.”

## 1:10–1:36 — Deterministic path and evidence

**Screen:** Show the confirmed summary, node diagram, three part rows, and source
provenance.

**Voice:** “Only that confirmed review unlocks the deterministic path. Exact
duplicates merge, distinct variants remain visible, and each node and synthetic
part keeps its source evidence. GPT-5.6 is outside this decision.”

## 1:36–1:54 — Second job proves generality

**Screen:** Change the job to **Rear brake service**. The old path must disappear
and show “Review changed.” Search again, reselect P1, confirm, and show the rear
path with different parts.

**Voice:** “Changing the job invalidates the old decision instead of leaving a
stale confirmed path. The second job repeats the same review gate and builds a
different evidence-backed route.”

## 1:54–2:10 — Privacy-safe issue report

**Screen:** Report a catalog-union / missing-option issue. Enter “The expected
variant is missing,” submit, and show the aggregate receipt.

**Voice:** “Issue reporting follows the same boundary. The note is discarded.
Only a generic category, count, and redacted fingerprint remain for human triage;
the report cannot change code automatically.”

## 2:10–2:28 — Verification and concrete Codex contribution

**Screen:** Show the final lines of a clean `npm run check`, then a safe cropped
view of the primary Product Factory Codex task or the README Codex section. Never
show private prompts, paths, tabs, or production details.

**Voice:** “Codex scaffolded and reviewed the browser-server workflow, generated
adversarial contract and privacy tests, traced a stale confirmation-state bug,
and caught a prompt-only canonicalization gap. Those failures became revision
guards, schema and semantic checks, review-token tests, and broader publication
scanners.”

## 2:28–2:42 — Impact and close

**Screen:** Return to the completed UI, then a clean end card: “OpenAI Build Week
· Work and Productivity · GPT-5.6 + Codex.”

**Voice:** “A wrong identity means a returned part, a repeat appointment, and
lost workshop time. AI interprets the request, deterministic code preserves the
evidence, and a person owns the decision.”

## Submission handoff — never narrate placeholders

- **Track:** Work and Productivity
- **Repository:** `https://github.com/pineyaaard/repair-intelligence-reference`
- **Video:** upload to YouTube as **Public**, not Unlisted
- **/feedback Session ID:** obtain from the primary Product Factory build task,
  where most core functionality was created
- **Entrant identity:** provide directly in Devpost
- **Deadline:** 21 Jul 2026 17:00 PDT / 22 Jul 2026 02:00 CEST

All submitted materials must be English or include an English translation. Keep
the working project available through the judging period. Do not claim real
fitment coverage, customers, production deployment, or licensed catalog access.
