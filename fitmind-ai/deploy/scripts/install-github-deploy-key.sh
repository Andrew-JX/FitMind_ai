#!/usr/bin/env bash
set -Eeuo pipefail

readonly public_key_file="${1:-}"
readonly key_comment='github-actions-fitmind'
readonly test_mode="${FITMIND_INSTALL_TEST_MODE:-0}"
readonly authorized_keys="${FITMIND_AUTHORIZED_KEYS:-/home/ubuntu/.ssh/authorized_keys}"
readonly installed_command="${FITMIND_INSTALLED_COMMAND:-/usr/local/sbin/deploy-fitmind-from-github}"
readonly forced_command="command=\"${installed_command}\",restrict"
readonly lock_file="${FITMIND_INSTALL_LOCK_FILE:-/var/lock/fitmind-github-deploy.lock}"
script_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly script_dir
readonly source_command="${script_dir}/deploy-from-github.sh"

for override in \
  FITMIND_AUTHORIZED_KEYS \
  FITMIND_INSTALLED_COMMAND \
  FITMIND_INSTALL_LOCK_FILE; do
  if [[ -n "${!override:-}" && "$test_mode" != '1' ]]; then
    echo "Install override ${override} is allowed only in test mode." >&2
    exit 65
  fi
done

[[ -s "$public_key_file" ]] || {
  echo 'Usage: install-github-deploy-key.sh <public-key-file>' >&2
  exit 64
}
[[ -s "$source_command" ]] || {
  echo 'Reviewed deploy-from-github.sh is missing.' >&2
  exit 66
}

public_key="$(tr -d '\r\n' < "$public_key_file")"
readonly public_key
if [[ ! "$public_key" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+\ github-actions-fitmind$ ]]; then
  echo 'Unexpected deployment public key type or comment.' >&2
  exit 65
fi

readonly expected_line="${forced_command} ${public_key}"

if [[ "$test_mode" == '1' ]]; then
  install -D -m 0755 "$source_command" "$installed_command"
  install -D -m 0600 /dev/null "$lock_file"
else
  sudo install -o root -g root -m 0755 "$source_command" "$installed_command"
  sudo install -o ubuntu -g ubuntu -m 0600 /dev/null "$lock_file"
fi

install -d -m 700 "$(dirname -- "$authorized_keys")"
touch "$authorized_keys"
chmod 600 "$authorized_keys"

if grep -q "${key_comment}$" "$authorized_keys"; then
  grep -Fxq "$expected_line" "$authorized_keys" || {
    echo 'A different FitMind deployment key is already installed.' >&2
    exit 65
  }
else
  printf '%s\n' "$expected_line" >> "$authorized_keys"
fi

[[ "$(grep -c "${key_comment}$" "$authorized_keys")" -eq 1 ]]
rm -f -- "$public_key_file"
echo 'RESTRICTED_FITMIND_DEPLOY_KEY_INSTALLED'
