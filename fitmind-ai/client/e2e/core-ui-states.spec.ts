import { expect, test, type Locator, type Page } from "@playwright/test";

import { MOCK_POLICY_VERSION, installApiMocks } from "./support/mock-api";
import {
  installEmptyAuthenticatedApp,
  jsonData,
} from "./support/core-ui-state-mocks";

const LONG_TEXT = "边界动作名称".repeat(14);
const LONG_ANSWER = "边界回答内容".repeat(14);
const LONG_MEMO = "边界备忘录标题".repeat(12);
const LONG_NAME = "边界用户昵称".repeat(14);

test("registration: delayed/error policy stays fail-closed, login and keyboard stay usable", async ({
  page,
}) => {
  await installApiMocks(page, { authenticated: false });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/auth/registration-policy", async (route) => {
    await pending;
    await route.fulfill(jsonData("Policy unavailable", 500));
  });

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "注册" })).toBeDisabled();
  expect(await horizontalOverflow(page)).toBe(false);
  release();
  await expect(page.getByText("注册暂不可用")).toBeVisible();

  const visited = await tabNames(page, 14);
  expectOrdered(visited, [
    "邮箱",
    "密码",
    "记住邮箱，不保存密码",
    "登录 FitMind AI",
  ]);
  await page.getByLabel("邮箱", { exact: true }).fill("demo@fitmind.ai");
  await page.getByLabel("密码", { exact: true }).fill("password123");
  await tabTo(page, page.getByRole("button", { name: "登录 FitMind AI" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "个人" })).toBeVisible();
});

test("consent catch-up: slow single-flight, failure copy, keyboard retry recovery", async ({
  page,
}) => {
  await installApiMocks(page, {
    authenticated: true,
    pendingConsents: [
      {
        consent_type: "cross_border_transfer",
        policy_version: MOCK_POLICY_VERSION,
      },
    ],
  });
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/auth/consents", async (route) => {
    calls += 1;
    if (calls === 1) {
      await pending;
      return route.fulfill(jsonData("Consent unavailable", 500));
    }
    return route.fulfill(
      jsonData({ consent_type: "cross_border_transfer" }, 201),
    );
  });

  await page.goto("/");
  await tabTo(
    page,
    page.getByRole("checkbox", { name: /存储在中国境外的服务器/ }),
  );
  await page.keyboard.press("Space");
  const consentButton = page.getByRole("button", { name: /同意并继续/ });
  await tabTo(page, consentButton);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /同意并继续/ })).toBeDisabled();
  expect(calls).toBe(1);
  release();
  await expect(page.getByText(/未提交前不会记录任何同意/)).toBeVisible();
  await tabTo(page, consentButton);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "个人" })).toBeVisible();
  expect(calls).toBe(2);
});

test("training history: slow/error/empty are exclusive and Refresh recovers", async ({
  page,
}) => {
  await installEmptyAuthenticatedApp(page);
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/workouts?**", async (route) => {
    calls += 1;
    if (calls === 1) {
      await pending;
      return route.fulfill(jsonData("Workout list offline", 503));
    }
    return route.fulfill(jsonData({ items: [], next_cursor: null }));
  });

  await page.goto("/");
  await page.getByRole("button", { name: "历史" }).click();
  await page.getByRole("button", { name: "列表视图" }).click();
  await expect(page.getByText("正在加载训练记录...")).toBeVisible();
  expect(calls).toBe(1);
  release();
  await expect(page.getByText("训练记录加载失败")).toBeVisible();
  await expect(page.getByText("暂无训练记录")).toHaveCount(0);
  await tabTo(page, page.getByRole("button", { name: "刷新" }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("暂无训练记录")).toBeVisible();
  await expect(page.getByText("训练记录加载失败")).toHaveCount(0);
  expect(calls).toBe(2);
});

