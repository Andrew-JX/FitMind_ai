#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
if [[ "$mode" != "page" && "$mode" != "digest" ]]; then
  echo "Usage: fitmind-monitor.sh <page|digest>" >&2
  exit 64
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repository_dir="$(cd -- "$script_dir/../.." && pwd)"
compose_file="$repository_dir/deploy/compose.yaml"
summarizer="$script_dir/summarize-monitor-logs.mjs"
state_dir="${FITMIND_MONITOR_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/fitmind-monitor}"
page_window_minutes="${FITMIND_MONITOR_PAGE_WINDOW_MINUTES:-5}"
digest_window_minutes="${FITMIND_MONITOR_DIGEST_WINDOW_MINUTES:-1440}"
minimum_requests="${FITMIND_MONITOR_5XX_MINIMUM_REQUESTS:-10}"
minimum_errors="${FITMIND_MONITOR_5XX_MINIMUM_ERRORS:-3}"
minimum_error_percent="${FITMIND_MONITOR_5XX_MINIMUM_PERCENT:-20}"
health_failure_threshold="${FITMIND_MONITOR_HEALTH_FAILURE_THRESHOLD:-3}"
dry_run="${FITMIND_MONITOR_DRY_RUN:-0}"
webhook_url="${FITMIND_MONITOR_WEBHOOK_URL:-}"
use_host_node="${FITMIND_MONITOR_USE_HOST_NODE:-0}"
compose=(docker compose -f "$compose_file")

mkdir -p -- "$state_dir"
chmod 700 -- "$state_dir"
exec 9>"$state_dir/monitor.lock"
if ! flock -n 9; then
  exit 0
fi

temporary_files=()
cleanup() {
  local path
  for path in "${temporary_files[@]}"; do
    rm -f -- "$path"
  done
}
trap cleanup EXIT

make_temporary_file() {
  temporary_file="$(mktemp "$state_dir/monitor.XXXXXX")"
  chmod 600 -- "$temporary_file"
  temporary_files+=("$temporary_file")
}

inspect_service() {
  local service="$1"
  local container_id
  container_id="$("${compose[@]}" ps -q "$service")"
  if [[ -z "$container_id" ]]; then
    printf 'missing|none|0|\n'
    return
  fi

  docker inspect \
    --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.RestartCount}}|{{.Config.Image}}' \
    "$container_id"
}

run_summarizer() {
  local input_file="$1"
  shift

  if [[ "$use_host_node" == "1" ]]; then
    node "$summarizer" "$@" <"$input_file"
    return
  fi

  if [[ -z "${api_image:-}" ]]; then
    echo "Cannot run monitor summarizer without the current API image" >&2
    return 1
  fi

  docker run --rm -i \
    --pull never \
    --network none \
    --read-only \
    --volume "$summarizer:/fitmind-monitor.mjs:ro" \
    --entrypoint node \
    "$api_image" \
    /fitmind-monitor.mjs "$@" <"$input_file"
}

deliver_payload() {
  local payload="$1"

  if [[ "$dry_run" == "1" ]]; then
    printf '%s\n' "$payload"
    return
  fi

  if [[ -z "$webhook_url" ]]; then
    echo "FITMIND_MONITOR_WEBHOOK_URL is required unless dry-run is enabled" >&2
    return 1
  fi

  curl --fail --silent --show-error --max-time 10 \
    --header 'content-type: application/json' \
    --data-binary "$payload" \
    "$webhook_url" >/dev/null
}

alerts=()
add_alert() {
  local candidate="$1"
  local existing
  for existing in "${alerts[@]}"; do
    if [[ "$existing" == "$candidate" ]]; then
      return
    fi
  done
  alerts+=("$candidate")
}

alerts_json() {
  local result=""
  local alert
  for alert in "$@"; do
    if [[ ! "$alert" =~ ^[a-z0-9_]+$ ]]; then
      echo "Invalid monitor alert key" >&2
      return 1
    fi
    if [[ -n "$result" ]]; then
      result+=","
    fi
    result+="\"$alert\""
  done
  printf '[%s]' "$result"
}

read_page_state() {
  previous_api_restart=-1
  previous_web_restart=-1
  consecutive_health_failures=0
  previous_active_keys=""

  local state_file="$state_dir/page.state"
  if [[ ! -f "$state_file" ]]; then
    return
  fi

  local key value
  while IFS='=' read -r key value; do
    case "$key" in
      api_restart)
        [[ "$value" =~ ^[0-9]+$ ]] && previous_api_restart="$value"
        ;;
      web_restart)
        [[ "$value" =~ ^[0-9]+$ ]] && previous_web_restart="$value"
        ;;
      health_failures)
        [[ "$value" =~ ^[0-9]+$ ]] && consecutive_health_failures="$value"
        ;;
      active_keys)
        [[ "$value" =~ ^([a-z0-9_]+(,[a-z0-9_]+)*)?$ ]] && previous_active_keys="$value"
        ;;
    esac
  done <"$state_file"
}

