import { expect, test } from "@playwright/test";

import { installApiMocks } from "./support/mock-api";

const AMBIGUOUS_ANSWER =
  "我找到了多个可能的动作，需要你确认一个后才能继续分析。";
const RESOLVED_ANSWER = "杠铃卧推近 30 天最大重量 62.5 → 70 公斤。";
const BENCH_ID = "aaaa1111-1111-4111-8111-111111111111";

function sse(type: string, payload: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`;
}

/** Mirrors the server's clarification turn: empty evidence, no sources. */
function clarificationTurn(): string {
  return [
    sse("session", { session_id: "session-1" }),
    sse("answer_delta", { text: AMBIGUOUS_ANSWER }),
    sse("structured_output", {
      output: {
        answer: {
          evidence: {
            calculation_rules: [],
            set_ids: [],
            tool_names: [],
            workout_ids: [],
          },
          limitations: ["动作确认完成前不会生成训练数据结论。"],
          sources: [],
        },
        clarification: {
          kind: "exercise",
          options: [
            { exercise_id: BENCH_ID, exercise_name: "杠铃卧推" },
            {
              exercise_id: "bbbb2222-2222-4222-8222-222222222222",
              exercise_name: "哑铃卧推",
            },
          ],
          reason: "ambiguous",
        },
        intent: "unsupported",
        message_id: "msg-clarify",
      },
    }),
    sse("done", { message_id: "msg-clarify", session_id: "session-1" }),
  ].join("");
}

function resolvedTurn(): string {
  return [
    sse("answer_delta", { text: RESOLVED_ANSWER }),
    sse("structured_output", {
      output: {
        answer: {
          evidence: {
            calculation_rules: ["最大重量取范围内每次训练的最高 weight_kg。"],
            set_ids: ["s1"],
            tool_names: ["get_exercise_progress"],
            workout_ids: ["w1"],
          },
          limitations: [],
          sources: [],
        },
        intent: "exercise_progress",
        message_id: "msg-resolved",
      },
    }),
    sse("done", { message_id: "msg-resolved", session_id: "session-1" }),
  ].join("");
}

test("ambiguous exercise offers candidates and answering one resolves it", async ({
  page,
}) => {
  await installApiMocks(page, { authenticated: true });

  const requests: Array<Record<string, unknown>> = [];

  await page.route("**/api/assistant/stream-turn**", async (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);

    return route.fulfill({
      body: requests.length === 1 ? clarificationTurn() : resolvedTurn(),
      contentType: "text/event-stream",
      status: 200,
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "AI 助手" }).click();

  await page.getByRole("textbox").last().fill("卧推最近有没有进步");
  await page.getByRole("button", { name: "发送追问" }).click();
  await expect(page.getByText(AMBIGUOUS_ANSWER)).toBeVisible();

  // ER-1C: the clarification turn carries empty evidence. It must not render
  // an Evidence block full of empty bullets.
  const emptyBullets = page.locator("li", {
    hasText: /^(工具|训练|组数|规则)：$/,
  });
  await expect(emptyBullets).toHaveCount(0);

  // ER-1C: a half-answer must not be saveable as an insight.
  await expect(page.getByRole("button", { name: "☆ 保存为洞察" })).toHaveCount(
    0,
  );

  // ER-1D: candidates render and answering one continues the turn.
  const candidate = page.getByRole("button", { name: "杠铃卧推" });
  await expect(candidate).toBeVisible();
  await candidate.click();

  await expect(page.getByText(RESOLVED_ANSWER)).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toMatchObject({
    exercise_id: BENCH_ID,
    message: "杠铃卧推",
    session_id: "session-1",
  });
});
