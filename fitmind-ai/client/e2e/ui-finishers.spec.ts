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
      jsonRoute({ user: MOCK_USER, token: "e2e-token" }) as never,
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
