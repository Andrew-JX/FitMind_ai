import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

import {
  buildDigestPayload,
  hasHttp5xxSpike,
  parseStructuredLogLines,
  summarizeMonitorLogs,
} from "./summarize-monitor-logs.mjs";

function request(status, path = "/api/workouts") {
  return JSON.stringify({
    event: "http_request_completed",
    method: "GET",
    path,
    status,
    duration_ms: 5,
  });
}

function assistant(fields = {}) {
  return JSON.stringify({
    event: "assistant_turn",
    provider_error_fallback: false,
    budget_fallback: false,
    faithfulness_status: "passed",
    model: "deepseek-v4-flash",
    estimated_cost_usd: 0.01,
    budget_current_calls: 1,
    budget_call_limit: 100,
    budget_current_cost_usd: 0.01,
    budget_cost_limit_usd: 1,
    ...fields,
  });
}

test("parses Compose-prefixed JSON and ignores malformed output", () => {
  const events = parseStructuredLogLines(
    [
      "api-1 | not json",
      `api-1 | ${request(200)}`,
      "api-1 | {broken",
      "[]",
      "",
    ].join("\n"),
  );

  assert.equal(events.length, 1);
  assert.equal(events[0]?.event, "http_request_completed");
});

test("requires all three 5xx thresholds and excludes health traffic", () => {
  const positive = summarizeMonitorLogs(
    [
      ...Array.from({ length: 7 }, () => request(200)),
      ...Array.from({ length: 3 }, () => request(500)),
      ...Array.from({ length: 20 }, () => request(200, "/api/health")),
    ].join("\n"),
  );

  assert.deepEqual(positive.request, {
    count: 10,
    server_error_count: 3,
    server_error_rate: 0.3,
  });
  assert.equal(hasHttp5xxSpike(positive), true);

  const tooFewRequests = summarizeMonitorLogs(
    [
      ...Array.from({ length: 6 }, () => request(200)),
      ...Array.from({ length: 3 }, () => request(500)),
    ].join("\n"),
  );
  const tooFewErrors = summarizeMonitorLogs(
    [
      ...Array.from({ length: 8 }, () => request(200)),
      ...Array.from({ length: 2 }, () => request(500)),
    ].join("\n"),
  );
  const tooLowRate = summarizeMonitorLogs(
    [
      ...Array.from({ length: 18 }, () => request(200)),
      ...Array.from({ length: 3 }, () => request(500)),
    ].join("\n"),
  );

  assert.equal(hasHttp5xxSpike(tooFewRequests), false);
  assert.equal(hasHttp5xxSpike(tooFewErrors), false);
  assert.equal(hasHttp5xxSpike(tooLowRate), false);
});

test("keeps quality and budget signals in a zero-safe daily digest", () => {
  const summary = summarizeMonitorLogs(
    [
      assistant({
        provider_error_fallback: true,
        faithfulness_status: "flagged",
        estimated_cost_usd: 0.02,
        budget_current_calls: 80,
      }),
      assistant({
        budget_fallback: true,
        model: "future-model",
        estimated_cost_usd: null,
        budget_current_cost_usd: 0.9,
      }),
    ].join("\n"),
  );

  assert.deepEqual(summary.assistant, {
    turn_count: 2,
    provider_fallback_count: 1,
    provider_fallback_rate: 0.5,
    budget_fallback_count: 1,
    budget_fallback_rate: 0.5,
    combined_fallback_count: 2,
    combined_fallback_rate: 1,
    faithfulness_flagged_count: 1,
    faithfulness_flagged_rate: 0.5,
    estimated_cost_usd: 0.02,
    unknown_price_count: 1,
    maximum_call_budget_ratio: 0.8,
    maximum_cost_budget_ratio: 0.9,
    approaching_limit: true,
  });
  assert.equal(hasHttp5xxSpike(summary), false);
  assert.deepEqual(buildDigestPayload(summary), {
    schema_version: 1,
    source: "fitmind",
    tier: "digest",
    window_minutes: 1_440,
    metrics: summary.assistant,
  });

  const empty = summarizeMonitorLogs("");
  assert.equal(empty.assistant.turn_count, 0);
  assert.equal(empty.assistant.provider_fallback_rate, 0);
  assert.equal(empty.assistant.faithfulness_flagged_rate, 0);
  assert.equal(Number.isNaN(empty.assistant.estimated_cost_usd), false);
});

test("does not echo unrelated or user-controlled log fields", () => {
  const secret = "must-not-appear";
  const summary = summarizeMonitorLogs(
    `${assistant()}\n${JSON.stringify({ event: "other", body: secret, stack: secret })}`,
  );

  assert.equal(JSON.stringify(summary).includes(secret), false);
});

test("pins rotation, timer cadence, and the pre-SSH shell gate", async () => {
  const [compose, service, pageTimer, digestTimer, workflow] =
    await Promise.all([
      readFile(new URL("../compose.yaml", import.meta.url), "utf8"),
      readFile(
        new URL("../systemd/fitmind-monitor@.service", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../systemd/fitmind-monitor-page.timer", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../systemd/fitmind-monitor-digest.timer", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../../../.github/workflows/deploy-tencent.yml",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  const apiStart = compose.indexOf("\n  api:\n");
  const webStart = compose.indexOf("\n  web:\n");
  assert.ok(apiStart >= 0 && webStart > apiStart);
  const apiBlock = compose.slice(apiStart, webStart);
  const webBlock = compose.slice(webStart);
  for (const block of [apiBlock, webBlock]) {
    assert.match(block, /logging:\n\s+driver: json-file/u);
    assert.match(block, /max-size: "10m"/u);
    assert.match(block, /max-file: "5"/u);
  }
  assert.match(service, /ExecStart=.*fitmind-monitor\.sh %i/u);
  assert.match(pageTimer, /OnUnitActiveSec=1min/u);
  assert.match(digestTimer, /OnCalendar=\*-\*-\* 09:00:00/u);

  const shellGate = workflow.indexOf(
    "Test production monitor command boundary",
  );
  const ssh = workflow.indexOf("Configure restricted deployment key");
  assert.ok(shellGate >= 0 && ssh > shellGate);
});
