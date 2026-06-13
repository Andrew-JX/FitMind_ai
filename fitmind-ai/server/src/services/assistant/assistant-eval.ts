import {
  verifyAnswerFaithfulness,
  type AnswerFaithfulnessResult,
} from "./answer-faithfulness.js";
import type { AssistantStructuredAnswer } from "./assistant-answer-composer.js";
import {
  classifyAssistantIntent,
  type AssistantRoutedIntent,
} from "./assistant-intent-router.js";
import type { AssistantIntentMode } from "./provider-types.js";

/** 通过率达到该阈值才算门禁通过（确定性 mock 套件期望全过）。 */
const REQUIRED_PASS_RATE = 1;

/**
 * 一条 intent 路由 golden 用例：自然语言问题 → 期望路由结果。
 *
 * `mustCiteEvidence` 标记必须命中工具型 intent（不能落到 unsupported/knowledge）；
 * `shouldRefuse` 标记应当拒答（路由到 unsupported）。
 */
export interface AssistantIntentEvalCase {
  id: string;
  message: string;
  mode: AssistantIntentMode;
  expectedIntent: AssistantRoutedIntent;
  mustCiteEvidence?: boolean;
  shouldRefuse?: boolean;
}

/** 一条 faithfulness golden 用例：答案 + 本轮工具输出 → 期望校验状态。 */
export interface FaithfulnessEvalCase {
  id: string;
  message: string;
  answer: AssistantStructuredAnswer;
  toolOutputs: unknown[];
  expectedStatus: AnswerFaithfulnessResult["status"];
}

/** 单项评测的结果。 */
export interface EvalCheckResult {
  name: string;
  total: number;
  passed: number;
  score: number;
  failures: string[];
}

/** 整套 eval 报告。 */
export interface AssistantEvalReport {
  checks: EvalCheckResult[];
  passed: boolean;
}

/**
 * 叙述质量评判器接口（LLM-as-judge 的 seam）。
 *
 * 默认 **不** 注入：保持零成本、可离线。接真实 provider 后可注入一个调用模型的实现，
 * 对答案叙述质量打分，而不改动评测框架。
 */
export interface NarrativeJudge {
  name: string;
  scoreAnswer(input: {
    message: string;
    answerText: string;
  }): Promise<{ pass: boolean; score: number; reason: string }>;
}

/** intent 路由 golden 数据集（mock-first，纯函数判定，无 DB）。 */
export const assistantIntentEvalCases: AssistantIntentEvalCase[] = [
  {
    id: "summary",
    message: "帮我总结一下本周的训练情况",
    mode: "auto",
    expectedIntent: "summary",
    mustCiteEvidence: true,
  },
  {
    id: "progress",
    message: "我的卧推最近有没有进步？",
    mode: "auto",
    expectedIntent: "progress",
    mustCiteEvidence: true,
  },
  {
    id: "weekly_report",
    message: "帮我做一份本周训练报告",
    mode: "auto",
    expectedIntent: "weekly_report",
    mustCiteEvidence: true,
  },
  {
    id: "plateau_diagnosis",
    message: "卧推平台期怎么诊断？",
    mode: "auto",
    expectedIntent: "plateau_diagnosis",
    mustCiteEvidence: true,
  },
  {
    id: "next_week_plan",
    message: "帮我安排下周训练",
    mode: "auto",
    expectedIntent: "next_week_plan",
    mustCiteEvidence: true,
  },
  {
    id: "recommendation",
    message: "今天适合练什么？",
    mode: "auto",
    expectedIntent: "recommendation",
    mustCiteEvidence: true,
  },
  {
    id: "imbalance",
    message: "我是不是练得有点偏科？",
    mode: "auto",
    expectedIntent: "imbalance",
    mustCiteEvidence: true,
  },
  {
    id: "evidence",
    message: "这个结论的判断依据是什么？",
    mode: "auto",
    expectedIntent: "evidence",
    mustCiteEvidence: true,
  },
  {
    id: "exercise_history",
    message: "我上次训练是什么时候？",
    mode: "auto",
    expectedIntent: "exercise_history",
    mustCiteEvidence: true,
  },
  {
    id: "mixed_tool_rag",
    message: "卧推没进步是不是训练量不够？",
    mode: "auto",
    expectedIntent: "mixed_tool_rag",
    mustCiteEvidence: true,
  },
  {
    id: "knowledge",
    message: "渐进超负荷是什么意思？",
    mode: "auto",
    expectedIntent: "knowledge",
  },
  {
    id: "unsupported-weather",
    message: "今天悉尼天气怎么样？",
    mode: "auto",
    expectedIntent: "unsupported",
    shouldRefuse: true,
  },
  {
    id: "unsupported-joke",
    message: "给我讲个笑话",
    mode: "auto",
    expectedIntent: "unsupported",
    shouldRefuse: true,
  },
];

