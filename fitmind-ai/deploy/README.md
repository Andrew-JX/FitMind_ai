# Tencent Cloud Lighthouse deployment

This runbook targets the confirmed production host and database:

- Tencent Cloud Lighthouse, Shanghai Zone 5
- Ubuntu 24.04, Docker 29+, Docker Compose 5+
- `fitmind.jimmyuuu.com` (`www.jimmyuuu.com` redirects to it)
- Neon Free Plan, AWS Singapore

The application server is in mainland China, but PostgreSQL is overseas. Keep
`DATA_RESIDENCY=overseas`; registration must continue to require the separate
cross-border consent.

## 1. Rotate credentials first

Never paste secrets into chat, logs, screenshots, `docker compose config`, or
Git. Rotate a credential immediately if it appears in any of those places.

The server needs newly issued values for:

- Neon database role password / connection strings
- DeepSeek API key
- Voyage API key, if enabled
- `JWT_SECRET` (use at least 32 random bytes)

Changing `JWT_SECRET` invalidates existing login cookies by design.

## 2. Audit the preinstalled Nginx

The confirmed host already has Nginx listening publicly on port 8080. The
2026-08-07 `nginx -T` audit identified its owner as the independent static site
`/etc/nginx/sites-enabled/mj-portfolio`, rooted at `/var/www/mj-portfolio`.
Do not disable or replace that configuration as part of the FitMind deploy.

Run on the Lighthouse terminal:

```bash
sudo systemctl status nginx --no-pager
sudo ss -lntp | grep nginx
sudo nginx -T 2>&1 | grep -n -B 8 -A 20 'listen 8080'
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
```

Save the output. The expected result is `mj-portfolio`; stop if the owner has
changed. Port 8080 and its Lighthouse firewall rule remain a separate operator
decision for that portfolio site.

## 3. Prepare the release checkout

Deploy a reviewed commit or tag, never an uncommitted working tree:

```bash
git clone https://github.com/Andrew-JX/FitMind_ai.git
cd FitMind_ai/fitmind-ai
git checkout <reviewed-release-ref>
cp .env.production.example .env
chmod 600 .env
```

`deploy.sh` enforces a clean Git worktree before assigning the current commit
SHA to the images. The existing repository `.dockerignore` excludes `.env`,
logs, dependency trees, build outputs, and test artifacts from both image build
contexts. Do not bypass either guard with an ad-hoc build command.

Edit `.env` only on the server. Required distinctions:

```dotenv
# Neon Connect dialog: pooled connection string (`-pooler` hostname)
DATABASE_URL=

# Neon Connect dialog: direct connection string (no `-pooler`)
MIGRATION_DATABASE_URL=

# Exact values used to stop a wrong-database migration before it starts.
EXPECTED_DATABASE_HOST=<pooled-hostname-from-DATABASE_URL>
EXPECTED_MIGRATION_DATABASE_HOST=<direct-hostname-from-MIGRATION_DATABASE_URL>
EXPECTED_DATABASE_NAME=neondb

JWT_SECRET=
DATA_RESIDENCY=overseas
REGISTRATION_INVITE_ONLY=on

VITE_ICP_BEIAN_NUMBER=苏ICP备2026054660号
VITE_PUBLIC_SECURITY_BEIAN_NUMBER=
```

Use the newly rotated provider keys. Do not commit `.env`.

## 4. Build, migrate, verify, and start

From `FitMind_ai/fitmind-ai` on the Lighthouse host:

```bash
bash deploy/scripts/deploy.sh
```

The script deliberately performs this order:

1. validate Compose without expanding `env_file` secrets;
2. build commit-tagged API, Web, and one-shot dictionary seed images;
3. verify both configured hosts, the database name, and `current_database()`;
4. run every database migration through the direct Neon connection;
5. idempotently seed the production muscle/exercise dictionaries;
6. verify `vector`, consent, and all personal-tool tables exist;
7. replace the API/Web containers;
8. require healthy loopback responses on ports 3000 and 8081, and require
   `/api/health` to report the exact commit being deployed.

Step 8 checks release identity, not just liveness. `deploy.sh` exports the
deployed commit as `FITMIND_RELEASE_SHA`, Compose passes it into the API
container, and `GET /api/health` returns it as `data.release` (`null` wherever
the variable is unset, including local runs). A 200 alone cannot tell a new
release from the previous containers still answering during the swap, so the
gate retries until the reported release matches and otherwise fails the deploy.
The endpoint stays out of `docs/api-contract.md` by design — it is deployment
infrastructure, and `server/src/routes/api-contract.test.ts` enforces that.
The release workflow runs
`node --test deploy/scripts/deploy-release-identity.test.mjs` before freezing
the verified SHA; the isolated harness proves a mismatched live response cannot
pass and an exact match can.

For an update after the first installation, fetch and inspect the release, then
deploy the exact reviewed commit rather than an ambiguous moving branch:

