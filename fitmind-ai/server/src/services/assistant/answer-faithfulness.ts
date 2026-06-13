import type { AssistantStructuredAnswer } from "./assistant-answer-composer.js";

/**
 * 数字匹配的相对容差（覆盖大数 toLocaleString / 显示侧的轻微取整）。
 * 例：1RM 102.5 kg 与工具原始值之间允许 1% 漂移。
 */
const NUMERIC_RELATIVE_TOLERANCE = 0.01;
/**
 * 数字匹配的绝对容差下限（覆盖 toFixed(0)/toFixed(1) 的四舍五入）。
 * 例：ratio 0.5499 → formatPercent toFixed(0) = "55"，与 54.99 相差 0.01。
 */
const NUMERIC_ABSOLUTE_TOLERANCE = 0.5;
/** ratio（0~1）在文案里常以百分比呈现：contribution_ratio 0.4 → "40.0%"。 */
const RATIO_PERCENT_MULTIPLIER = 100;
/**
 * 抽取答案数字前先剥离的"纯序号"模式（第N步 / 第N位）。
 * 这些是结构性序号，不是绑定到工具数据的事实声明，校验它们会制造噪声。
 */
const ORDINAL_STRIP_PATTERN = /第\s*\d+/gu;
/** UUID 形态的引用 id（workout/set/source）。 */
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu;
/** 文案中的数字 token：支持千分位逗号、小数、尾随百分号。 */
const NUMBER_TOKEN_PATTERN = /(\d[\d,]*(?:\.\d+)?)(%?)/gu;
/** 字符串值里内嵌的数字（如日期 "2026-06-01"、"102.5 kg"）。 */
const EMBEDDED_NUMBER_PATTERN = /\d+(?:\.\d+)?/gu;

/**
 * 运行时 faithfulness 校验结果。
 *
 * `status` 仅作标注，不拦截答案；`unverifiedClaims` 列出在本轮工具输出里
 * 找不到来源的数字 / 引用 token。
 */
export interface AnswerFaithfulnessResult {
  status: "verified" | "flagged";
  checkedNumbers: number;
  unverifiedClaims: string[];
}

/**
 * 确定性校验：结构化答案文本里出现的「数字与引用」是否都能在本轮工具输出里找到。
 *
 * 这是把"证据绑定"从设计口号变成被强制校验的不变量的护栏：真实模型会编造数字，
 * mock 不会，护栏先于真实模型就位。默认只标注不拦截。
 *
 * @param answer - 即将返回给用户的结构化答案
 * @param toolOutputs - 本轮实际执行过的工具结果对象集合（agent 路径为聚合后的结果集）
 * @returns 校验结果：status + 已核对数字数量 + 未验证声明列表
 *
 * @remarks
 * 思路：从所有工具输出深度遍历收集「可接受数字集合」（原始值 + 数组长度 + 字符串
 * 内嵌数字 + ratio×100 的百分比），再从答案 summary/bullets/conclusion/recommendation
 * 抽取数字 token 逐个带容差比对。任何匹配不上的数字 → unverifiedClaims。
 * 文本中出现的 UUID 引用若不在 evidence / sources 中也计入。
 */
