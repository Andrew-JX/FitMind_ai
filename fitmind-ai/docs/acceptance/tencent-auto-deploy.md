# Tencent Cloud automatic deployment acceptance contract

Baseline SHA: `2689e44`

This file is frozen before implementation. The candidate commit must not modify
it.

## Allowed implementation files

- `.github/workflows/deploy-tencent.yml`
- `fitmind-ai/README.md`
- `fitmind-ai/deploy/README.md`
- `fitmind-ai/deploy/scripts/deploy-from-github.sh`
- `fitmind-ai/deploy/scripts/install-github-deploy-key.sh`
- `fitmind-ai/deploy/scripts/test-deploy-from-github.sh`
- `fitmind-ai/docs/production-smoke-checklist.md`
- `fitmind-ai/docs/progress.md`

## Acceptance criteria

1. **Machine — workflow boundary.** A workflow triggered by `push` to `main`
   and manual dispatch runs repository verification, then invokes one SSH
   command in the exact form `deploy <40-lowercase-hex-SHA>`. It has only
   `contents: read`, non-cancelling production concurrency, a bounded timeout,
   strict known-host checking, and no step that uploads `.env` or repository
   secrets. Verification is by source inspection plus YAML parsing. A false
   green would be an SSH step that can substitute an arbitrary command; the
   negative assertion must reject any command shape other than the fixed deploy
   verb and GitHub SHA.
2. **Machine — forced-command boundary.** The server entrypoint accepts only
   `deploy <40-lowercase-hex-SHA>` from `SSH_ORIGINAL_COMMAND`, holds a
   deployment lock, fetches `origin/main`, verifies that the exact commit exists
   and is an ancestor of `origin/main`, checks it out detached, and calls the
   existing `fitmind-ai/deploy/scripts/deploy.sh`. Invalid verbs, extra
   arguments, malformed SHAs, and a commit outside `origin/main` fail before
   deployment. Verification uses a shell test with temporary local Git remotes;
   string grep alone is insufficient.
3. **Machine — failure recovery.** If deployment fails after checkout, the
   entrypoint restores the previous checkout and attempts the existing
   image-only rollback when both previous commit-tagged images exist. It never
   runs a down migration. A test-mode deployment stub must prove the failure
   branch was reached and the previous checkout restored; merely checking that
   rollback text exists is a false green.
4. **Machine — restricted key installation.** The installer accepts only one
   `ssh-ed25519` public key whose comment is `github-actions-fitmind`, installs
   the reviewed entrypoint as a root-owned executable, and adds exactly one
   authorized-key line with a forced command plus `restrict`. A key with another
   type/comment or a duplicate entry must fail or remain singular.
5. **Machine — repository gates and secret hygiene.** `pnpm verify`, client and
   server production builds, `bash -n` for all new shell files, the deployment
   shell tests, and `git diff --check` return zero. Repository search finds no
   private key block, database credential, or GitHub secret value.
6. **Manual/external — first production run.** After explicit authorization for
   push, GitHub Secrets, and server key installation, the candidate SHA is
   present on `origin/main`; the GitHub Actions run for that SHA succeeds; its
   log contains `DEPLOY_OK <SHA>` without secrets; Tencent containers are
   healthy; `https://fitmind.jimmyuuu.com/api/health` returns 200; and the
   registration policy reports policy `2026-08-09` with invite-only overseas
   configuration. Until those external actions occur this criterion is
   **unverified**, not passed.

## Conflict and qualifier check

- `main` comes from the workflow event and the fetched `origin/main` ref.
- `<SHA>` comes from `github.sha` and must be exactly 40 lowercase hex digits.
- "Previous" means the server checkout's `HEAD` immediately before the forced
  entrypoint checks out the requested SHA.
- Database rollback is explicitly excluded; the existing migration is additive
  and image rollback must remain schema-forward-compatible.
- No criterion authorizes push, secret creation, server mutation, or production
  deployment; those remain a separate explicit approval boundary.
