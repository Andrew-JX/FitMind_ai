# fitmind-18z — independent integration closeout contract

Contract SHA: this file's first committed revision. After that revision is
committed, the file is frozen and the evidence candidate must not modify it.

Baseline SHA: `c7470c4231687973177a5eff8a5a14fedf04c291`.

Historical implementation contract: `1f58be4`.
Historical implementation baseline: `4138b1e`.
Historical implementation candidate: `c6af4b0`.

The historical candidate's repository-specific tests and server build pass, but
an exact checkout does not pass the frozen full-repository gate: one unrelated
deployment-workflow test fails because the workflow split was not part of that
candidate. The old Beads note that reported 820/820 relied on parallel working
tree content and must not be reused as candidate evidence.

This contract does not rewrite or relax that history. It defines a new,
state-based independent closeout after the implementation has been integrated
with the later workflow fixes.

Allowed files after this contract is frozen:

- `fitmind-ai/docs/evidence/fitmind-18z-independent-closeout.md`
- `fitmind-ai/docs/progress.md`

No product, test, configuration, workflow, migration, or original contract file
may change in the evidence candidate.

## Acceptance criteria

1. The original implementation contract is an ancestor of `c6af4b0`, and its
   bytes are unchanged between `1f58be4` and `c6af4b0`.
2. The repository implementation and its owned tests are byte-identical between
   `c6af4b0` and the closeout baseline. Any later repository behavior change
   requires a new implementation review instead of this state-based closeout.
3. An exact detached checkout of `c6af4b0` passes the repository source
   contract, pool, transaction-routing, auth, dictionary, and workout service
   suite, and the server production build emits the five expected repository
   runtime modules. Its unrelated full-verify failure is recorded verbatim and
   is not called green.
4. A SQL-fingerprint negative control in the detached checkout changes one SQL
   byte, makes the source-contract test fail on the expected file/hash, is then
   restored, and the checkout returns to a zero-diff state.
5. On the closeout evidence candidate, `db/repositories` contains exactly five
   production `.ts` modules and no production `.js` or handwritten `.d.ts`;
   repository source-contract, pool, transaction, auth, dictionary, and workout
   tests pass; `pnpm verify` and the server production build exit zero.
6. The evidence candidate changes only the two allowed documentation files,
   leaves the frozen contracts untouched, does not connect to a database or
   network service, and is not pushed or deployed.

## Decision rule

Any repository blob drift, task-owned test drift, failed targeted test, failed
current full gate, product-code change in the closeout candidate, or mutation of
a frozen contract rejects closeout. The historical full-verify discrepancy is
not itself waived; it is preserved as a process finding and replaced only by a
new exact integrated-candidate run.
