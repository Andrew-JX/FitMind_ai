import type { Page, Route } from "@playwright/test";

import { installApiMocks, type ApiMocks } from "./mock-api";

export function jsonData(data: unknown, status = 200) {
  return {
    body: JSON.stringify(
      status >= 400
        ? { ok: false, error: { code: "TEST_FAILURE", message: String(data) } }
        : { ok: true, data },
    ),
    contentType: "application/json",
    status,
  };
}

export async function installEmptyAuthenticatedApp(
  page: Page,
): Promise<ApiMocks> {
  const mocks = await installApiMocks(page, { authenticated: true });

  await page.route("**/api/workouts?**", (route) =>
    route.fulfill(jsonData({ items: [], next_cursor: null })),
  );
  await page.route("**/api/muscle-groups", (route) =>
    route.fulfill(jsonData({ items: [] })),
  );
  await page.route("**/api/exercises**", (route) =>
    route.fulfill(jsonData({ items: [] })),
  );
  await page.route("**/api/training/summary?**", (route) =>
    route.fulfill(jsonData(emptySummary(route))),
  );
  await page.route("**/api/training/muscle-load?**", (route) =>
    route.fulfill(jsonData(emptyMuscleLoad(route))),
  );
  await page.route("**/api/training/assistant-insights?**", (route) =>
    route.fulfill(jsonData(emptyAssistantInsights(route))),
  );
  await page.route("**/api/training/recommendation-context?**", (route) =>
    route.fulfill(jsonData({ recent_workouts: [], recommendation: null })),
  );
  await page.route("**/api/planned-workouts/current", (route) =>
    route.fulfill(jsonData({ plannedWorkout: null })),
  );
  await page.route("**/api/training/weekly-report-digest", (route) =>
    route.fulfill(jsonData({ digest: null })),
  );
  await page.route("**/api/assistant/insights", (route) =>
    route.fulfill(jsonData({ items: [] })),
  );
  await page.route("**/api/body-measurements", (route) =>
    route.fulfill(
      jsonData({
        healthConsentOnFile: false,
        items: [],
        withdrawableHealthConsent: false,
      }),
    ),
  );
  await page.route("**/api/menstrual-records?**", (route) =>
    route.fulfill(
      jsonData({
        dates: [],
        healthConsentOnFile: false,
        showInHistory: false,
        withdrawableHealthConsent: false,
      }),
    ),
  );
  await page.route("**/api/training-memos", (route) =>
    route.fulfill(jsonData({ items: [] })),
  );

  return mocks;
}

function requestRange(route: Route) {
  const query = new URL(route.request().url()).searchParams;
  return {
    end_date: query.get("end_date") ?? "2026-08-14",
    start_date: query.get("start_date") ?? "2026-08-08",
  };
}

function emptySummary(route: Route) {
  return {
    by_exercise: [],
    evidence: { calculation_rules: [], workout_ids: [] },
    range: requestRange(route),
    totals: { set_count: 0, total_reps: 0, total_volume: 0, workout_count: 0 },
  };
}

function emptyMuscleLoad(route: Route) {
  return {
    by_muscle_group: [],
    evidence: { calculation_rules: [], set_ids: [], workout_ids: [] },
    low_volume_muscle_groups: [],
    range: requestRange(route),
    top_muscle_groups: [],
    totals: {
      muscle_group_count: 0,
      set_count: 0,
      total_raw_volume: 0,
      total_reps: 0,
      total_weighted_volume: 0,
      workout_count: 0,
    },
  };
}

function emptyAssistantInsights(route: Route) {
  return {
    cards: [],
    evidence: {
      calculation_rules: [],
      calculation_sources: [],
      set_count: 0,
      workout_count: 0,
    },
    limitations: [],
    overview: {
      set_count: 0,
      top_exercise_name: null,
      top_muscle_group_name: null,
      total_volume: 0,
      workout_count: 0,
    },
    range: requestRange(route),
  };
}
