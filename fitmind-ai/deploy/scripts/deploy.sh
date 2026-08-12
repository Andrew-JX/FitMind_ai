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

# Handed to the api container so /api/health can prove which release answers.
release_sha="$(git rev-parse HEAD)"
export FITMIND_RELEASE_SHA="$release_sha"

compose=(docker compose -f "$compose_file")

# Plain `docker compose config` expands env_file values and prints secrets.
"${compose[@]}" config --no-env-resolution --quiet
"${compose[@]}" build api web seed

# Prove this checkout is pointed at the intended database before any migration
# can change schema. Table-existence checks after migration cannot distinguish
# the production database from a newly created empty database, because the
# migration itself creates those tables.
"${compose[@]}" run --rm --no-deps --workdir /app/server api node -e '
const { Client } = require("pg");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be set in fitmind-ai/.env`);
  return value;
}

const runtimeUrl = new URL(required("DATABASE_URL"));
const migrationUrl = new URL(required("MIGRATION_DATABASE_URL"));
const expectedRuntimeHost = required("EXPECTED_DATABASE_HOST").toLowerCase();
const expectedMigrationHost = required("EXPECTED_MIGRATION_DATABASE_HOST").toLowerCase();
const expectedDatabase = required("EXPECTED_DATABASE_NAME");
const runtimeDatabase = decodeURIComponent(runtimeUrl.pathname.slice(1));
const migrationDatabase = decodeURIComponent(migrationUrl.pathname.slice(1));

if (runtimeUrl.hostname.toLowerCase() !== expectedRuntimeHost) {
  throw new Error("DATABASE_URL host does not match EXPECTED_DATABASE_HOST");
}
if (migrationUrl.hostname.toLowerCase() !== expectedMigrationHost) {
  throw new Error("MIGRATION_DATABASE_URL host does not match EXPECTED_MIGRATION_DATABASE_HOST");
}
if (runtimeDatabase !== expectedDatabase || migrationDatabase !== expectedDatabase) {
  throw new Error("Configured database name does not match EXPECTED_DATABASE_NAME");
}

const client = new Client({ connectionString: migrationUrl.toString() });
client.connect()
  .then(() => client.query("SELECT current_database() AS database_name"))
  .then(({ rows }) => {
    if (rows[0]?.database_name !== expectedDatabase) {
      throw new Error("Connected database identity does not match EXPECTED_DATABASE_NAME");
    }
    console.log(`Database target verified before migration: ${expectedMigrationHost}/${expectedDatabase}`);
  })
  .finally(() => client.end());
'

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
      to_regclass($$public.user_consents$$) IS NOT NULL AS has_user_consents,
      to_regclass($$public.menstrual_records$$) IS NOT NULL AS has_menstrual_records,
      to_regclass($$public.personal_health_settings$$) IS NOT NULL AS has_personal_health_settings,
      to_regclass($$public.body_measurements$$) IS NOT NULL AS has_body_measurements,
      to_regclass($$public.training_memos$$) IS NOT NULL AS has_training_memos
  `))
  .then(({ rows }) => {
    const result = rows[0];
    if (
      !result?.has_vector ||
      !result?.has_user_consents ||
      !result?.has_menstrual_records ||
      !result?.has_personal_health_settings ||
      !result?.has_body_measurements ||
      !result?.has_training_memos
    ) {
      throw new Error(`Database prerequisites missing: ${JSON.stringify(result)}`);
    }
    console.log("Database prerequisites verified: vector, consent, and personal-tool tables");
  })
  .finally(() => client.end());
'

"${compose[@]}" up -d --no-build api web

# A 200 alone cannot distinguish this release from the previous containers still
# answering during the swap, so the gate also requires the API to report the
# commit being deployed. A mismatch keeps retrying and then fails the deploy.
health_body=''
expected_health_body="{\"ok\":true,\"data\":{\"status\":\"ok\",\"release\":\"${release_sha}\"}}"
for attempt in {1..30}; do
  if health_body="$(curl --fail --silent http://127.0.0.1:3000/api/health)" && \
     curl --fail --silent http://127.0.0.1:8081/healthz >/dev/null && \
     [[ "$health_body" == "$expected_health_body" ]]; then
    echo "FitMind $image_tag is healthy on loopback ports 3000 and 8081 and reports release $release_sha."
    "${compose[@]}" ps
    exit 0
  fi
  sleep 2
done

"${compose[@]}" ps
echo "Deploy failed: containers did not become healthy and report release $release_sha within 60 seconds." >&2
echo "Last /api/health body: ${health_body:-<none>}" >&2
exit 1
