# fitmind-ytl — single-maintainer verified-release confirmation contract

Contract SHA: this file's first committed revision. After that revision is
committed, this file is frozen; implementation commits must not modify it.

Baseline SHA: `8612bdd2d94e5c29a40e7f1343e904cc1f9e1adb`

Candidate SHA: empty before implementation.

Allowed repository files after this contract is frozen:

- `fitmind-ai/docs/production-smoke-checklist.md`
- `fitmind-ai/deploy/README.md`
- `fitmind-ai/docs/progress.md`

Allowed external changes:

- GitHub `Production` environment settings and its environment-secret values;
- one dedicated `github-actions-fitmind` ed25519 public key and forced-command
  entry on the existing Tencent host;
- a `/home/ubuntu/FitMind_ai` symlink to the existing controlled checkout
  `/opt/fitmind-5c499f3`, and that checkout's `origin` remote changed from the
  temporary local bundle to the public GitHub repository;
- read-only GitHub Actions observation and server verification commands.

This replaces neither the frozen `fitmind-6e8` independent-review contract nor
its historical evidence. The repository has one GitHub user, so an independent
required reviewer and self-review prevention cannot be truthfully configured.
The gate below is a **single-maintainer manual confirmation**, not independent
approval.

## Acceptance criteria

1. **Machine / remote configuration.** The case-insensitive GitHub
   `Production` environment has Andrew-JX as its sole required reviewer,
   `prevent_self_review` is false, the wait timer is exactly 10 minutes,
   custom branch policy admits exactly `main`, and administrator bypass is
   disabled when GitHub exposes that setting to this repository. The recorded
   configuration must not be described as independent review.
   - Negative assertion: a reviewer list alone, a zero wait timer, a policy
     allowing every branch, or prose calling owner self-approval independent
     review does not satisfy this criterion.

2. **Machine / secret boundary.** `TENCENT_HOST`, `TENCENT_USER`,
   `TENCENT_DEPLOY_KEY`, and `TENCENT_KNOWN_HOSTS` exist only as encrypted
   `Production` environment secrets. Evidence may name secrets but never print
   their values, a private key, or a host-key line.
   - Negative assertion: repository-level secrets, plaintext workflow values,
     or an SSH key in Git do not satisfy this criterion.

3. **Machine / server command boundary.** Exactly one authorised-key entry
   ending in `github-actions-fitmind` contains
   `command=\"/usr/local/sbin/deploy-fitmind-from-github\",restrict`; the
   installed command is root-owned and executable; it accepts only
   `deploy <40 lowercase hexadecimal SHA>` that is an ancestor of
   `origin/main`; and it rejects `shell`, extra arguments, uppercase SHAs, and
   non-main commits before `deploy.sh` executes.
   - Negative assertion: a key with an unrestricted shell, a command accepting
     a moving ref, or a parser test without the installed-key boundary does not
     satisfy this criterion.

4. **Machine / release source.** `/home/ubuntu/FitMind_ai` resolves to
   `/opt/fitmind-5c499f3`; that checkout has a GitHub `origin`, and
   `git ls-remote origin refs/heads/main` returns the current public `main`
   SHA. The forced command therefore uses the existing production checkout,
   not a stale temporary bundle.
   - Negative assertion: a symlink to another directory, an unreachable
     `origin`, or the historical `/tmp/*.bundle` remote does not satisfy this
     criterion.

5. **Machine / workflow preservation.** The existing workflow continues to
   complete verify/eval/build/release-E2E/monitor/release-identity gates before
   the deploy job is eligible, and deploy uses only
   `needs.verify.outputs.release_sha`. `pnpm verify`, `pnpm eval`, both
   production builds, and release E2E must pass on the candidate.
   - Negative assertion: moving environment protection to `verify`, using
     `github.sha` in deploy, or treating a deployment artifact as the release
     unit fails this criterion.

6. **Human / deliberately unperformed by the executor.** The next `main`
   workflow must show verify success followed by a deploy job in `Waiting` for
   the 10-minute owner confirmation. Only the repository owner may review the
   verified SHA and approve it; the executor does not approve on the owner's
   behalf. The final production deployment, if the owner approves, is verified
   separately using `DEPLOY_OK`, container SHA labels, and public health.
   - Negative assertion: an automatically deployed run, an agent self-approval,
     or a completed verify job alone is not a confirmed production release.

## Conflict and qualifier check

No conflict: the existing workflow already separates verification from deploy
and preserves SHA semantics. This contract intentionally relaxes only the
impossible *independence* property for a one-user repository; it does not
relax the post-verification wait, exact-SHA boundary, branch restriction,
key restriction, or human confirmation requirement.

- “sole maintainer” is the current GitHub collaborator inventory, verified via
  GitHub repository collaborator listing before remote mutation.
- “current public `main` SHA” is the value returned by `git ls-remote origin
  refs/heads/main` during the server verification.
- “10 minutes” is the GitHub environment wait-timer setting, measured in
  minutes by GitHub.
