/* global Buffer, process */

import { pathToFileURL } from "node:url";

const DEFAULT_PAGE_OPTIONS = Object.freeze({
  minimumRequestCount: 10,
  minimumServerErrorCount: 3,
  minimumServerErrorRate: 0.2,
});

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function rate(numerator, denominator) {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(6));
}

export function parseStructuredLogLines(source) {
  const events = [];

  for (const line of source.split(/\r?\n/u)) {
    const objectStart = line.indexOf("{");
    if (objectStart < 0) {
      continue;
    }

    try {
      const parsed = JSON.parse(line.slice(objectStart));
      if (isRecord(parsed)) {
        events.push(parsed);
      }
    } catch {
      // Docker prefixes and unrelated process output are expected. Only the
      // machine-owned, one-line JSON event schema participates in monitoring.
    }
  }

  return events;
}

function isRequestEvent(event) {
  return (
    event.event === "http_request_completed" &&
    typeof event.method === "string" &&
    typeof event.path === "string" &&
    Number.isInteger(event.status) &&
    event.status >= 100 &&
    event.status <= 599 &&
    asNonNegativeNumber(event.duration_ms) !== null
  );
}

function isAssistantTurnEvent(event) {
  return event.event === "assistant_turn";
}

function maximumRatio(events, currentField, limitField) {
  let maximum = 0;

  for (const event of events) {
    const current = asNonNegativeNumber(event[currentField]);
    const limit = asNonNegativeNumber(event[limitField]);
    if (current !== null && limit !== null && limit > 0) {
      maximum = Math.max(maximum, current / limit);
    }
  }

  return Number(maximum.toFixed(6));
}

export function summarizeMonitorLogs(source) {
  const events = parseStructuredLogLines(source);
  const requests = events.filter(
    (event) => isRequestEvent(event) && event.path !== "/api/health",
  );
  const assistantTurns = events.filter(isAssistantTurnEvent);
  const serverErrorCount = requests.filter(
    (event) => event.status >= 500,
  ).length;
  const providerFallbackCount = assistantTurns.filter(
    (event) => event.provider_error_fallback === true,
  ).length;
  const budgetFallbackCount = assistantTurns.filter(
    (event) => event.budget_fallback === true,
  ).length;
  const combinedFallbackCount = assistantTurns.filter(
    (event) =>
      event.provider_error_fallback === true || event.budget_fallback === true,
  ).length;
  const faithfulnessFlaggedCount = assistantTurns.filter(
    (event) => event.faithfulness_status === "flagged",
  ).length;
  const pricedCosts = assistantTurns
    .map((event) => asNonNegativeNumber(event.estimated_cost_usd))
    .filter((value) => value !== null);
  const unknownPriceCount = assistantTurns.filter(
    (event) =>
      typeof event.model === "string" &&
      event.model.length > 0 &&
      event.estimated_cost_usd === null,
  ).length;
  const maximumCallBudgetRatio = maximumRatio(
    assistantTurns,
    "budget_current_calls",
    "budget_call_limit",
  );
  const maximumCostBudgetRatio = maximumRatio(
    assistantTurns,
    "budget_current_cost_usd",
    "budget_cost_limit_usd",
  );

  return {
    request: {
      count: requests.length,
      server_error_count: serverErrorCount,
      server_error_rate: rate(serverErrorCount, requests.length),
    },
    assistant: {
      turn_count: assistantTurns.length,
      provider_fallback_count: providerFallbackCount,
      provider_fallback_rate: rate(
        providerFallbackCount,
        assistantTurns.length,
      ),
      budget_fallback_count: budgetFallbackCount,
      budget_fallback_rate: rate(budgetFallbackCount, assistantTurns.length),
      combined_fallback_count: combinedFallbackCount,
      combined_fallback_rate: rate(
        combinedFallbackCount,
        assistantTurns.length,
      ),
      faithfulness_flagged_count: faithfulnessFlaggedCount,
      faithfulness_flagged_rate: rate(
        faithfulnessFlaggedCount,
        assistantTurns.length,
      ),
      estimated_cost_usd: Number(
        pricedCosts.reduce((sum, value) => sum + value, 0).toFixed(6),
      ),
      unknown_price_count: unknownPriceCount,
      maximum_call_budget_ratio: maximumCallBudgetRatio,
      maximum_cost_budget_ratio: maximumCostBudgetRatio,
      approaching_limit:
        maximumCallBudgetRatio >= 0.8 || maximumCostBudgetRatio >= 0.8,
    },
  };
}

export function hasHttp5xxSpike(summary, options = DEFAULT_PAGE_OPTIONS) {
  return (
    summary.request.count >= options.minimumRequestCount &&
    summary.request.server_error_count >= options.minimumServerErrorCount &&
    summary.request.server_error_rate >= options.minimumServerErrorRate
  );
}

export function buildDigestPayload(summary, windowMinutes = 1_440) {
  return {
    schema_version: 1,
    source: "fitmind",
    tier: "digest",
    window_minutes: windowMinutes,
    metrics: summary.assistant,
  };
}

function readNumberOption(arguments_, name, fallback) {
  const index = arguments_.indexOf(name);
  if (index < 0) {
    return fallback;
  }

  const value = Number(arguments_[index + 1]);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

async function readStandardInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const mode = process.argv[2];
  const arguments_ = process.argv.slice(3);
  const source = await readStandardInput();
  const summary = summarizeMonitorLogs(source);

  if (mode === "page") {
    const options = {
      minimumRequestCount: readNumberOption(
        arguments_,
        "--minimum-requests",
        DEFAULT_PAGE_OPTIONS.minimumRequestCount,
      ),
      minimumServerErrorCount: readNumberOption(
        arguments_,
        "--minimum-errors",
        DEFAULT_PAGE_OPTIONS.minimumServerErrorCount,
      ),
      minimumServerErrorRate:
        readNumberOption(
          arguments_,
          "--minimum-error-percent",
          DEFAULT_PAGE_OPTIONS.minimumServerErrorRate * 100,
        ) / 100,
    };

    if (hasHttp5xxSpike(summary, options)) {
      process.stdout.write(
        `http_5xx_spike\t${summary.request.count}\t${summary.request.server_error_count}\t${summary.request.server_error_rate}\n`,
      );
    }
    return;
  }

  if (mode === "digest") {
    const windowMinutes = readNumberOption(
      arguments_,
      "--window-minutes",
      1_440,
    );
    process.stdout.write(
      `${JSON.stringify(buildDigestPayload(summary, windowMinutes))}\n`,
    );
    return;
  }

  if (mode === "summary") {
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    return;
  }

  throw new Error("Usage: summarize-monitor-logs.mjs <page|digest|summary>");
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "monitor summary failed"}\n`,
    );
    process.exitCode = 1;
  });
}