export function verifyAnswerFaithfulness(
  answer: AssistantStructuredAnswer,
  toolOutputs: unknown[],
): AnswerFaithfulnessResult {
  const acceptableNumbers: number[] = [];
  for (const output of toolOutputs) {
    collectAcceptableNumbers(output, acceptableNumbers);
  }

  const allowedIds = new Set<string>([
    ...answer.evidence.workout_ids,
    ...answer.evidence.set_ids,
    ...answer.sources.map((source) => source.id),
  ]);

  const rawText = [
    answer.summary,
    ...answer.bullets,
    answer.conclusion,
    answer.recommendation,
  ].join("\n");

  const unverifiedClaims: string[] = [];

  // 1) 先核对引用 id，再把 UUID 从文本剥离（避免 UUID 里的数字被当成数字 token）。
  for (const id of extractUuids(rawText)) {
    if (!allowedIds.has(id.toLowerCase())) {
      unverifiedClaims.push(id);
    }
  }

  const numericText = rawText
    .replace(UUID_PATTERN, " ")
    .replace(ORDINAL_STRIP_PATTERN, " ");

  // 2) 逐个核对数字 token。
  let checkedNumbers = 0;
  for (const token of extractNumberTokens(numericText)) {
    checkedNumbers += 1;
    if (!isNumberAcceptable(token.value, acceptableNumbers)) {
      unverifiedClaims.push(token.raw);
    }
  }

  return {
    status: unverifiedClaims.length === 0 ? "verified" : "flagged",
    checkedNumbers,
    unverifiedClaims,
  };
}

/**
 * 是否在 dev 自查模式下对 flagged 结果抛错。
 *
 * 默认关闭（生产 / 测试安全）；仅当显式设置 `FAITHFULNESS_STRICT=1` 且非 production 时开启。
 *
 * @returns 是否启用严格抛错
 */
export function shouldStrictlyVerify(): boolean {
  return (
    process.env.FAITHFULNESS_STRICT === "1" &&
    process.env.NODE_ENV !== "production"
  );
}

/**
 * dev 自查：在严格模式下，flagged 结果直接抛错以便尽早发现编造。
 *
 * @param result - faithfulness 校验结果
 * @throws 当 {@link shouldStrictlyVerify} 为真且 status 为 flagged
 */
export function enforceFaithfulnessInDev(result: AnswerFaithfulnessResult): void {
  if (shouldStrictlyVerify() && result.status === "flagged") {
    throw new Error(
      `Answer faithfulness check flagged unverified claims: ${result.unverifiedClaims.join(", ")}`,
    );
  }
}

interface NumberToken {
  raw: string;
  value: number;
}

function extractNumberTokens(text: string): NumberToken[] {
  const tokens: NumberToken[] = [];

  for (const match of text.matchAll(NUMBER_TOKEN_PATTERN)) {
    const [raw, digits] = match;
    if (digits === undefined) {
      continue;
    }

    const value = Number(digits.replace(/,/gu, ""));
    if (Number.isFinite(value)) {
      tokens.push({ raw, value });
    }
  }

  return tokens;
}

function extractUuids(text: string): string[] {
  return text.match(UUID_PATTERN) ?? [];
}

function isNumberAcceptable(value: number, acceptable: number[]): boolean {
  return acceptable.some((candidate) => {
    const tolerance = Math.max(
      NUMERIC_ABSOLUTE_TOLERANCE,
      NUMERIC_RELATIVE_TOLERANCE * Math.abs(candidate),
    );

    return Math.abs(value - candidate) <= tolerance;
  });
}

function collectAcceptableNumbers(value: unknown, acc: number[]): void {
  if (typeof value === "number") {
    addNumberVariants(value, acc);
    return;
  }

  if (typeof value === "string") {
    for (const match of value.matchAll(EMBEDDED_NUMBER_PATTERN)) {
      const parsed = Number(match[0]);
      if (Number.isFinite(parsed)) {
        addNumberVariants(parsed, acc);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    // 数组长度本身常被文案当作计数（如 "X 条 workout"）。
    addNumberVariants(value.length, acc);
    for (const item of value) {
      collectAcceptableNumbers(item, acc);
    }
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) {
      collectAcceptableNumbers(item, acc);
    }
  }
}

function addNumberVariants(value: number, acc: number[]): void {
  if (!Number.isFinite(value)) {
    return;
  }

  acc.push(value);

  // ratio（0~1）在文案里常以百分比出现，预先加入 value×100。
  if (value >= 0 && value <= 1) {
    acc.push(value * RATIO_PERCENT_MULTIPLIER);
  }
}
