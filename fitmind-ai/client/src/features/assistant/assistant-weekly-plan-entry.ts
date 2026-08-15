/** Message sent after the user confirms the structured weekly-plan settings. */
export const WEEKLY_PLAN_GENERATION_MESSAGE =
  "请按我确认的本周设置生成可编辑训练计划";

/**
 * Detects a direct request to create a weekly plan.
 *
 * The client uses this only to open the same structured setup shown by the
 * AI 周计划 card. Broader plan discussion stays in ordinary chat routing.
 */
export function isWeeklyPlanCreationRequest(message: string): boolean {
  const normalized = message
    .trim()
    .toLowerCase()
    .replace(/[\s，。！？、,.!?]/gu, "");

  return /(?:给我|帮我|生成|制定|安排|做)(?:一份|一个)?(?:本周|下周)(?:的)?(?:训练|健身)?计划/u.test(
    normalized,
  );
}
