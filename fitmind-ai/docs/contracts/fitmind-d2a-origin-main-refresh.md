# fitmind-d2a — deployment origin/main refresh contract

Contract SHA: this file's first committed revision. After that revision is
committed, this file is frozen; implementation commits must not modify it.

Baseline SHA: `70b8d68d810c318e6a8bbe7ef17b740f62a22854`

Candidate SHA: empty before implementation.

Allowed repository files after this contract is frozen:

- `fitmind-ai/deploy/scripts/deploy-from-github.sh`
- `fitmind-ai/deploy/scripts/test-deploy-from-github.sh`
- `fitmind-ai/deploy/README.md`
- `fitmind-ai/docs/progress.md`

Allowed external changes:

- read-only inspection of GitHub Actions, GitHub environment metadata, and the
  existing Tencent production host;
- refresh of `refs/remotes/origin/main` in the existing controlled checkout;
- root-owned replacement of `/usr/local/sbin/deploy-fitmind-from-github` with
  the candidate script after its isolated regression test passes;
- push of the accepted implementation candidate to `origin/main` and
  observation of its GitHub Actions run.

Production deployment is not allowed until the fixed candidate has passed the
verification job, the server entrypoint has been proven to match the candidate,
and the GitHub deploy job is waiting for the repository owner's approval.

## Acceptance criteria

1. **Machine / exact tracking-ref refresh.** The forced deployment entrypoint
   fetches `refs/heads/main` into `refs/remotes/origin/main` with an explicit
   refspec before checking existence and ancestry of the requested SHA.
   `git merge-base --is-ancestor <sha> origin/main` remains the authorization
   check.
   - Negative assertion: fetching only into `FETCH_HEAD`, validating against a
     moving remote name without refreshing its tracking ref, or removing the
     ancestry check does not satisfy this criterion.

2. **Machine / stale-ref regression.** The shell test advances the test
   remote's `main` after cloning, proves the checkout's `origin/main` is still
   the old SHA, invokes the entrypoint for the new SHA, and then proves both
   that deployment reached the new SHA and that `origin/main` advanced to it.
   - Negative assertion: manually refreshing `origin/main` in test setup,
     asserting only `FETCH_HEAD`, or testing only the commit present at clone
     time is a false green.

3. **Machine / boundary preservation.** Existing tests continue to reject
   malformed commands and commits outside `origin/main`, restore the previous
   checkout and invoke image rollback after a failed deploy, reject concurrent
   deployment, and preserve the single restricted installer-key behavior.
   - Negative assertion: weakening or deleting an existing negative case to
     make the new regression pass fails this criterion.

4. **Machine / repository verification.** `pnpm verify`, `pnpm eval`, both
   production builds, and release E2E pass on the implementation candidate.
   The GitHub verification job must also pass all existing verification,
   evaluation, build, release-E2E, monitor, and release-identity gates.
   - Negative assertion: a local shell-test pass alone, or a GitHub run for a
     different SHA, does not satisfy this criterion.

5. **Machine / installed-entrypoint proof.** Before another human approval,
   the isolated deployment/installer test passes on Ubuntu using the candidate
   files; the installed root-owned forced command is byte-identical to the
   candidate entrypoint; the controlled checkout has the candidate in its
   refreshed `origin/main`; and the production checkout and public health
   remain on the previously healthy release.
   - Negative assertion: installing before the regression passes, leaving the
     checkout on the candidate, or changing running containers before approval
     fails this criterion.

6. **Human / one final approval.** Only after criteria 1–5 pass may the owner be
   asked to approve the fixed candidate's waiting `Production` deployment. A
   rerun of failed attempt #5 is not used because it targets the unfixed SHA.
   After approval, success requires the workflow to finish successfully and
   public health plus the server checkout to report the exact fixed SHA.
   - Negative assertion: asking the owner to approve before the fixed run is
     waiting, approving on the owner's behalf, or accepting a green deploy job
     without exact-SHA production evidence does not satisfy this criterion.

## Conflict and qualifier check

No conflict: this bug-fix contract does not modify the frozen single-maintainer
confirmation contract. It repairs the server-side implementation needed to
enforce that contract's existing exact-SHA and `origin/main` boundary.

- “previously healthy release” is
  `8612bdd2d94e5c29a40e7f1343e904cc1f9e1adb`, confirmed after failed attempt
  #5 by the public `/api/health` release field and the production checkout.
- “byte-identical” means the candidate blob and installed file have the same
  SHA-256 digest.
