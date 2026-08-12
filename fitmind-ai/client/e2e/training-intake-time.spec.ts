import { expect, test } from "@playwright/test";

import { installApiMocks } from "./support/mock-api";

const exerciseId = "11111111-1111-4111-8111-111111111111";
const fixedSaveTime = "2030-01-01T00:00:00.000Z";

function jsonRoute(body: unknown) {
  return {
    body: JSON.stringify({ ok: true, data: body }),
    contentType: "application/json",
    status: 200,
  };
}

test("an imported training keeps the explicit end time in the workout request", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(fixedSaveTime));
  await installApiMocks(page, { authenticated: true });

  await page.route("**/api/muscle-groups", (route) =>
    route.fulfill(jsonRoute({ items: [] })),
  );
  await page.route("**/api/exercises*", (route) =>
    route.fulfill(
      jsonRoute({
        items: [
          {
            code: "bench_press_barbell",
            common_mistakes_zh: [],
            equipment: "barbell",
            equipment_notes_zh: null,
            id: exerciseId,
            movement_pattern: "horizontal_push",
            muscles: [],
            name_en: "Barbell Bench Press",
            name_zh: "杠铃卧推",
            technique_cues_zh: [],
          },
        ],
      }),
    ),
  );
  await page.route("**/api/training/workout-intake/parse", (route) =>
    route.fulfill(
      jsonRoute({
        draft: {
          date_label: "2026-07-03",
          date_source: "explicit_text",
          duration_min: 50,
          exercises: [
            {
              candidate_exercises: [],
              incomplete_sets: [],
              input_name: "杠铃卧推",
              match_confidence: 1,
              match_status: "matched",
              matched_exercise_id: exerciseId,
              matched_exercise_name: "杠铃卧推",
              sets: [
                {
                  intensity_label: null,
                  reps: 8,
                  rpe: 8,
                  weight_kg: 60,
                },
              ],
            },
          ],
          note: "imported session",
          performed_at: "2026-07-03T12:00:00.000Z",
        },
        evidence: {
          parser_version: "e2e",
          rules: ["fixture"],
          source: "rule_parser",
        },
        unresolved_items: [],
        warnings: [],
      }),
    ),
  );

  const workoutRequests: Record<string, unknown>[] = [];
  await page.route("**/api/workouts", (route) => {
    if (route.request().method() !== "POST") {
      return route.fallback();
    }

    workoutRequests.push(
      route.request().postDataJSON() as Record<string, unknown>,
    );
    return route.fulfill(jsonRoute({ workout: {} }));
  });

  const exercisesLoaded = page.waitForResponse(
    (response) =>
      response.url().includes("/api/exercises") && response.status() === 200,
  );
  await page.goto("/");
  await exercisesLoaded;

  await page.getByRole("button", { name: "文本录入训练" }).click();
  await page.getByLabel("训练描述").fill("2026-07-03 杠铃卧推 60 公斤 8 次");
  await page.getByRole("button", { name: "生成训练记录" }).click();

  await page.getByRole("button", { name: /训练时间/ }).click();
  await page.getByLabel("开始时间").fill("2026-07-03T20:00");
  await page.getByLabel("结束时间").fill("2026-07-03T20:42");
  const expectedTimes = await page.evaluate(() => ({
    endedAt: new Date(2026, 6, 3, 20, 42).toISOString(),
    startedAt: new Date(2026, 6, 3, 20, 0).toISOString(),
  }));
  await page.getByRole("button", { name: "保存时间" }).click();
  await page.getByRole("button", { name: "完成", exact: true }).click();

  await expect.poll(() => workoutRequests.length).toBe(1);
  expect(workoutRequests[0]).toEqual({
    duration_minutes: 42,
    ended_at: expectedTimes.endedAt,
    notes: "imported session",
    performed_at: expectedTimes.startedAt,
    sets: [
      {
        exercise_id: exerciseId,
        is_warmup: false,
        reps: 8,
        rpe: 8,
        set_index: 1,
        weight_kg: 60,
      },
    ],
    started_at: expectedTimes.startedAt,
  });
  expect(workoutRequests[0]?.["ended_at"]).not.toBe(fixedSaveTime);
});
