import type { RetrievedKnowledgeChunk } from "./knowledge-retriever.js";

export interface RagEvalCase {
  id: string;
  topic:
    | "rpe"
    | "bench_plateau"
    | "volume"
    | "deload"
    | "recovery"
    | "progressive_overload"
    | "technique"
    | "unsupported";
  question: string;
  expectedSourceIncludes?: string | undefined;
  unsupported?: boolean | undefined;
}

export interface RagEvalResult {
  passed: boolean;
  failures: string[];
  total: number;
  metrics: RagEvalMetrics;
}

export interface RagEvalCaseRank {
  id: string;
  expectedRank: number | null;
}

export interface RagEvalMetrics {
  top1HitRate: number;
  top3HitRate: number;
  mrr: number;
  caseRanks: RagEvalCaseRank[];
}

export const ragEvalCases: RagEvalCase[] = [
  {
    id: "rpe-cn",
    topic: "rpe",
    question: "RPE 是什么？",
    expectedSourceIncludes: "RPE",
  },
  {
    id: "rpe-en",
    topic: "rpe",
    question: "How should I understand RPE in lifting?",
    expectedSourceIncludes: "RPE",
  },
  {
    id: "bench-plateau-cn",
    topic: "bench_plateau",
    question: "卧推没进步是不是训练量不够？",
    expectedSourceIncludes: "卧推",
  },
  {
    id: "bench-plateau-en",
    topic: "bench_plateau",
    question: "My bench press 卧推 is stuck 停滞. What should I check?",
    expectedSourceIncludes: "卧推",
  },
  {
    id: "volume-cn",
    topic: "volume",
    question: "训练容量怎么影响增肌？",
    expectedSourceIncludes: "训练",
  },
  {
    id: "volume-en",
    topic: "volume",
    question: "How do I adjust training volume 训练容量?",
    expectedSourceIncludes: "训练容量",
  },
  {
    id: "deload-cn",
    topic: "deload",
    question: "什么时候需要 deload？",
    expectedSourceIncludes: "deload",
  },
  {
    id: "deload-en",
    topic: "deload",
    question: "What is a deload week for?",
    expectedSourceIncludes: "deload",
  },
  {
    id: "recovery-cn",
    topic: "recovery",
    question: "疲劳恢复怎么判断？",
    expectedSourceIncludes: "恢复",
  },
  {
    id: "recovery-en",
    topic: "recovery",
    question:
      "How do I judge training fatigue and recovery 训练疲劳和恢复判断?",
    expectedSourceIncludes: "恢复",
  },
  {
    id: "overload-cn",
    topic: "progressive_overload",
    question: "渐进超负荷是什么意思？",
    expectedSourceIncludes: "渐进",
  },
  {
    id: "overload-en",
    topic: "progressive_overload",
    question: "What does progressive overload 渐进超负荷 mean?",
    expectedSourceIncludes: "渐进",
  },
  {
    id: "technique-cn",
    topic: "technique",
    question: "深蹲膝盖内扣怎么调整？",
    expectedSourceIncludes: "深蹲",
  },
  {
    id: "unsupported-joke",
    topic: "unsupported",
    question: "给我讲个笑话",
    unsupported: true,
  },
  {
    id: "unsupported-weather",
    topic: "unsupported",
    question: "今天悉尼天气怎么样？",
    unsupported: true,
  },
];

export async function evaluateRagCases(
  cases: RagEvalCase[],
  retrieve: (
    question: string,
    testCase: RagEvalCase,
  ) => Promise<
    Array<Pick<RetrievedKnowledgeChunk, "title" | "retrieval_mode">>
  >,
): Promise<RagEvalResult> {
  const failures: string[] = [];
  const caseRanks: RagEvalCaseRank[] = [];

  for (const testCase of cases) {
    const sources = await retrieve(testCase.question, testCase);
    const topThreeTitles = sources
      .slice(0, 3)
      .map((source) => source.title.toLowerCase());

    if (testCase.unsupported === true) {
      if (sources.length > 0) {
        failures.push(`${testCase.id}: expected no sources`);
      }

      continue;
    }

    const expected = testCase.expectedSourceIncludes?.toLowerCase();
    const expectedRank =
      expected === undefined
        ? null
        : sources.findIndex((source) =>
            source.title.toLowerCase().includes(expected),
          );

    caseRanks.push({
      id: testCase.id,
      expectedRank:
        expectedRank === null || expectedRank < 0 ? null : expectedRank + 1,
    });

    if (
      expected !== undefined &&
      !topThreeTitles.some((title) => title.includes(expected))
    ) {
      failures.push(
        `${testCase.id}: expected source containing ${testCase.expectedSourceIncludes}`,
      );
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    total: cases.length,
    metrics: calculateRagEvalMetrics(caseRanks),
  };
}

function calculateRagEvalMetrics(caseRanks: RagEvalCaseRank[]): RagEvalMetrics {
  if (caseRanks.length === 0) {
    return {
      top1HitRate: 0,
      top3HitRate: 0,
      mrr: 0,
      caseRanks,
    };
  }

  const top1Hits = caseRanks.filter((rank) => rank.expectedRank === 1).length;
  const top3Hits = caseRanks.filter(
    (rank) => rank.expectedRank !== null && rank.expectedRank <= 3,
  ).length;
  const reciprocalRankSum = caseRanks.reduce(
    (sum, rank) =>
      sum + (rank.expectedRank === null ? 0 : 1 / rank.expectedRank),
    0,
  );

  return {
    top1HitRate: top1Hits / caseRanks.length,
    top3HitRate: top3Hits / caseRanks.length,
    mrr: reciprocalRankSum / caseRanks.length,
    caseRanks,
  };
}