test("analysis: zero states are truthful; range keyboard action retries failed cards", async ({
  page,
}) => {
  await installEmptyAuthenticatedApp(page);
  let failing = true;
  await page.route("**/api/training/summary?**", (route) =>
    failing
      ? route.fulfill(jsonData("Summary offline", 503))
      : route.fulfill(jsonData(emptySummaryFor(route.request().url()))),
  );
  await page.route("**/api/training/muscle-load?**", (route) =>
    failing
      ? route.fulfill(jsonData("Muscle load offline", 500))
      : route.fulfill(jsonData(emptyMuscleFor(route.request().url()))),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "历史" }).click();
  await tabTo(page, page.getByRole("tab", { name: "分析" }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("分析数据加载失败")).toBeVisible();
  await expect(page.getByText("暂无分析数据")).toHaveCount(0);
  failing = false;
  await tabTo(page, page.getByRole("tab", { name: "近 7 天" }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("暂无分析数据")).toBeVisible();
  await expect(page.getByText("暂无肌群负荷数据")).toBeVisible();
});

test("assistant: delayed plan error has keyboard Retry and long plan stays narrow", async ({
  page,
}) => {
  await installEmptyAuthenticatedApp(page);
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/planned-workouts/current", async (route) => {
    calls += 1;
    if (calls === 1) {
      await pending;
      return route.fulfill(jsonData("Plan offline", 503));
    }
    return route.fulfill(jsonData({ plannedWorkout: longPlan() }));
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await tabTo(page, page.getByRole("button", { name: "AI 助手" }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("正在加载本周计划…")).toBeVisible();
  expect(calls).toBe(1);
  release();
  await expect(page.getByText(/Plan offline/)).toBeVisible();
  await tabTo(page, page.getByRole("button", { name: "重试加载本周计划" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "展开" })).toBeVisible();
  await page.getByRole("button", { name: "展开" }).click();
  await expect(page.getByText(LONG_TEXT)).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(false);
  await expect(page.getByRole("textbox").last()).toBeEnabled();
});

test("profile tools: loading/error never masquerades as empty and every Retry recovers", async ({
  page,
}) => {
  await installEmptyAuthenticatedApp(page);
  const cases = [
    {
      path: "**/api/body-measurements",
      tool: "身体数据",
      loading: "正在加载身体数据…",
      error: "身体数据暂时无法加载",
      empty: "还没有身体数据",
      retry: "重试加载身体数据",
      data: {
        items: [],
        healthConsentOnFile: false,
        withdrawableHealthConsent: false,
      },
    },
    {
      path: "**/api/menstrual-records?**",
      tool: "经期记录",
      loading: "正在加载…",
      error: "经期记录暂时无法加载",
      empty: "还没有标记日期",
      retry: "重试加载经期记录",
      data: {
        dates: [],
        showInHistory: false,
        healthConsentOnFile: false,
        withdrawableHealthConsent: false,
      },
    },
    {
      path: "**/api/training-memos",
      tool: "训练备忘录",
      loading: "正在加载训练备忘录…",
      error: "训练备忘录暂时无法加载",
      empty: "还没有备忘录",
      retry: "重试加载训练备忘录",
      data: { items: [] },
    },
  ];
  const calls = new Map<string, number>();
  const releases = new Map<string, () => void>();
  const recovering = new Set<string>();
  for (const item of cases) {
    await page.unroute(item.path);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    releases.set(item.tool, release);
    await page.route(item.path, async (route) => {
      const count = (calls.get(item.tool) ?? 0) + 1;
      calls.set(item.tool, count);
      if (!recovering.has(item.tool)) {
        await pending;
        return route.fulfill(jsonData(`${item.tool} offline`, 503));
      }
      return route.fulfill(jsonData(item.data));
    });
  }

  await page.goto("/");
  await page.getByRole("button", { name: "个人" }).click();
  for (const item of cases) {
    await tabTo(page, page.getByRole("button", { name: item.tool }));
    await page.keyboard.press("Enter");
    await expect.poll(() => calls.get(item.tool) ?? 0).toBeGreaterThan(0);
    await expect(page.getByText(item.loading, { exact: true })).toBeVisible();
    releases.get(item.tool)?.();
    await expect(page.getByText(item.error, { exact: false })).toBeVisible();
    await expect(page.getByText(item.empty, { exact: false })).toHaveCount(0);
    const initialCalls = calls.get(item.tool) ?? 0;
    recovering.add(item.tool);
    await tabTo(page, page.getByRole("button", { name: item.retry }));
    await page.keyboard.press("Enter");
    await expect(page.getByText(item.empty, { exact: false })).toBeVisible();
    expect(calls.get(item.tool)).toBe(initialCalls + 1);
    await tabTo(page, page.getByRole("button", { name: "返回个人页" }));
    await page.keyboard.press("Enter");
  }
  expect(await horizontalOverflow(page)).toBe(false);
});

test("boundary layout: auth, long history, assistant answer/plan, and profile fit both narrow viewports", async ({
  browser,
}) => {
  for (const viewport of [
    { width: 320, height: 800 },
    { width: 390, height: 844 },
  ]) {
    const authContext = await browser.newContext({ viewport });
    const authPage = await authContext.newPage();
    await installApiMocks(authPage, { authenticated: false });
    await authPage.goto("/");
    expect(await horizontalOverflow(authPage)).toBe(false);
    await authContext.close();

    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await installEmptyAuthenticatedApp(page);
    await page.unroute("**/api/auth/me");
    await page.route("**/api/auth/me", (route) =>
      route.fulfill(
        jsonData({
          pending_consents: [],
          user: {
            display_name: LONG_NAME,
            email: "layout@fitmind.test",
            id: "11111111-1111-4111-8111-111111111111",
          },
        }),
      ),
    );
    await page.unroute("**/api/workouts?**");
    await page.route("**/api/workouts?**", (route) =>
      route.fulfill(
        jsonData({
          items: [
            {
              duration_minutes: 60,
              ended_at: null,
              id: "layout-workout",
              muscle_groups: [LONG_TEXT],
              notes: LONG_TEXT,
              performed_at: "2026-08-14T18:00:00.000Z",
              sets_count: 3,
              started_at: null,
            },
          ],
          next_cursor: null,
        }),
      ),
    );
    await page.unroute("**/api/planned-workouts/current");
    await page.route("**/api/planned-workouts/current", (route) =>
      route.fulfill(jsonData({ plannedWorkout: longPlan() })),
    );
    await page.unroute("**/api/training-memos");
    await page.route("**/api/training-memos", (route) =>
      route.fulfill(
        jsonData({
          items: [
            {
              content: LONG_TEXT,
              createdAt: "2026-08-14T00:00:00.000Z",
              id: "layout-memo",
              isPinned: true,
              title: LONG_MEMO,
              updatedAt: "2026-08-14T00:00:00.000Z",
            },
          ],
        }),
      ),
    );
    await page.route("**/api/assistant/stream-turn**", (route) =>
      route.fulfill({
        body: [
          sse("session", { session_id: "layout-session" }),
          sse("answer_delta", { text: LONG_ANSWER }),
          sse("done", {
            message_id: "layout-message",
            session_id: "layout-session",
          }),
        ].join(""),
        contentType: "text/event-stream",
        status: 200,
      }),
    );

    await page.goto("/");
    await page.getByRole("button", { name: "历史" }).click();
    await page.getByRole("button", { name: "列表视图" }).click();
    await expect(
      page.getByRole("button", { name: /边界动作名称.*查看详情/ }),
    ).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(false);

    await page.getByRole("button", { name: "AI 助手" }).click();
    await page.getByRole("textbox").last().fill("给我边界回答");
    await page.getByRole("button", { name: "发送追问" }).click();
    await expect(page.getByText(LONG_ANSWER)).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(false);

    await page.getByRole("button", { name: "个人" }).click();
    await expect(page.getByText(LONG_NAME)).toBeVisible();
    await page.getByRole("button", { name: "训练备忘录" }).click();
    await expect(page.getByText(LONG_MEMO)).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(false);
    await context.close();
  }
});

async function tabNames(page: Page, count: number): Promise<string[]> {
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  const names: string[] = [];
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press("Tab");
    names.push(await activeName(page));
  }
  return names;
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let index = 0; index < 40; index += 1) {
    await page.keyboard.press("Tab");
    if (
      await target.evaluateAll((elements) =>
        elements.includes(document.activeElement),
      )
    )
      return;
  }
  throw new Error(`Keyboard focus never reached ${await target.toString()}`);
}

