#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
compose_file="$repo_root/deploy/compose.yaml"

cd "$repo_root"

if [[ ! -f .env ]]; then
  echo "Missing $repo_root/.env. Copy .env.production.example and fill secrets on the server." >&2
  exit 1
fi

# Images are tagged with HEAD below, so a dirty checkout would make that tag a
# lie and could not be reproduced during rollback. `.env` is ignored by Git and
# is therefore intentionally absent from this check.
if [[ -n "$(git status --porcelain --untracked-files=all)" ]]; then
  echo "Deploy refused: the release checkout contains uncommitted or untracked files." >&2
  echo "Commit, remove, or explicitly ignore them before deploying." >&2
  git status --short >&2
  exit 1
fi

image_tag="$(git rev-parse --short=12 HEAD)"
export FITMIND_IMAGE_TAG="$image_tag"

compose=(docker compose -f "$compose_file")

# Plain `docker compose config` expands env_file values and prints secrets.
"${compose[@]}" config --no-env-resolution --quiet
"${compose[@]}" build api web seed

# The consent gate reads user_consents on every authenticated request. A failed
# migration must stop the deploy before the new API container is replaced.
"${compose[@]}" run --rm --no-deps migrate
"${compose[@]}" run --rm --no-deps seed

"${compose[@]}" run --rm --no-deps --workdir /app/server api node -e '
const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.query(`
    SELECT
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = $$vector$$) AS has_vector,
      to_regclass($$public.user_consents$$) IS NOT NULL AS has_user_consents
  `))
  .then(({ rows }) => {
    const result = rows[0];
    if (!result?.has_vector || !result?.has_user_consents) {
      throw new Error(`Database prerequisites missing: ${JSON.stringify(result)}`);
    }
    console.log("Database prerequisites verified: vector + user_consents");
  })
  .finally(() => client.end());
'

"${compose[@]}" up -d --no-build api web

for attempt in {1..30}; do
  if curl --fail --silent http://127.0.0.1:3000/api/health >/dev/null && \
     curl --fail --silent http://127.0.0.1:8081/healthz >/dev/null; then
    echo "FitMind $image_tag is healthy on loopback ports 3000 and 8081."
    "${compose[@]}" ps
    exit 0
  fi
  sleep 2
done

"${compose[@]}" ps
echo "Deploy failed: containers did not become healthy within 60 seconds." >&2
exit 1
