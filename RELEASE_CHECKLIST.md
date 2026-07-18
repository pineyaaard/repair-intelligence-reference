# Public Release Checklist

Use this checklist immediately before publishing or importing the clean-room
package into an existing public repository.

## Automated gate

```bash
npm install
npm run check
npm run demo
```

- [ ] Public-scope scan passes.
- [ ] Credential-shape scan passes.
- [ ] Unit and local API tests pass.
- [ ] The deterministic browser workflow completes with no `.env` file.
- [ ] The optional AI button remains disabled when no server-side key is present.

## Human diff review

- [ ] Every record, label, screenshot, and example is synthetic and newly written.
- [ ] No production source, commit, branch, log, path, host, address, account,
      credential, person, vehicle identifier, or deployment detail is present.
- [ ] No licensed catalog data, repair method, diagram, price, inventory record,
      supplier label, or derived fitment result is present.
- [ ] The staged file list contains only the intended clean-room package.
- [ ] The repository history contains no secret or private artifact.
- [ ] Competition claims match what can be reproduced from this revision.
- [ ] The ignored private denylist is populated locally and
      `PUBLIC_SCOPE_REQUIRE_PRIVATE_DENYLIST=1 npm run check:public` passes
      without printing or committing its confidential values.

## Optional API review

- [ ] `OPENAI_API_KEY` exists only in a private server environment.
- [ ] A unique `SAFETY_ID_SALT` is set outside version control.
- [ ] `OPENAI_MODEL` is owner-approved and the demo discloses the configured model.
- [ ] The browser bundle contains no secret or environment value.
- [ ] A test request confirms Structured Output, `store: false`, and no raw input logs.
- [ ] The final video visibly shows a successful real GPT-5.6 Structured Output
      prefill; a disabled button, local fallback, mock, or failed request is not used.

## Publication and rollback

1. Create one reviewable commit containing only this package.
2. Run the full gate against that exact commit.
3. Open a draft review before making the repository public.
4. If any private material is found, stop publication, remove it from history,
   rotate the external secret, rerun every check, and follow `SECURITY.md`.
