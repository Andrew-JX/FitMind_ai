# fitmind-18z independent integration closeout evidence

Verified: 2026-08-14

- Closeout contract SHA: `b298240`
- Closeout baseline SHA: `c7470c4231687973177a5eff8a5a14fedf04c291`
- Closeout candidate SHA: resolve with
  `git log -1 --format=%H -- fitmind-ai/docs/evidence/fitmind-18z-independent-closeout.md`
- Historical implementation contract: `1f58be4`
- Historical implementation candidate: `c6af4b0`

## Historical candidate audit

The contract and baseline are both ancestors of `c6af4b0`. The original
contract has a zero diff from `1f58be4` to `c6af4b0`. The five repository
implementations plus `repository-source-contract.test.ts`, `pool.test.ts`, and
`transaction-routing.test.ts` are byte-identical from `c6af4b0` through the
closeout baseline.

An exact detached checkout of `c6af4b0` produced:

```text
targeted: 6 files passed, 53 tests passed
server production build: exit 0
repository runtime modules: exercises, index, muscle-groups, users, workouts
```

The historical candidate's exact `pnpm verify` is **not green**. Lint,
formatting, and all three workspace type checks passed, but unit tests ended at
819 passed / 1 failed. The unrelated failure was
`server/src/deploy-workflow.test.ts` with `Missing workflow job: verify`. This
corrects the old Beads note that called 820/820 green while parallel workflow
content was still outside the candidate.

## Negative control

In the detached candidate only, one trailing space was added to the
`FROM exercises e` SQL line. The source-contract test failed exactly one of four
assertions and changed the exercises SHA-256 from
`934c5561488e07b845f590885a086ce2cf649cb4c71abb12aaf70d6c5f854e29` to
`406336aab1e7c1e31873d8927a8101ebe1df518791fc82be95eb753816f2e5cd`.
After restoring that byte, the same file passed 4/4 and `git diff --exit-code`
confirmed a clean detached checkout.

## Integrated closeout candidate

The candidate contains exactly five production files under
`server/src/db/repositories`, all `.ts`; production `.js` and handwritten
`.d.ts` files are zero. The following gates were rerun on the exact integrated
candidate after this evidence was committed:

```text
repository/auth/dictionary/workout targeted suite: 6 files, 53 tests
pnpm verify: 119 Vitest files, 939 tests, 5 monitor tests
pnpm --filter @fitmind/server build: exit 0
```

No database, provider, production service, or external network was used. The
closeout candidate changes only this evidence file and `docs/progress.md`; no
product code, test, workflow, migration, original contract, push, or deployment
is part of the closeout.
