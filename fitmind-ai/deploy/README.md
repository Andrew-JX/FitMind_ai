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

The confirmed host already has Nginx listening publicly on port 8080. Do not
delete the Lighthouse firewall rule or replace its configuration until the
owner is known.

Run on the Lighthouse terminal:

```bash
sudo systemctl status nginx --no-pager
sudo ss -lntp | grep nginx
sudo nginx -T 2>&1 | grep -n -B 8 -A 20 'listen 8080'
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
```

Save the output. `nginx -T` prints a `configuration file ...` header before
each file; that identifies which installed file owns port 8080.

## 3. Prepare the release checkout

Deploy an reviewed commit or tag, never an uncommitted working tree:

```bash
git clone https://github.com/Andrew-JX/FitMind_ai.git
cd FitMind_ai/fitmind-ai
git checkout <reviewed-release-ref>
cp .env.production.example .env
chmod 600 .env
```

Edit `.env` only on the server. Required distinctions:

```dotenv
# Neon Connect dialog: pooled connection string (`-pooler` hostname)
DATABASE_URL=

# Neon Connect dialog: direct connection string (no `-pooler`)
MIGRATION_DATABASE_URL=

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
2. build commit-tagged API and Web images;
3. run every database migration through the direct Neon connection;
4. verify both `vector` and `public.user_consents` exist;
5. replace the API/Web containers;
6. require healthy loopback responses on ports 3000 and 8081.

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

## 6. Retire port 8080 only after cutover

When the canonical HTTPS site and smoke checklist pass:

1. disable only the preinstalled Nginx file that owns `listen 8080`;
2. run `sudo nginx -t` and reload;
3. confirm `sudo ss -lntp | grep ':8080'` prints nothing;
4. only then delete the Lighthouse firewall rule for public port 8080.

The FitMind Web container uses loopback port 8081; it never needs a Lighthouse
firewall rule.

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