async function activeName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element) return "";
    const labelledBy = element.getAttribute("aria-labelledby");
    const labelled = labelledBy
      ? labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
      : "";
    const nativeLabels =
      "labels" in element
        ? Array.from((element as HTMLInputElement).labels ?? [])
            .map((label) => label.textContent ?? "")
            .join(" ")
        : "";
    const ariaLabel = element.getAttribute("aria-label") ?? "";
    return (
      ariaLabel ||
      labelled.trim() ||
      nativeLabels.trim() ||
      element.textContent?.trim() ||
      ""
    );
  });
}

function expectOrdered(actual: string[], expected: string[]): void {
  let cursor = -1;
  for (const name of expected) {
    const next = actual.findIndex(
      (entry, index) => index > cursor && entry.includes(name),
    );
    expect(
      next,
      `${name} should follow ${actual[cursor] ?? "start"}; visited: ${actual.join(" | ")}`,
    ).toBeGreaterThan(cursor);
    cursor = next;
  }
}

async function horizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

function rangeFrom(url: string) {
  const query = new URL(url).searchParams;
  return {
    start_date: query.get("start_date"),
    end_date: query.get("end_date"),
  };
}

function emptySummaryFor(url: string) {
  return {
    range: rangeFrom(url),
    totals: { workout_count: 0, set_count: 0, total_reps: 0, total_volume: 0 },
    by_exercise: [],
    evidence: { workout_ids: [], calculation_rules: [] },
  };
}

