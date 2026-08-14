#!/usr/bin/env bash
set -Eeuo pipefail

export PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
unset BASH_ENV ENV CDPATH GIT_CONFIG_COUNT

die() {
  echo "$1" >&2
  exit "${2:-1}"
}

parse_release_command() {
  local command="${1:-}"
  if [[ "$command" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  return 1
}

require_test_mode_for_overrides() {
  local name
  for name in \
    FITMIND_DEPLOY_REPO_ROOT \
    FITMIND_DEPLOY_LOCK_FILE \
    FITMIND_DEPLOY_SCRIPT \
    FITMIND_ROLLBACK_SCRIPT \
    FITMIND_DEPLOY_TEST_IMAGES_EXIST; do
    if [[ -n "${!name:-}" && "${FITMIND_DEPLOY_TEST_MODE:-}" != '1' ]]; then
      die "Deployment override ${name} is allowed only in test mode." 65
    fi
  done
}

previous_images_exist() {
  local image_tag="$1"
  if [[ "${FITMIND_DEPLOY_TEST_MODE:-}" == '1' ]]; then
    [[ "${FITMIND_DEPLOY_TEST_IMAGES_EXIST:-0}" == '1' ]]
    return
  fi

  docker image inspect "fitmind-api:${image_tag}" >/dev/null 2>&1 &&
    docker image inspect "fitmind-web:${image_tag}" >/dev/null 2>&1
}

main() {
  require_test_mode_for_overrides

  local release_sha
  release_sha="$(parse_release_command "${SSH_ORIGINAL_COMMAND:-}")" ||
    die 'Only "deploy <40-character-main-commit-sha>" is allowed.' 64

  local repo_root="${FITMIND_DEPLOY_REPO_ROOT:-/home/ubuntu/FitMind_ai}"
  local app_root="${repo_root}/fitmind-ai"
  local lock_file="${FITMIND_DEPLOY_LOCK_FILE:-/var/lock/fitmind-github-deploy.lock}"
  local deploy_script="${FITMIND_DEPLOY_SCRIPT:-${app_root}/deploy/scripts/deploy.sh}"
  local rollback_script="${FITMIND_ROLLBACK_SCRIPT:-${app_root}/deploy/scripts/rollback.sh}"

  [[ -d "${repo_root}/.git" ]] || die 'FitMind release checkout is missing.' 66
  [[ -x "$deploy_script" || -f "$deploy_script" ]] ||
    die 'FitMind deploy script is missing.' 66

  exec 9>>"$lock_file"
  flock -n 9 || die 'Another FitMind deployment is already running.' 75

  cd "$repo_root"
  git fetch --quiet --prune origin \
    '+refs/heads/main:refs/remotes/origin/main'
  git cat-file -e "${release_sha}^{commit}" 2>/dev/null ||
    die 'Requested release commit does not exist after fetching origin/main.' 65
  git merge-base --is-ancestor "$release_sha" origin/main ||
    die 'Requested release commit is not part of origin/main.' 65

  local previous_sha previous_tag deploy_status
  previous_sha="$(git rev-parse HEAD)"
  previous_tag="$(git rev-parse --short=12 "$previous_sha")"

  git checkout --quiet --detach "$release_sha"

  if bash "$deploy_script"; then
    echo "DEPLOY_OK ${release_sha}"
    return 0
  else
    deploy_status=$?
  fi

  echo "Deployment failed for ${release_sha}; restoring checkout ${previous_sha}." >&2
  git checkout --quiet --detach "$previous_sha" || true

  if previous_images_exist "$previous_tag"; then
    echo "Attempting image rollback to ${previous_tag}." >&2
    if ! bash "$rollback_script" "$previous_tag"; then
      echo 'Automatic image rollback failed; operator intervention is required.' >&2
    fi
  else
    echo "Previous images ${previous_tag} are unavailable; image rollback skipped." >&2
  fi

  return "$deploy_status"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
