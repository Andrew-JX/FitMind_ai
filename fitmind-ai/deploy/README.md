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
8. require healthy loopback responses on ports 3000 and 8081.

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
sudo cp deploy/nginx/fitmind-https.conf /etc/nginx/sites-available/fitmind.conf
sudo nginx -t
sudo systemctl reload nginx
curl --fail https://fitmind.jimmyuuu.com/api/health
curl --head https://www.jimmyuuu.com
sudo certbot renew --dry-run
```

The final Nginx configuration disables proxy buffering for `/api/`, including
assistant SSE, and redirects every HTTP/`www` request to the canonical HTTPS
domain.

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

Create these encrypted repository Secrets in `Andrew-JX/FitMind_ai`:

- `TENCENT_HOST`: the Lighthouse SSH hostname or IP;
- `TENCENT_USER`: `ubuntu` for the confirmed host;
- `TENCENT_DEPLOY_KEY`: the complete dedicated private key;
- `TENCENT_KNOWN_HOSTS`: a separately verified SSH host-key line.

Delete the local private key after the encrypted Secret is confirmed. A push to
`main` then runs `.github/workflows/deploy-tencent.yml`: repository verification
and production builds run on GitHub, after which SSH sends only
`deploy <github.sha>`. The forced server entrypoint:

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