function emptyMuscleFor(url: string) {
  return {
    range: rangeFrom(url),
    totals: {
      workout_count: 0,
      set_count: 0,
      total_reps: 0,
      total_raw_volume: 0,
      total_weighted_volume: 0,
      muscle_group_count: 0,
    },
    by_muscle_group: [],
    top_muscle_groups: [],
    low_volume_muscle_groups: [],
    evidence: { workout_ids: [], set_ids: [], calculation_rules: [] },
  };
}

function longPlan() {
  return {
    id: "99999999-9999-4999-8999-999999999999",
    status: "active",
    startDate: "2026-08-14",
    endDate: "2026-08-20",
    plan: {
      strategy: LONG_TEXT,
      exercises: [
        {
          exercise_name: LONG_TEXT,
          sets: 3,
          rep_min: 8,
          rep_max: 10,
          target_weight_kg: 60,
          basis: LONG_TEXT,
        },
      ],
      notes: [LONG_TEXT],
    },
    sourceMessageId: null,
    createdAt: "2026-08-14T00:00:00.000Z",
    updatedAt: "2026-08-14T00:00:00.000Z",
    adherence: {
      planned_exercise_count: 1,
      trained_exercise_count: 0,
      extra_exercise_count: 0,
      exercise_adherence_ratio: 0,
      set_adherence_ratio: 0,
      exercises: [
        {
          exercise_name: LONG_TEXT,
          planned_sets: 3,
          performed_sets: 0,
          status: "missed",
          set_completion_ratio: 0,
        },
      ],
    },
  };
}

function sse(type: string, payload: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`;
}
