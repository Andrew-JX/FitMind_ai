#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
monitor="$script_dir/fitmind-monitor.sh"
test_root="$(mktemp -d)"
cleanup() {
  case "$test_root" in
    /tmp/* | /var/tmp/*) rm -rf -- "$test_root" ;;
    *) echo "Refusing to remove unexpected test path: $test_root" >&2 ;;
  esac
}
trap cleanup EXIT

fake_bin="$test_root/bin"
mkdir -p -- "$fake_bin"

cat >"$fake_bin/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "compose" ]]; then
  shift
  while [[ "$1" != "ps" && "$1" != "logs" ]]; do shift; done
  operation="$1"
  shift
  if [[ "$operation" == "ps" ]]; then
    [[ "${*: -1}" == "api" ]] && printf 'api-id\n' || printf 'web-id\n'
  else
    cat -- "$FAKE_LOG_FILE"
  fi
  exit 0
fi
if [[ "$1" == "inspect" ]]; then
  container_id="${*: -1}"
  if [[ "$container_id" == "api-id" ]]; then
    printf '%s|%s|%s|fitmind-api:test\n' \
      "${FAKE_API_STATUS:-running}" "${FAKE_API_HEALTH:-healthy}" \
      "${FAKE_API_RESTART:-0}"
  else
    printf '%s|%s|%s|fitmind-web:test\n' \
      "${FAKE_WEB_STATUS:-running}" "${FAKE_WEB_HEALTH:-healthy}" \
      "${FAKE_WEB_RESTART:-0}"
  fi
  exit 0
fi
echo "unexpected docker call: $*" >&2
exit 1
EOF

cat >"$fake_bin/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == *"127.0.0.1:3000/api/health"* ]]; then
  [[ "${FAKE_HEALTH_FAIL:-0}" != "1" ]]
  exit
fi
printf '%s\n' "$*" >>"$FAKE_WEBHOOK_CALLS"
[[ "${FAKE_WEBHOOK_FAIL:-0}" != "1" ]]
EOF

chmod +x -- "$fake_bin/docker" "$fake_bin/curl"

export PATH="$fake_bin:$PATH"
export FITMIND_MONITOR_USE_HOST_NODE=1
export FITMIND_MONITOR_DRY_RUN=1
export FITMIND_MONITOR_STATE_DIR="$test_root/state"
export FAKE_LOG_FILE="$test_root/api.log"
export FAKE_WEBHOOK_CALLS="$test_root/webhook.calls"
: >"$FAKE_LOG_FILE"
: >"$FAKE_WEBHOOK_CALLS"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

first="$("$monitor" page)"
[[ -z "$first" ]] || fail "healthy baseline must not page"

export FAKE_API_STATUS=exited
firing="$("$monitor" page)"
[[ "$firing" == *'"tier":"paging"'* ]] || fail "stopped API must page"
[[ "$firing" == *'"api_not_running"'* ]] || fail "stopped API key missing"
duplicate="$("$monitor" page)"
[[ -z "$duplicate" ]] || fail "unchanged incident must be deduplicated"

export FAKE_API_STATUS=running
recovered="$("$monitor" page)"
[[ "$recovered" == *'"status":"recovered"'* ]] || fail "recovery missing"
[[ "$recovered" == *'"api_not_running"'* ]] || fail "resolved key missing"

rm -f -- "$FITMIND_MONITOR_STATE_DIR/page.state"
export FAKE_HEALTH_FAIL=1
[[ -z "$("$monitor" page)" ]] || fail "first health failure must not page"
[[ -z "$("$monitor" page)" ]] || fail "second health failure must not page"
third_health="$("$monitor" page)"
[[ "$third_health" == *'"api_health_consecutive_failure"'* ]] || \
  fail "third consecutive health failure must page"

rm -f -- "$FITMIND_MONITOR_STATE_DIR/page.state"
export FAKE_HEALTH_FAIL=0
: >"$FAKE_LOG_FILE"
for _ in 1 2 3 4 5 6 7; do
  printf '%s\n' \
    '{"event":"http_request_completed","method":"GET","path":"/api/workouts","status":200,"duration_ms":5}' \
    >>"$FAKE_LOG_FILE"
done
for _ in 1 2 3; do
  printf '%s\n' \
    '{"event":"http_request_completed","method":"GET","path":"/api/workouts","status":500,"duration_ms":5}' \
    >>"$FAKE_LOG_FILE"
done
spike="$("$monitor" page)"
[[ "$spike" == *'"http_5xx_spike"'* ]] || fail "5xx threshold must page"
[[ -z "$("$monitor" page)" ]] || fail "unchanged 5xx spike must be deduplicated"
: >"$FAKE_LOG_FILE"
spike_recovery="$("$monitor" page)"
[[ "$spike_recovery" == *'"status":"recovered"'* ]] || \
  fail "5xx recovery missing"

rm -f -- "$FITMIND_MONITOR_STATE_DIR/page.state"
printf '%s\n' \
  '{"event":"assistant_turn","provider_error_fallback":true,"budget_fallback":true,"faithfulness_status":"flagged","model":"future","estimated_cost_usd":null,"budget_current_calls":99,"budget_call_limit":100}' \
  >"$FAKE_LOG_FILE"
quality_only="$("$monitor" page)"
[[ -z "$quality_only" ]] || fail "quality signals must never page"
digest="$("$monitor" digest)"
[[ "$digest" == *'"tier":"digest"'* ]] || fail "digest payload missing"
[[ "$digest" == *'"faithfulness_flagged_count":1'* ]] || \
  fail "digest faithfulness metric missing"
[[ "$digest" == *'"approaching_limit":true'* ]] || \
  fail "digest budget pressure missing"

rm -f -- "$FITMIND_MONITOR_STATE_DIR/page.state"
export FAKE_API_RESTART=5
[[ -z "$("$monitor" page)" ]] || fail "first restart observation must baseline"
export FAKE_API_RESTART=6
restart_page="$("$monitor" page)"
[[ "$restart_page" == *'"api_restarted"'* ]] || fail "restart delta must page"

[[ ! -s "$FAKE_WEBHOOK_CALLS" ]] || fail "dry-run must not call the webhook"

export FITMIND_MONITOR_DRY_RUN=0
export FITMIND_MONITOR_WEBHOOK_URL=https://monitor.invalid/hook
export FAKE_WEBHOOK_FAIL=1
export FAKE_API_STATUS=exited
if "$monitor" page >/dev/null 2>&1; then
  fail "webhook delivery failure must return non-zero"
fi

echo "fitmind monitor shell tests passed"
