import { expect, test } from "@playwright/test";

import { installApiMocks, MOCK_USER } from "./support/mock-api";

function jsonRoute(body: unknown) {
  return {
    body: JSON.stringify({ ok: true, data: body }),
    contentType: "application/json",
    status: 200,
  };
}

function buildWorkouts(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    performed_at: `2026-07-${`${26 - index}`.padStart(2, "0")}T18:00:00.000Z`,
    started_at: null,
    ended_at: null,
    duration_minutes: 52,
    notes: null,
    sets_count: 12,
    muscle_groups: ["chest"],
  }));
}

test("login submit morphs into a circle while the request runs", async ({
  page,
}) => {
  await installApiMocks(page, { authenticated: false });

  // Hold the response open so the morphed state is observable.
  await page.route("**/api/auth/login", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.fulfill(
      jsonRoute({
        user: MOCK_USER,
        token: "e2e-token",
        pending_consents: [],
      }) as never,
    );
  });

  await page.goto("/");
  await page.getByPlaceholder("you@example.com").fill("demo@fitmind.ai");
  await page.getByPlaceholder("至少 8 位").fill("password123");

  const submit = page.locator("form button[type=submit]");
  expect((await submit.boundingBox())?.width ?? 0).toBeGreaterThan(200);

  await submit.click();

  // Design: the button shrinks to a 48px circle for the spinner and the check.
  // Polled rather than timed — the width transition itself takes 0.5s.
  await expect
    .poll(async () => Math.round((await submit.boundingBox())?.width ?? 0), {
      // Sample steadily: the circle only exists between the transition ending
      // and the success dwell handing over to the app.
      intervals: [100],
      timeout: 3_000,
    })
    .toBe(48);

  // The app still takes over once the success dwell ends.
  await expect(page.getByRole("button", { name: "个人" })).toBeVisible({
    timeout: 5_000,
  });
});

test("toast confirms an action and clears itself", async ({ page }) => {
  await installApiMocks(page, { authenticated: true });
  await page.goto("/");

  await page.getByRole("button", { name: "切换主题" }).click();
  await expect(page.getByRole("status")).toHaveText("已切换为浅色主题");

  // Design: the toast clears itself after 2.2s.
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 4_000 });
});

test("plan abandon reports the settled outcome without a false success", async ({
  page,
}) => {
  await installApiMocks(page, { authenticated: true });

  const currentPlan = {
    id: "22222222-2222-4222-8222-222222222222",
    status: "active",
    startDate: "2026-07-20",
    endDate: "2026-07-26",
    plan: {
      strategy: "维持基线",
      exercises: [],
      notes: [],
    },
    sourceMessageId: null,
    createdAt: "2026-07-20T08:00:00.000Z",
    updatedAt: "2026-07-20T08:00:00.000Z",
    adherence: {
      planned_exercise_count: 0,
      trained_exercise_count: 0,
      extra_exercise_count: 0,
      exercise_adherence_ratio: 0,
      set_adherence_ratio: 0,
      exercises: [],
    },
  };
  let activePlan: typeof currentPlan | null = currentPlan;
  let patchCount = 0;

  await page.route("**/api/planned-workouts/current", (route) =>
    route.fulfill(jsonRoute({ plannedWorkout: activePlan })),
  );
  await page.route(
    "**/api/planned-workouts/22222222-2222-4222-8222-222222222222",
    async (route) => {
      patchCount += 1;

      if (patchCount === 1) {
        return route.fulfill({
          body: JSON.stringify({
            ok: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Database rejected the plan status update.",
            },
          }),
          contentType: "application/json",
          status: 500,
        });
      }

      activePlan = null;
      return route.fulfill(
        jsonRoute({
          plannedWorkout: { ...currentPlan, status: "abandoned" },
        }),
      );
    },
  );

  await page.goto("/");
  await page.getByRole("button", { name: "AI 助手" }).click();

  const abandon = page.getByRole("button", { name: "放弃计划" });
  const toggle = page.getByRole("button", { name: "展开" });
  await expect(abandon).toBeVisible();

  await abandon.click();

  await expect(page.getByRole("status")).toHaveText(
    "放弃计划失败，请查看卡片中的错误信息。",
  );
  await expect(page.getByText("计划已放弃")).toHaveCount(0);
  await expect(
    page
      .getByText(
        "请求失败（HTTP 500）：Database rejected the plan status update.",
      )
      .last(),
  ).toBeVisible();
  await expect(abandon).toBeEnabled();
  await expect(toggle).toBeEnabled();

  await abandon.click();

  await expect(page.getByRole("status")).toHaveText("计划已放弃");
  await expect(page.getByRole("status")).toHaveCount(1);
  await expect(page.getByText("还没有本周计划。")).toBeVisible();
  expect(patchCount).toBe(2);
  await page.close();
});