const weeklyEvalToolOutput = {
  status: "ready",
  range: { start_date: "2026-06-01", end_date: "2026-06-07" },
  totals: { workout_count: 4, set_count: 40, total_reps: 320, total_volume: 12000 },
  frequency: { range_days: 7, workouts_per_week: 4 },
  top_muscle_groups: [{ muscle_group_name: "胸", contribution_ratio: 0.4 }],
  evidence: {
    workout_ids: ["w1", "w2"],
    set_ids: ["s1"],
    calculation_rules: ["weekly_rule"],
  },
};

function buildFixtureAnswer(
  summary: string,
  bullets: string[],
): AssistantStructuredAnswer {
  return {
    summary,
    bullets,
    conclusion: "这些数字来自已记录训练，不是模型凭空猜测。",
    recommendation: "下周保持相近频率，只做小幅优化。",
    evidence: {
      source: "deterministic_tool_executor",
      tool_names: ["get_weekly_training_report"],
      workout_ids: ["w1", "w2"],
      set_ids: ["s1"],
      calculation_rules: ["weekly_rule"],
    },
    sources: [],
    intent: "weekly_report",
    limitations: [],
  };
}

/** faithfulness golden 数据集（答案 + 工具输出，复用 Slice 1 校验器打分）。 */
export const faithfulnessEvalCases: FaithfulnessEvalCase[] = [
  {
    id: "faithful-plain",
    message: "帮我做一份本周训练报告",
    answer: buildFixtureAnswer(
      "本周共记录 4 次训练，40 组，320 次，总训练量约 12000 kg。",
      ["近 7 天平均训练频率：约每周 4 次。"],
    ),
    toolOutputs: [weeklyEvalToolOutput],
    expectedStatus: "verified",
  },
  {
    id: "faithful-formatted",
    message: "帮我做一份本周训练报告",
    answer: buildFixtureAnswer(
      "总训练量约 12,000 kg，占比最高肌群约 40.0%。",
      ["这个总结来自 2 条已记录 workout 和 1 条 set。"],
    ),
    toolOutputs: [weeklyEvalToolOutput],
    expectedStatus: "verified",
  },
  {
    id: "fabricated-number",
    message: "帮我做一份本周训练报告",
    answer: buildFixtureAnswer(
      "本周共记录 4 次训练，最高重量竟达到 999 kg。",
      [],
    ),
    toolOutputs: [weeklyEvalToolOutput],
    expectedStatus: "flagged",
  },
];

/**
 * 评测 intent 路由准确率：对每条 golden 用例跑 `classifyAssistantIntent`，比对 expectedIntent。
 *
 * @param cases - intent golden 用例集
 * @returns 路由准确率评测结果
 */
export function evaluateIntentRouting(
  cases: AssistantIntentEvalCase[],
): EvalCheckResult {
  const failures: string[] = [];

  for (const testCase of cases) {
    const actual = classifyAssistantIntent(testCase.message).intent;

    if (actual !== testCase.expectedIntent) {
      failures.push(
        `${testCase.id}: expected ${testCase.expectedIntent}, got ${actual}`,
      );
    }
  }

  return buildCheckResult("intent_routing", cases.length, failures);
}

