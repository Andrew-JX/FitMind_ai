#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly entrypoint="${script_dir}/deploy-from-github.sh"
readonly installer="${script_dir}/install-github-deploy-key.sh"
tmp_root="$(mktemp -d)"
readonly tmp_root

cleanup() {
  case "$tmp_root" in
    /tmp/* | /var/tmp/*) rm -rf -- "$tmp_root" ;;
    *) echo "Refusing unsafe cleanup path: $tmp_root" >&2 ;;
  esac
}
trap cleanup EXIT

pass_count=0
pass() {
  pass_count=$((pass_count + 1))
  echo "PASS $1"
}

expect_failure() {
  local label="$1"
  shift
  if "$@"; then
    echo "Expected failure: $label" >&2
    exit 1
  fi
  pass "$label"
}

remote="${tmp_root}/remote.git"
seed="${tmp_root}/seed"
checkout="${tmp_root}/checkout"
log_file="${tmp_root}/deploy.log"
lock_file="${tmp_root}/deploy.lock"
deploy_stub="${tmp_root}/deploy-stub.sh"
rollback_stub="${tmp_root}/rollback-stub.sh"

git init --quiet --bare "$remote"
git init --quiet "$seed"
git -C "$seed" config user.name 'FitMind deploy test'
git -C "$seed" config user.email 'deploy-test@example.com'
printf 'base\n' > "${seed}/release.txt"
git -C "$seed" add release.txt
git -C "$seed" commit --quiet -m base
git -C "$seed" branch -M main
git -C "$seed" remote add origin "$remote"
git -C "$seed" push --quiet -u origin main
git --git-dir="$remote" symbolic-ref HEAD refs/heads/main
git clone --quiet "$remote" "$checkout"
base_sha="$(git -C "$checkout" rev-parse HEAD)"

cat > "$deploy_stub" <<'SH'
#!/usr/bin/env bash
set -eu
printf 'DEPLOY %s\n' "$(git rev-parse HEAD)" >> "$DEPLOY_STUB_LOG"
exit "${DEPLOY_STUB_EXIT:-0}"
SH
cat > "$rollback_stub" <<'SH'
#!/usr/bin/env bash
set -eu
printf 'ROLLBACK %s %s\n' "$1" "$(git rev-parse HEAD)" >> "$DEPLOY_STUB_LOG"
SH
chmod +x "$deploy_stub" "$rollback_stub"

run_entrypoint() {
  SSH_ORIGINAL_COMMAND="$1" \
    FITMIND_DEPLOY_TEST_MODE=1 \
    FITMIND_DEPLOY_REPO_ROOT="$checkout" \
    FITMIND_DEPLOY_LOCK_FILE="$lock_file" \
    FITMIND_DEPLOY_SCRIPT="$deploy_stub" \
    FITMIND_ROLLBACK_SCRIPT="$rollback_stub" \
    FITMIND_DEPLOY_TEST_IMAGES_EXIST="${FITMIND_DEPLOY_TEST_IMAGES_EXIST:-0}" \
    DEPLOY_STUB_LOG="$log_file" \
    DEPLOY_STUB_EXIT="${DEPLOY_STUB_EXIT:-0}" \
    bash "$entrypoint"
}

for invalid in \
  '' \
  'shell' \
  "deploy ${base_sha} extra" \
  "rollback ${base_sha}" \
  'deploy ABCDEF0123456789ABCDEF0123456789ABCDEF01'; do
  expect_failure "rejects invalid command: ${invalid:-empty}" run_entrypoint "$invalid"
done
[[ ! -e "$log_file" ]] || [[ ! -s "$log_file" ]]

run_entrypoint "deploy ${base_sha}"
grep -Fxq "DEPLOY ${base_sha}" "$log_file"
pass 'accepts an exact main SHA and reaches deploy'

git -C "$seed" checkout --quiet --orphan side
git -C "$seed" rm --quiet -rf .
printf 'side\n' > "${seed}/side.txt"
git -C "$seed" add side.txt
git -C "$seed" commit --quiet -m side
side_sha="$(git -C "$seed" rev-parse HEAD)"
git -C "$seed" push --quiet origin side
git -C "$checkout" fetch --quiet origin side
expect_failure 'rejects a commit outside origin/main' run_entrypoint "deploy ${side_sha}"

git -C "$seed" checkout --quiet main
printf 'next\n' >> "${seed}/release.txt"
git -C "$seed" add release.txt
git -C "$seed" commit --quiet -m next
next_sha="$(git -C "$seed" rev-parse HEAD)"
git -C "$seed" push --quiet origin main

DEPLOY_STUB_EXIT=42 FITMIND_DEPLOY_TEST_IMAGES_EXIST=1 \
  expect_failure 'failed deploy returns non-zero' run_entrypoint "deploy ${next_sha}"
[[ "$(git -C "$checkout" rev-parse HEAD)" == "$base_sha" ]]
grep -Eq '^ROLLBACK [0-9a-f]{7,12} [0-9a-f]{40}$' "$log_file"
pass 'failure branch restores checkout and reaches image rollback'

exec 8>>"$lock_file"
flock -n 8
expect_failure 'held deployment lock rejects a concurrent run' \
  run_entrypoint "deploy ${base_sha}"
flock -u 8

echo "ALL ${pass_count} DEPLOYMENT TESTS PASSED"

authorized_keys="${tmp_root}/ssh/authorized_keys"
installed_command="${tmp_root}/bin/deploy-fitmind-from-github"
install_lock="${tmp_root}/install.lock"
public_key_file="${tmp_root}/fitmind.pub"
public_key='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFitMindRestrictedDeployKey000000 github-actions-fitmind'

run_installer() {
  FITMIND_INSTALL_TEST_MODE=1 \
    FITMIND_AUTHORIZED_KEYS="$authorized_keys" \
    FITMIND_INSTALLED_COMMAND="$installed_command" \
    FITMIND_INSTALL_LOCK_FILE="$install_lock" \
    bash "$installer" "$1"
}

printf '%s\n' "$public_key" > "$public_key_file"
run_installer "$public_key_file"
grep -Fqx "command=\"${installed_command}\",restrict ${public_key}" "$authorized_keys"
[[ -x "$installed_command" && ! -e "$public_key_file" ]]
pass 'installer adds one forced restricted key and removes the uploaded public key'

printf '%s\n' "$public_key" > "$public_key_file"
run_installer "$public_key_file"
[[ "$(grep -c 'github-actions-fitmind$' "$authorized_keys")" -eq 1 ]]
pass 'reinstalling the same key remains singular'

printf '%s\n' \
  'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQInvalid github-actions-fitmind' \
  > "$public_key_file"
expect_failure 'installer rejects a non-ed25519 key' run_installer "$public_key_file"

printf '%s\n' \
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOtherRestrictedDeployKey00000 github-actions-fitmind' \
  > "$public_key_file"
expect_failure 'installer refuses to replace an existing deployment key silently' \
  run_installer "$public_key_file"

echo "ALL ${pass_count} DEPLOYMENT AND INSTALLER TESTS PASSED"