test("expired plan reads as expired and archives as completed", async ({
  page,
}) => {
  await installApiMocks(page, { authenticated: true });

  const expiredPlan = {
    id: "33333333-3333-4333-8333-333333333333",
    status: "active",
    startDate: "2025-12-22",
    endDate: "2025-12-28",
    plan: {
      strategy: "维持基线",
      exercises: [],
      notes: [],
    },
    sourceMessageId: null,
    createdAt: "2025-12-22T08:00:00.000Z",
    updatedAt: "2025-12-22T08:00:00.000Z",
    adherence: {
      planned_exercise_count: 1,
      trained_exercise_count: 1,
      extra_exercise_count: 0,
      exercise_adherence_ratio: 1,
      set_adherence_ratio: 0.75,
      exercises: [],
    },
  };
  let activePlan: typeof expiredPlan | null = expiredPlan;
  let patchedStatus: string | null = null;

  await page.route("**/api/planned-workouts/current", (route) =>
    route.fulfill(jsonRoute({ plannedWorkout: activePlan })),
  );
  await page.route(
    "**/api/planned-workouts/33333333-3333-4333-8333-333333333333",
    async (route) => {
      const body: unknown = route.request().postDataJSON();
      patchedStatus =
        typeof body === "object" &&
        body !== null &&
        "status" in body &&
        typeof body.status === "string"
          ? body.status
          : null;
      activePlan = null;

      return route.fulfill(
        jsonRoute({ plannedWorkout: { ...expiredPlan, status: "completed" } }),
      );
    },
  );

  await page.goto("/");
  await page.getByRole("button", { name: "AI 助手" }).click();

  await expect(page.getByRole("heading", { name: "计划回顾" })).toBeVisible();
  await expect(page.getByText("已过期", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "本周计划" })).toHaveCount(0);
  await expect(page.getByText("2025-12-22 ~ 2025-12-28").last()).toBeVisible();

  await page.getByRole("button", { name: "归档", exact: true }).click();

  await expect(page.getByRole("status")).toHaveText("计划已归档");
  await expect(page.getByText("还没有本周计划。")).toBeVisible();
  expect(patchedStatus).toBe("completed");
});