/**
 * 评测关键回归断言：该拒答的（shouldRefuse）必须路由到 unsupported；
 * 必须引用证据的（mustCiteEvidence）不能落到 unsupported/knowledge。
 *
 * @param cases - intent golden 用例集
 * @returns 回归断言评测结果
 */
export function evaluateRefusalRegression(
  cases: AssistantIntentEvalCase[],
): EvalCheckResult {
  const relevant = cases.filter(
    (testCase) => testCase.shouldRefuse === true || testCase.mustCiteEvidence === true,
  );
  const failures: string[] = [];

  for (const testCase of relevant) {
    const actual = classifyAssistantIntent(testCase.message).intent;

    if (testCase.shouldRefuse === true && actual !== "unsupported") {
      failures.push(`${testCase.id}: should refuse but routed to ${actual}`);
    }

    if (
      testCase.mustCiteEvidence === true &&
      (actual === "unsupported" || actual === "knowledge")
    ) {
      failures.push(
        `${testCase.id}: must cite evidence but routed to ${actual}`,
      );
    }
  }

  return buildCheckResult("refusal_regression", relevant.length, failures);
}

/**
 * 评测 faithfulness 通过率：对一组「答案 + 工具输出」fixtures 跑 Slice 1 校验器，
 * 比对期望 status。
 *
 * @param cases - faithfulness golden 用例集
 * @returns faithfulness 通过率评测结果
 */
export function evaluateFaithfulness(
  cases: FaithfulnessEvalCase[],
): EvalCheckResult {
  const failures: string[] = [];

  for (const testCase of cases) {
    const result = verifyAnswerFaithfulness(testCase.answer, testCase.toolOutputs);

    if (result.status !== testCase.expectedStatus) {
      failures.push(
        `${testCase.id}: expected ${testCase.expectedStatus}, got ${result.status} (${result.unverifiedClaims.join(", ")})`,
      );
    }
  }

  return buildCheckResult("faithfulness", cases.length, failures);
}

/**
 * 跑整套助手 eval：intent 路由准确率 + 回归断言 + faithfulness 通过率。
 *
 * 默认 mock-first、离线、零成本。可选注入 {@link NarrativeJudge} 对答案叙述质量打分
 * （LLM-as-judge），默认不注入。
 *
 * @param options - 可选 narrativeJudge（叙述质量评判器，默认 off）
 * @returns 完整评测报告；任一项未达 {@link REQUIRED_PASS_RATE} 则 `passed=false`
 */
export async function runAssistantEval(options?: {
  narrativeJudge?: NarrativeJudge;
}): Promise<AssistantEvalReport> {
  const checks: EvalCheckResult[] = [
    evaluateIntentRouting(assistantIntentEvalCases),
    evaluateRefusalRegression(assistantIntentEvalCases),
    evaluateFaithfulness(faithfulnessEvalCases),
  ];

  if (options?.narrativeJudge) {
    checks.push(
      await evaluateNarrativeQuality(faithfulnessEvalCases, options.narrativeJudge),
    );
  }

  return {
    checks,
    passed: checks.every((check) => check.score >= REQUIRED_PASS_RATE),
  };
}

async function evaluateNarrativeQuality(
  cases: FaithfulnessEvalCase[],
  judge: NarrativeJudge,
): Promise<EvalCheckResult> {
  const failures: string[] = [];

  for (const testCase of cases) {
    const answerText = [
      testCase.answer.summary,
      ...testCase.answer.bullets,
      testCase.answer.conclusion,
      testCase.answer.recommendation,
    ].join("\n");
    const judgement = await judge.scoreAnswer({
      message: testCase.message,
      answerText,
    });

    if (!judgement.pass) {
      failures.push(`${testCase.id}: ${judgement.reason}`);
    }
  }

  return buildCheckResult(`narrative_quality(${judge.name})`, cases.length, failures);
}

function buildCheckResult(
  name: string,
  total: number,
  failures: string[],
): EvalCheckResult {
  const passed = total - failures.length;

  return {
    name,
    total,
    passed,
    score: total === 0 ? 1 : passed / total,
    failures,
  };
}