```bash
cd ~/FitMind_ai
git fetch origin
git status --short
git log --oneline --decorate -5 origin/main
git checkout --detach <reviewed-commit-sha>
cd fitmind-ai
bash deploy/scripts/deploy.sh
```

Stop if `git status --short` is not empty. The first run after this guardrail is
added also requires the three `EXPECTED_*` values above to be added to the
server-only `.env`.

Do not run plain `docker compose config`: it renders `.env` values into stdout.
The safe validation command is:

```bash
docker compose -f deploy/compose.yaml config --no-env-resolution --quiet
```

## 5. Bootstrap host Nginx and HTTPS

The containers bind only to loopback. Host Nginx is the sole public listener.

Install the reviewed HTTP bootstrap configuration:

```bash
sudo cp deploy/nginx/fitmind-http.conf /etc/nginx/sites-available/fitmind.conf
sudo ln -sfn /etc/nginx/sites-available/fitmind.conf /etc/nginx/sites-enabled/fitmind.conf
sudo nginx -t
sudo systemctl reload nginx
curl --fail http://fitmind.jimmyuuu.com/api/health
```

Install Certbot and request one certificate covering both DNS names:

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx \
  --cert-name fitmind.jimmyuuu.com \
  -d fitmind.jimmyuuu.com \
  -d www.jimmyuuu.com
```

After issuance, install the final HTTPS configuration:

```bash
sudo install -d -m 755 /etc/nginx/snippets
sudo cp deploy/nginx/fitmind-security-headers.conf /etc/nginx/snippets/fitmind-security-headers.conf
sudo cp deploy/nginx/fitmind-https.conf /etc/nginx/sites-available/fitmind.conf
sudo nginx -t
sudo systemctl reload nginx
curl --fail https://fitmind.jimmyuuu.com/api/health
curl --head https://www.jimmyuuu.com
sudo certbot renew --dry-run
```

The final Nginx configuration applies the shared security-header snippet at
both the HTTPS server and `/api/` location scopes. The location must include it
again because its `X-Accel-Buffering` header disables Nginx `add_header`
inheritance. Proxy buffering remains disabled for `/api/`, including assistant
SSE, and every HTTP/`www` request redirects to the canonical HTTPS domain.

The same snippet enforces the production browser policy. Scripts, API/SSE,
fonts, the PWA manifest, and the service worker are same-origin only; frames and
plugins are disabled. `style-src` intentionally retains `'unsafe-inline'`
because the current React UI uses style props and the legal pages contain inline
style blocks. Removing it requires a separate CSS/nonce migration plus browser
evidence, not a header-only edit. Permissions Policy disables camera and
geolocation while allowing microphone access only to the same-origin app for
the existing speech-recognition input. After changing either policy, run the
source regression test, `nginx -t`, and browser smoke including legal pages,
service-worker registration, API/SSE, and speech permission.

## 6. Preserve the independent port 8080 site

`listen 8080` belongs to `mj-portfolio`, not FitMind. Leave its Nginx file and
firewall rule unchanged unless the operator separately decides to retire that
site. FitMind uses public ports 80/443 only; its Web container uses loopback
port 8081 and never needs a Lighthouse firewall rule.

## 7. Roll back application images

List retained commit-tagged images:

```bash
docker image ls 'fitmind-*'
```

Roll back to a previous tag:

```bash
bash deploy/scripts/rollback.sh <previous-git-sha-image-tag>
```

This rolls back application images only. It never reverses database migrations;
schema rollback is a separate, reviewed operation because it can destroy data.

## 8. Enable restricted GitHub Actions deployment

This is a one-time bootstrap. It preserves the migration-first behavior above;
GitHub Actions does not receive `.env`, database credentials, Docker socket
access, or a general server shell.

Generate a dedicated key pair on a trusted operator machine. Do not reuse the
interactive administration key or the static-site deployment key:

```bash
ssh-keygen -t ed25519 -C github-actions-fitmind -f ./fitmind-github-deploy -N ''
```

Copy only the public key to a temporary path on Tencent, check out the reviewed
automation commit, and install it:

```bash
cd ~/FitMind_ai
git fetch origin
git checkout --detach <reviewed-automation-commit>
sudo -v
bash fitmind-ai/deploy/scripts/install-github-deploy-key.sh \
  /tmp/fitmind-github-deploy.pub
