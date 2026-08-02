export type AssistantRoutedIntent =
  | "weekly_report"
  | "plateau_diagnosis"
  | "next_week_plan"
  | "summary"
  | "progress"
  | "imbalance"
  | "recommendation"
  | "exercise_history"
  | "evidence"
  | "knowledge"
  | "mixed_tool_rag"
  | "unsupported";

export interface AssistantIntentClassification {
  intent: AssistantRoutedIntent;
  reason: string;
}

const UNSUPPORTED_PATTERN = /天气|笑话|新闻|股票|彩票|电影|音乐|旅游/u;
const KNOWLEDGE_PATTERN =
  /是什么|什么意思|怎么理解|原理|动作要点|常见错误|RPE|训练容量|训练量|渐进超负荷|deload|减量周|膝盖内扣|肩推|引体向上/u;
const PROGRESS_PATTERN = /进步|没进步|停滞|平台|1RM|最大重量|卧推|深蹲|硬拉/u;
/** Summary wording that carries training intent on its own. */
const SUMMARY_PATTERN = /训练量|总结|够吗|频率/u;
/**
 * Time terms this router recognizes, kept in step with the ER-2 date resolver.
 *
 * @remarks
 * The resolver understands 上周 and 本月, but routing did not, so
 * "上周练得怎么样" was refused as unrecognized while the identically shaped
 * 本周 question worked — the resolver never got a chance to run.
 */
const DATE_TERM_PATTERN =
  /这周|这个星期|本周|上周|上一周|上个星期|本月|这个月|最近/u;
/**
 * Training action required before a date term may route to summary.
 *
 * @remarks
 * A period alone proves nothing about the subject: "上周我女朋友生气了怎么办"
 * would otherwise reach a training tool and bypass the ER-3 refusals entirely.
 *
 * Two earlier shapes failed for the same structural reason. A training-noun
 * list could not be made safe by lengthening it — 组 sits inside 小组, 组数
 * inside 小组数量, 动作 inside 动作片, 重量 inside 包裹重量 — and switching to
 * verb forms still spliced across compounds, because a bare substring test
 * happily reads 练了 out of 排练了 and 训练 out of 模型训练.
 *
 * What actually separates them is a word boundary: 月练得 is two words while
 * 排练了 is one. Chinese writes no boundary, so the compounds are blocked
 * directly. The blocked set is closed grammar rather than domain vocabulary —
 * the characters that bind in front of 练 (排, 教, 熟, 操) and the suffixes that
 * turn 训练/健身 into a different noun (营, 班, 师, 房, 卡) do not grow as the
 * product gains features, which is exactly what the two lexicons did.
 *
 * Honest limit: this is a boundary heuristic, not segmentation. A compound
 * outside the blocked set can still splice, and only a real tokenizer would
 * close that for good — out of scope for a deterministic keyword router. The
 * failure it can still produce is one wasted tool call on the asker's own data
 * with the range honestly labelled, never a wrong answer.
 *
 * Cost of the narrowing: a noun-only question such as "本周肌群分布" now asks
 * for clarification instead of running a tool. That is the safe direction —
 * this guard decides whether to spend a tool call on a stranger's question.
 */
const TRAINING_ACTION_PATTERN =
  /(?<![排教熟操])练(?:得|的|了|多少|几次)|怎么练|(?<![模型])训练(?![营班师])|健身(?![房卡]|中心|器材)/u;
const IMBALANCE_PATTERN = /偏科|练太多|太少|均衡|胸|背|腿|肩/u;
const RECOMMENDATION_PATTERN = /今天|下次|练什么|适合练|建议/u;
const HISTORY_PATTERN = /上次|什么时候|历史|记录/u;
const EVIDENCE_PATTERN = /根据什么|依据|为什么|证据|判断/u;

const WEEKLY_REPORT_PATTERN =
  /本周训练报告|周训练报告|周报|weekly\s*report|weekly\s*training\s*report|训练报告/u;
const PLATEAU_DIAGNOSIS_PATTERN =
  /平台期|停滞诊断|plateau\s*diagnosis|卧推平台|bench\s*plateau/u;
const NEXT_WEEK_PLAN_PATTERN =
  /下周训练草案|下周训练的草案|下周训练草稿|下周训练的草稿|下周训练草程|下周训练的草程|下周训练计划|下周训练安排|下周计划|下周我怎么练|下周怎么练|下周我练什么|帮我安排下周训练|下周训练建议|给我一个下周训练建议|next[-\s]*week\s*plan|next\s*week\s*draft|训练草案/u;

