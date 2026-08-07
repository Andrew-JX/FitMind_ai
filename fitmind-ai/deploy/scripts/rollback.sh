#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 1 || ! "$1" =~ ^[0-9a-f]{7,64}$ ]]; then
  echo "Usage: bash deploy/scripts/rollback.sh <previous-git-sha-image-tag>" >&2
  exit 2
fi

script_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
compose_file="$repo_root/deploy/compose.yaml"
export FITMIND_IMAGE_TAG="$1"

docker image inspect "fitmind-api:$FITMIND_IMAGE_TAG" >/dev/null
docker image inspect "fitmind-web:$FITMIND_IMAGE_TAG" >/dev/null

compose=(docker compose -f "$compose_file")
"${compose[@]}" config --no-env-resolution --quiet
"${compose[@]}" up -d --no-build api web

for attempt in {1..30}; do
  if curl --fail --silent http://127.0.0.1:3000/api/health >/dev/null && \
     curl --fail --silent http://127.0.0.1:8081/healthz >/dev/null; then
    echo "Rolled application containers back to $FITMIND_IMAGE_TAG."
    exit 0
  fi
  sleep 2
done

echo "Rollback containers did not become healthy within 60 seconds." >&2
exit 1