```

The installer copies the reviewed entrypoint to
`/usr/local/sbin/deploy-fitmind-from-github`, creates the deployment lock, and
adds exactly one `authorized_keys` entry with `restrict` and a forced command.
The uploaded public-key file is removed. The private key never goes to the
server.

In GitHub Settings → Environments, create `production` and configure all of the
following before enabling deployment:

1. add at least one independent required reviewer and enable prevent
   self-review;
2. restrict deployment branches to `main` only;
3. disable administrator bypass where the repository plan and visibility expose
   that control;
4. save screenshots of the protection rules without showing secret values.

Create these encrypted **production environment Secrets** in
`Andrew-JX/FitMind_ai`:

- `TENCENT_HOST`: the Lighthouse SSH hostname or IP;
- `TENCENT_USER`: `ubuntu` for the confirmed host;
- `TENCENT_DEPLOY_KEY`: the complete dedicated private key;
- `TENCENT_KNOWN_HOSTS`: a separately verified SSH host-key line.

Delete the local private key after the encrypted Secret is confirmed. A push to
`main` then runs `.github/workflows/deploy-tencent.yml`. The `verify` job runs
repository checks, eval, builds, release E2E, and monitor shell tests before it
exports the exact 40-character `GITHUB_SHA`. Only after that job succeeds does
the `deploy` job enter the protected `production` environment and wait for
approval. After approval, SSH sends only
`deploy <needs.verify.outputs.release_sha>`. Environment secrets are not exposed
to the verify job.

The workflow verifies and deploys the same SHA; it does not publish or consume a
deployment artifact or registry image. Playwright uploads remain failure-only
diagnostics. The forced server entrypoint:

1. rejects every other verb, argument shape, or non-`main` commit;
2. serializes deployments with `flock`;
3. fetches and checks out the exact reviewed commit;
4. runs the normal `deploy.sh` database identity, migration, seed, table, and
   health gates;
5. restores the previous checkout and attempts image-only rollback if the
   deploy fails and both previous images still exist.

It never runs a down migration. If schema compatibility is not additive, do not
use automatic image rollback until a separate expand/contract plan is reviewed.

Before enabling the workflow, run the isolated command-boundary test:

```bash
bash fitmind-ai/deploy/scripts/test-deploy-from-github.sh
```

For the first approved run, save evidence that all verify gates completed before
the deploy job changed to `Waiting`, that a different reviewer approved it, and
that the SHA displayed by the verify output equals the SHA received by the
server. Merely referencing `environment: production` is not evidence that
required-reviewer protection was configured.

## 9. Install availability paging and the daily quality digest

The monitor has two deliberately separate outputs:

- `page` covers API/Web container failure, a restart-count increase, three
  consecutive loopback health failures, and a sustained 5xx spike;
- `digest` reports provider/budget fallback, faithfulness flags, calls, cost,
  unknown model prices, and 80% budget pressure once per day. These quality
  metrics never page by themselves.

The default 5xx spike requires at least 10 non-health requests in five minutes,
at least 3 server errors, and a 20% error rate. `/api/health` is excluded from
both numerator and denominator. The monitor uses Node from the deployed API
image to parse JSON logs; it does not require Node to be installed on the host.

Before installation, run both isolated suites from the release checkout:

```bash
node --test deploy/scripts/summarize-monitor-logs.test.mjs
bash deploy/scripts/test-fitmind-monitor.sh
FITMIND_MONITOR_DRY_RUN=1 bash deploy/scripts/fitmind-monitor.sh page
FITMIND_MONITOR_DRY_RUN=1 bash deploy/scripts/fitmind-monitor.sh digest
```

Create a server-only config. The receiver must accept the canonical FitMind JSON
payload; use an internal relay if the final chat provider requires another
schema. Never put this URL in Git or shell output.

```bash
install -m 600 /dev/null ~/.config/fitmind-monitor.env
${EDITOR:-vi} ~/.config/fitmind-monitor.env
```

Required production value:

```dotenv
FITMIND_MONITOR_WEBHOOK_URL=<private-https-receiver>
```

Optional threshold overrides retain all three 5xx conditions:

```dotenv
FITMIND_MONITOR_5XX_MINIMUM_REQUESTS=10
FITMIND_MONITOR_5XX_MINIMUM_ERRORS=3
FITMIND_MONITOR_5XX_MINIMUM_PERCENT=20
FITMIND_MONITOR_HEALTH_FAILURE_THRESHOLD=3
```

Install the user units for the same account that owns the release checkout and
can access Docker:

```bash
install -d -m 700 ~/.config/systemd/user ~/.local/state/fitmind-monitor
install -m 644 deploy/systemd/fitmind-monitor@.service ~/.config/systemd/user/
install -m 644 deploy/systemd/fitmind-monitor-page.timer ~/.config/systemd/user/
install -m 644 deploy/systemd/fitmind-monitor-digest.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now fitmind-monitor-page.timer fitmind-monitor-digest.timer
sudo loginctl enable-linger "$USER"
```

The page timer runs every minute; the digest timer runs daily at 09:00 in the
host timezone. Inspect without exposing the webhook URL:

```bash
systemctl --user list-timers 'fitmind-monitor-*'
journalctl --user -u 'fitmind-monitor@*' --since today --no-pager
```

Do not call monitoring installed until a controlled test proves one firing
notification, deduplication on the next run, one recovery, and a digest at the
receiver. A real image rollback drill remains separate: deploy a reviewed SHA,
roll back to the retained previous tag, verify health, and then roll forward.