const RPE_KNOWLEDGE_PATTERN =
  /^(?:pre|rpe)(?:是)?(?:什么|啥|什么意思|怎么理解)[？?]?$/u;
const SUBJECTIVE_EFFORT_KNOWLEDGE_PATTERN =
  /主观用力(?:程度)?(?:是)?(?:什么|啥|什么意思|怎么理解)[？?]?/u;

function normalizeCompactMessage(message: string): string {
  return message.trim().toLowerCase().replace(/\s+/gu, "");
}

/**
 * 是否属于"明显超出训练助手范围"的提问（天气/笑话/股票等黑名单，或空消息）。
 *
 * 用于把 `unsupported` 细分：命中此判定 → 保持礼貌拒答；未命中（只是没听懂的训练相关问题）
 * → 上层可走知识检索兜底 + 澄清，而不是直接死给。
 *
 * @param message - 用户原始消息
 * @returns 是否为越界/空提问
 */
export function isOutOfScopeMessage(message: string): boolean {
  const normalizedMessage = message.trim();

  return (
    normalizedMessage === "" || UNSUPPORTED_PATTERN.test(normalizedMessage)
  );
}

export function classifyAssistantIntent(
  message: string,
): AssistantIntentClassification {
  const normalizedMessage = message.trim();
  const compactMessage = normalizeCompactMessage(message);

  if (!normalizedMessage || UNSUPPORTED_PATTERN.test(normalizedMessage)) {
    return {
      intent: "unsupported",
      reason: "The question is outside the training assistant scope.",
    };
  }

  const asksRpeKnowledge =
    RPE_KNOWLEDGE_PATTERN.test(compactMessage) ||
    SUBJECTIVE_EFFORT_KNOWLEDGE_PATTERN.test(compactMessage);
  const asksKnowledge =
    asksRpeKnowledge || KNOWLEDGE_PATTERN.test(normalizedMessage);
  if (WEEKLY_REPORT_PATTERN.test(normalizedMessage)) {
    return {
      intent: "weekly_report",
      reason: "The question asks for a weekly training report.",
    };
  }

  if (PLATEAU_DIAGNOSIS_PATTERN.test(normalizedMessage)) {
    return {
      intent: "plateau_diagnosis",
      reason: "The question asks for plateau diagnosis.",
    };
  }

  if (NEXT_WEEK_PLAN_PATTERN.test(normalizedMessage)) {
    return {
      intent: "next_week_plan",
      reason: "The question asks for a next-week training draft.",
    };
  }

  if (asksKnowledge && PROGRESS_PATTERN.test(normalizedMessage)) {
    return {
      intent: "mixed_tool_rag",
      reason:
        "The question needs both user training data and training knowledge.",
    };
  }

  if (EVIDENCE_PATTERN.test(normalizedMessage)) {
    return {
      intent: "evidence",
      reason: "The question asks how the assistant reached its judgement.",
    };
  }

  if (HISTORY_PATTERN.test(normalizedMessage)) {
    return {
      intent: "exercise_history",
      reason: "The question asks about previous training records.",
    };
  }

  if (PROGRESS_PATTERN.test(normalizedMessage)) {
    return {
      intent: "progress",
      reason: "The question asks about exercise progress or plateau.",
    };
  }

  if (IMBALANCE_PATTERN.test(normalizedMessage)) {
    return {
      intent: "imbalance",
      reason: "The question asks about training balance.",
    };
  }

  if (RECOMMENDATION_PATTERN.test(normalizedMessage)) {
    return {
      intent: "recommendation",
      reason: "The question asks for next training focus.",
    };
  }

  const namesPeriodWithTrainingAction =
    DATE_TERM_PATTERN.test(normalizedMessage) &&
    TRAINING_ACTION_PATTERN.test(normalizedMessage);

  if (
    SUMMARY_PATTERN.test(normalizedMessage) ||
    namesPeriodWithTrainingAction
  ) {
    return {
      intent: "summary",
      reason: "The question asks for a training summary.",
    };
  }

  if (asksKnowledge) {
    return {
      intent: "knowledge",
      reason: "The question asks for general training knowledge.",
    };
  }

  return {
    intent: "unsupported",
    reason: "No supported training intent matched.",
  };
}
