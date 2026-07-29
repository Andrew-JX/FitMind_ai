import { expect, test } from "@playwright/test";

import { installApiMocks } from "./support/mock-api";

const AMBIGUOUS = "你提到了不止一个时间段，需要你确认一个后才能继续分析。";
const RESOLVED = "上周共记录 3 次训练。";

function sse(type: string, payload: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`;
}

test("two named periods ask, and the tapped one resumes as an explicit window", async ({
  page,
}) => {
  await installApiMocks(page, { authenticated: true });

  const requests: Array<Record<string, unknown>> = [];

  await page.route("**/api/assistant/stream-turn**", (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    const first = requests.length === 1;

    return route.fulfill({
      body: first
        ? [
            sse("session", { session_id: "s1" }),
            sse("answer_delta", { text: AMBIGUOUS }),
            sse("structured_output", {
              output: {
                clarification: {
                  kind: "date_range",
                  reason: "ambiguous",
                  options: [
                    {
                      label: "本周",
                      start_date: "2026-07-26",
                      end_date: "2026-07-29",
                    },
                    {
                      label: "上周",
                      start_date: "2026-07-19",
                      end_date: "2026-07-25",
                    },
                  ],
                },
                intent: "unsupported",
                message_id: "m1",
              },
            }),
            sse("done", { message_id: "m1", session_id: "s1" }),
          ].join("")
        : [
            sse("answer_delta", { text: RESOLVED }),
            sse("structured_output", {
              output: { intent: "training_overview", message_id: "m2" },
            }),
            sse("done", { message_id: "m2", session_id: "s1" }),
          ].join(""),
      contentType: "text/event-stream",
      status: 200,
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "AI 助手" }).click();
  await page.getByRole("textbox").last().fill("本周和上周分别练了多少");
  await page.getByRole("button", { name: "发送追问" }).click();
  await expect(page.getByText(AMBIGUOUS)).toBeVisible();

  // ER-2C: the first turn carries no window; the server resolves it.
  expect(requests[0]).not.toHaveProperty("start_date");
  expect(requests[0]).toHaveProperty("timezone");

  await page.getByRole("button", { name: "上周" }).click();
  await expect(page.getByText(RESOLVED)).toBeVisible();

  // The continuation is an explicit window, which outranks everything.
  expect(requests[1]).toMatchObject({
    end_date: "2026-07-25",
    message: "上周",
    session_id: "s1",
    start_date: "2026-07-19",
  });
});