write_page_state() {
  local api_restart="$1"
  local web_restart="$2"
  local health_failures="$3"
  local active_keys="$4"
  local temporary_state
  make_temporary_file
  temporary_state="$temporary_file"

  printf 'api_restart=%s\nweb_restart=%s\nhealth_failures=%s\nactive_keys=%s\n' \
    "$api_restart" "$web_restart" "$health_failures" "$active_keys" \
    >"$temporary_state"
  mv -f -- "$temporary_state" "$state_dir/page.state"
}

collect_logs() {
  local window_minutes="$1"
  local output_file="$2"
  "${compose[@]}" logs --no-color --since "${window_minutes}m" api >"$output_file"
}

run_page() {
  local api_status api_health api_restart
  local web_status web_health web_restart web_image
  IFS='|' read -r api_status api_health api_restart api_image < <(inspect_service api)
  IFS='|' read -r web_status web_health web_restart web_image < <(inspect_service web)
  void_web_image="$web_image"
  : "$void_web_image"

  [[ "$api_restart" =~ ^[0-9]+$ ]] || api_restart=0
  [[ "$web_restart" =~ ^[0-9]+$ ]] || web_restart=0
  read_page_state

  if [[ "$api_status" != "running" ]]; then
    add_alert "api_not_running"
  elif [[ "$api_health" == "unhealthy" ]]; then
    add_alert "api_container_unhealthy"
  fi
  if [[ "$web_status" != "running" ]]; then
    add_alert "web_not_running"
  elif [[ "$web_health" == "unhealthy" ]]; then
    add_alert "web_container_unhealthy"
  fi

  if (( previous_api_restart >= 0 && api_restart > previous_api_restart )); then
    add_alert "api_restarted"
  fi
  if (( previous_web_restart >= 0 && web_restart > previous_web_restart )); then
    add_alert "web_restarted"
  fi

  if curl --fail --silent --show-error --max-time 5 \
    http://127.0.0.1:3000/api/health >/dev/null; then
    consecutive_health_failures=0
  else
    consecutive_health_failures=$((consecutive_health_failures + 1))
  fi
  if (( consecutive_health_failures >= health_failure_threshold )); then
    add_alert "api_health_consecutive_failure"
  fi

  if [[ "$api_status" == "running" && -n "$api_image" ]]; then
    local log_file page_result page_key
    make_temporary_file
    log_file="$temporary_file"
    collect_logs "$page_window_minutes" "$log_file"
    page_result="$(run_summarizer \
      "$log_file" page \
      --minimum-requests "$minimum_requests" \
      --minimum-errors "$minimum_errors" \
      --minimum-error-percent "$minimum_error_percent")"
    page_key="${page_result%%$'\t'*}"
    if [[ "$page_key" == "http_5xx_spike" ]]; then
      add_alert "$page_key"
    elif [[ -n "$page_key" ]]; then
      echo "Unexpected page result from monitor summarizer" >&2
      return 1
    fi
  fi

  local current_active_keys
  current_active_keys="$(IFS=,; printf '%s' "${alerts[*]}")"

  if [[ "$current_active_keys" != "$previous_active_keys" ]]; then
    local payload
    if (( ${#alerts[@]} > 0 )); then
      payload="$(printf \
        '{"schema_version":1,"source":"fitmind","tier":"paging","status":"firing","alerts":%s}' \
        "$(alerts_json "${alerts[@]}")")"
    else
      local resolved=()
      IFS=',' read -r -a resolved <<<"$previous_active_keys"
      payload="$(printf \
        '{"schema_version":1,"source":"fitmind","tier":"paging","status":"recovered","alerts":%s}' \
        "$(alerts_json "${resolved[@]}")")"
    fi

    if ! deliver_payload "$payload"; then
      write_page_state \
        "$api_restart" "$web_restart" "$consecutive_health_failures" \
        "$previous_active_keys"
      return 1
    fi
  fi

  write_page_state \
    "$api_restart" "$web_restart" "$consecutive_health_failures" \
    "$current_active_keys"
}

run_digest() {
  local api_status api_health api_restart
  IFS='|' read -r api_status api_health api_restart api_image < <(inspect_service api)
  void_api_state="$api_status$api_health$api_restart"
  : "$void_api_state"

  local log_file payload
  make_temporary_file
  log_file="$temporary_file"
  collect_logs "$digest_window_minutes" "$log_file"
  payload="$(run_summarizer \
    "$log_file" digest --window-minutes "$digest_window_minutes")"
  deliver_payload "$payload"
}

if [[ "$mode" == "page" ]]; then
  run_page
else
  run_digest
fi