test("archive failure keeps the expired card and surfaces the server error", async ({
  page,
}) => {
  await installApiMocks(page, { authenticated: true });

  const expiredPlan = {
    id: "44444444-4444-4444-8444-444444444444",
    status: "active",
    startDate: "2025-12-22",
    endDate: "2025-12-28",
    plan: { strategy: "维持基线", exercises: [], notes: [] },
    sourceMessageId: null,
    createdAt: "2025-12-22T08:00:00.000Z",
    updatedAt: "2025-12-22T08:00:00.000Z",
    adherence: {
      planned_exercise_count: 0,
      trained_exercise_count: 0,
      extra_exercise_count: 0,
      exercise_adherence_ratio: 0,
      set_adherence_ratio: 0,
      exercises: [],
    },
  };

  await page.route("**/api/planned-workouts/current", (route) =>
    route.fulfill(jsonRoute({ plannedWorkout: expiredPlan })),
  );
  await page.route(
    "**/api/planned-workouts/44444444-4444-4444-8444-444444444444",
    (route) =>
      route.fulfill({
        body: JSON.stringify({
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Archive update failed.",
          },
        }),
        contentType: "application/json",
        status: 500,
      }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "AI 助手" }).click();
  await page.getByRole("button", { name: "归档", exact: true }).click();

  await expect(page.getByRole("status")).toHaveText(
    "归档失败，请查看卡片中的错误信息。",
  );
  await expect(page.getByText("计划已归档")).toHaveCount(0);
  await expect(
    page.getByText("请求失败（HTTP 500）：Archive update failed.").last(),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "计划回顾" })).toBeVisible();
});

test("archive does not toast success when the follow-up refresh fails", async ({
  page,
}) => {
  await installApiMocks(page, { authenticated: true });

  const expiredPlan = {
    id: "55555555-5555-4555-8555-555555555555",
    status: "active",
    startDate: "2025-12-22",
    endDate: "2025-12-28",
    plan: { strategy: "维持基线", exercises: [], notes: [] },
    sourceMessageId: null,
    createdAt: "2025-12-22T08:00:00.000Z",
    updatedAt: "2025-12-22T08:00:00.000Z",
    adherence: {
      planned_exercise_count: 0,
      trained_exercise_count: 0,
      extra_exercise_count: 0,
      exercise_adherence_ratio: 0,
      set_adherence_ratio: 0,
      exercises: [],
    },
  };
  let currentRequestCount = 0;

  await page.route("**/api/planned-workouts/current", (route) => {
    currentRequestCount += 1;

    if (currentRequestCount === 1) {
      return route.fulfill(jsonRoute({ plannedWorkout: expiredPlan }));
    }

    return route.fulfill({
      body: JSON.stringify({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "Refresh failed." },
      }),
      contentType: "application/json",
      status: 500,
    });
  });
  await page.route(
    "**/api/planned-workouts/55555555-5555-4555-8555-555555555555",
    (route) =>
      route.fulfill(
        jsonRoute({ plannedWorkout: { ...expiredPlan, status: "completed" } }),
      ),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "AI 助手" }).click();
  await page.getByRole("button", { name: "归档", exact: true }).click();

  await expect(page.getByRole("status")).toHaveText(
    "归档失败，请查看卡片中的错误信息。",
  );
  await expect(page.getByText("计划已归档")).toHaveCount(0);
  await expect(
    page.getByText("请求失败（HTTP 500）：Refresh failed.").last(),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "计划回顾" })).toBeVisible();
});

test("workout list pages through real server cursors", async ({ page }) => {
  await installApiMocks(page, { authenticated: true });

  const requestedCursors: (string | null)[] = [];

  await page.route("**/api/workouts?**", (route) => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor");

    requestedCursors.push(cursor);

    if (cursor === null) {
      return route.fulfill(
        jsonRoute({
          items: buildWorkouts("page1", 8),
          next_cursor: "cursor-page-2",
        }),
      );
    }

    return route.fulfill(
      jsonRoute({ items: buildWorkouts("page2", 4), next_cursor: null }),
    );
  });

  await page.goto("/");

  // First tap only expands what is already loaded.
  await page.getByText("查看更多（还有 3 条）").click();
  const loadMore = page.getByRole("button", { name: "加载更早的记录" });
  await expect(loadMore).toBeVisible();

  // Second tap fetches the next cursor page and appends it.
  await loadMore.click();
  await expect(loadMore).toHaveCount(0);
  await expect(page.getByText("共 12 条")).toBeVisible();

  // Regression guard: "查看更多" must page the server, not just reveal records
  // that were already in memory.
  expect(requestedCursors).toEqual([null, "cursor-page-2"]);
});
