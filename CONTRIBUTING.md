# Contributing

This project is released under the [MIT License](LICENSE). Before submitting a
pull request, confirm that you have the right to contribute the material and
agree that it will be distributed under the same MIT License. Opening an issue
or pull request does not obligate the maintainers to accept it.

## Before proposing a change

1. Keep every vehicle, source, part, path, diagram, issue, and screenshot synthetic.
2. Do not add production code, private names, identifiers, infrastructure,
   credentials, logs, customer material, or licensed/derived catalog content.
3. Preserve the visible prefill review and explicit human-confirmation gate.
4. Keep source union and repair-path generation deterministic.
5. Keep the no-key browser path fully functional.
6. Limit optional network behavior to the reviewed server-side OpenAI adapter.
7. Add a regression test for every behavior change.

## Local gate

```bash
npm install
npm run check
npm start
```

Complete the browser workflow at desktop and narrow mobile widths. If optional
AI behavior changes, use an injected test transport; automated tests must not call
an external API or require a credential.

## Pull request checklist

- [ ] New material is original or clearly licensed for publication.
- [ ] The final diff contains only synthetic, generic content.
- [ ] The no-key experience remains complete.
- [ ] Model output still cannot select or confirm a catalog option.
- [ ] No browser-side secret, third-party script, tracker, or telemetry was added.
- [ ] `npm run check` passes from a clean install.
- [ ] README, security notes, and submission claims match the implementation.

Maintainers may decline a useful change when it weakens the publication boundary,
privacy model, determinism, or human-review invariant.
