import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import * as deterministicAnswers from "./assistant-deterministic-answers.js";
import type {
  ExerciseProgressResult,
  RecommendationContextResult,
  TrainingOverviewResult,
  WeeklyTrainingReportResult,
} from "./assistant-deterministic-answers.js";

const {
  buildExerciseProgressAnswer,
  buildPlateauDiagnosisAnswer,
  buildProviderErrorFallbackGuidance,
  buildProviderMessageAnswer,
  buildRecommendationContextAnswer,
  buildTrainingOverviewAnswer,
  buildWeeklyTrainingReportAnswer,
  normalizeStructuredAnswer,
} = deterministicAnswers;
const assistantDirectory = dirname(fileURLToPath(import.meta.url));
const builderNames = [
  "buildExerciseProgressAnswer",
  "buildPlateauDiagnosisAnswer",
  "buildProviderErrorFallbackGuidance",
  "buildProviderMessageAnswer",
  "buildRecommendationContextAnswer",
  "buildTrainingOverviewAnswer",
  "buildWeeklyTrainingReportAnswer",
  "normalizeStructuredAnswer",
] as const;

const trainingOverview: TrainingOverviewResult = {
  range: { start_date: "2026-08-01", end_date: "2026-08-07" },
  totals: {
    workout_count: 2,
    set_count: 4,
    total_reps: 30,
    total_volume: 100.25,
  },
  by_exercise: [{ exercise_name: "Bench Press", total_volume: 100.25 }],
  evidence: {
    workout_ids: ["w1", "w1", "w2"],
    calculation_rules: ["weight_x_reps", "weight_x_reps"],
  },
};

const exerciseProgress: ExerciseProgressResult = {
  range: { start_date: "2026-08-01", end_date: "2026-08-07" },
  exercise: { exercise_id: "e1", exercise_name: "Bench Press" },
  totals: {
    workout_count: 2,
    set_count: 4,
    total_reps: 30,
    total_volume: 1_200,
    max_weight_kg: 90.24,
    estimated_1rm_kg: 100.25,
  },
  sessions: [{ performed_at: "2026-08-06T12:00:00.000Z" }],
  evidence: {
    workout_ids: ["w1", "w1", "w2"],
    set_ids: ["s1", "s1", "s2"],
    calculation_rules: ["epley", "epley"],
  },
};

const weeklyReport: WeeklyTrainingReportResult = {
  range: { start_date: "2026-08-01", end_date: "2026-08-07" },
  status: "ready",
  totals: {
    workout_count: 3,
    set_count: 12,
    total_reps: 90,
    total_volume: 12_000,
    total_weighted_volume: 12_000,
  },
  frequency: { range_days: 30, workouts_per_week: 2.5 },
  top_exercises: [
    { exercise_name: "Bench Press", set_count: 6, total_volume: 7_200 },
  ],
  top_muscle_groups: [{ muscle_group_name: "Chest", contribution_ratio: 0.4 }],
  low_volume_muscle_groups: [
    { muscle_group_name: "Back", contribution_ratio: 0.1236 },
  ],
  selected_exercise_progress: null,
  recovery_notes: [],
  limitations: [],
  evidence: {
    workout_ids: ["w1", "w1", "w2"],
    set_ids: ["s1", "s1", "s2"],
    calculation_rules: ["weekly", "weekly"],
  },
};

const recommendationContext: RecommendationContextResult = {
  range: { start_date: "2026-08-01", end_date: "2026-08-07" },
  summary: {
    workout_count: 4,
    set_count: 10,
    total_reps: 80,
    total_volume: 1_000,
    by_exercise: [
      { exercise_name: "Bench Press", total_volume: 600 },
      { exercise_name: "Barbell Row", total_volume: 300 },
      { exercise_name: "Squat", total_volume: 100 },
    ],
  },
  focus_exercises: [{ exercise_name: "Bench Press", total_volume: 600 }],
  recent_workouts: [
    { workout_id: "w4", performed_at: "2026-08-09T12:00:00.000Z" },
  ],
  evidence: {
    workout_ids: ["w1", "w1", "w2"],
    set_ids: ["s1", "s1", "s2"],
    calculation_rules: ["recommendation", "recommendation"],
  },
};

afterEach(() => {
  vi.useRealTimers();
});

describe("assistant deterministic answers characterization", () => {
  it("keeps the runtime builder surface exact", () => {
    expect(Object.keys(deterministicAnswers).sort()).toEqual([...builderNames]);
  });

  it("keeps one definition owner and a one-way module dependency", () => {
    const orchestratorSource = readFileSync(
      join(assistantDirectory, "assistant-orchestrator-service.ts"),
      "utf8",
    );
    const answersSource = readFileSync(
      join(assistantDirectory, "assistant-deterministic-answers.ts"),
      "utf8",
    );
    const typeNames = [
      "TrainingOverviewResult",
      "ExerciseProgressResult",
      "RecommendationContextResult",
      "WeeklyTrainingReportResult",
      "AssistantAnswerCore",
    ];

    for (const builderName of builderNames) {
      const definition = new RegExp(`export function ${builderName}\\b`, "g");
      expect(
        (orchestratorSource.match(definition) ?? []).length +
          (answersSource.match(definition) ?? []).length,
        builderName,
      ).toBe(1);
    }

    for (const typeName of typeNames) {
      const definition = new RegExp(`export interface ${typeName}\\b`, "g");
      expect(
        (orchestratorSource.match(definition) ?? []).length +
          (answersSource.match(definition) ?? []).length,
        typeName,
      ).toBe(1);
    }

    const orchestratorDependsOnAnswers = orchestratorSource.includes(
      'from "./assistant-deterministic-answers.js"',
    );
    const answersDependsOnOrchestrator = answersSource.includes(
      'from "./assistant-orchestrator-service.js"',
    );
    expect(
      Number(orchestratorDependsOnAnswers) +
        Number(answersDependsOnOrchestrator),
    ).toBe(1);
    expect(answersSource).not.toContain("as unknown as");
    expect(answersSource).not.toMatch(/\bany\b/u);
    expect(answersSource).not.toContain("@ts-ignore");
  });

  it("builds empty and ready training overviews with exact evidence", () => {
    const empty = buildTrainingOverviewAnswer({
      ...trainingOverview,
      totals: {
        workout_count: 0,
        set_count: 0,
        total_reps: 0,
        total_volume: 0,
      },
      by_exercise: [],
      evidence: { workout_ids: [], calculation_rules: [] },
    });
    const ready = buildTrainingOverviewAnswer(trainingOverview);

    expect(empty).toEqual({
      summary:
        "根据当前时间范围内的训练记录，你还没有可用的训练数据。先完成几次训练，助手才能给出更有意义的总览和建议。",
      bullets: [
        "统计范围：2026-08-01 到 2026-08-07",
        "当前训练次数：0 次",
        "当前训练量：0 kg",
      ],
      evidence: {
        source: "deterministic_tool_executor",
        tool_names: ["get_training_summary"],
        workout_ids: [],
        set_ids: [],
        calculation_rules: [],
      },
    });
    expect(ready.summary).toBe(
      "根据统计范围内的训练记录，你共训练了 2 次，完成 4 组，累计 30 次，总训练量约 100.5 kg。",
    );
    expect(ready.bullets).toEqual([
      "统计范围：2026-08-01 到 2026-08-07",
      "当前训练量最集中的动作是 Bench Press，累计约 100.5 kg。",
      "这个总结来自 3 条已记录 workout。",
      "这些数字来自已记录训练，不是模型凭空猜测。",
    ]);
    expect(ready.evidence).toEqual({
      source: "deterministic_tool_executor",
      tool_names: ["get_training_summary"],
      workout_ids: ["w1", "w2"],
      set_ids: [],
      calculation_rules: ["weight_x_reps"],
    });
  });

  it("builds empty and ready exercise progress answers", () => {
    const empty = buildExerciseProgressAnswer({
      ...exerciseProgress,
      exercise: { exercise_id: "e1", exercise_name: null },
      totals: {
        workout_count: 0,
        set_count: 0,
        total_reps: 0,
        total_volume: 0,
        max_weight_kg: null,
        estimated_1rm_kg: null,
      },
      sessions: [],
      evidence: { workout_ids: [], set_ids: [], calculation_rules: [] },
    });
    const ready = buildExerciseProgressAnswer(exerciseProgress);

    expect(empty.summary).toBe(
      "当前动作 最近这段时间还没有训练记录，所以我暂时看不出这个动作的稳定进展。",
    );
    expect(empty.bullets[0]).toBe("统计范围：2026-08-01 到 2026-08-07");
    expect(ready.summary).toBe(
      "根据统计范围内的 Bench Press 训练记录，当前估算 1RM 约为 100.5 kg，观察到的最高训练重量约为 90 kg。",
    );
    expect(ready.evidence).toEqual({
      source: "deterministic_tool_executor",
      tool_names: ["get_exercise_progress"],
      workout_ids: ["w1", "w2"],
      set_ids: ["s1", "s2"],
      calculation_rules: ["epley"],
    });
  });

  it("builds empty and ready weekly reports with exact percentages", () => {
    const empty = buildWeeklyTrainingReportAnswer({
      ...weeklyReport,
      status: "empty",
      totals: {
        workout_count: 0,
        set_count: 0,
        total_reps: 0,
        total_volume: 0,
        total_weighted_volume: 0,
      },
      top_exercises: [],
      top_muscle_groups: [],
      low_volume_muscle_groups: [],
      evidence: { workout_ids: [], set_ids: [], calculation_rules: [] },
    });
    const ready = buildWeeklyTrainingReportAnswer(weeklyReport);

    expect(empty.bullets).toEqual([
      "统计范围：2026-08-01 到 2026-08-07。",
      "当前记录训练次数：0 次。",
      "这个范围内还没有可用于动作或肌群分布分析的 Evidence。",
    ]);
    expect(ready.summary).toBe(
      "统计范围：2026-08-01 到 2026-08-07。共记录 3 次训练，12 组，90 次，总训练量约 12,000 kg。",
    );
    expect(ready.bullets).toContain("记录中占比最高的肌群是 Chest，约 40.0%。");
    expect(ready.bullets).toContain("记录较少的肌群是 Back，约 12.4%。");
    expect(ready.evidence.workout_ids).toEqual(["w1", "w2"]);
    expect(ready.evidence.set_ids).toEqual(["s1", "s2"]);
  });

  it("builds the no-data recommendation answer", () => {
    const answer = buildRecommendationContextAnswer(
      "next_training_focus",
      "下一次练什么",
      {
        ...recommendationContext,
        summary: {
          workout_count: 0,
          set_count: 0,
          total_reps: 0,
          total_volume: 0,
          by_exercise: [],
        },
        recent_workouts: [],
        evidence: { workout_ids: [], set_ids: [], calculation_rules: [] },
      },
    );

    expect(answer).toEqual({
      summary:
        "当前还没有足够的训练记录可供判断。先记录几次训练后，我才能根据真实的 workout 和 set 给出更具体的解释。",
      bullets: [
        "统计范围：2026-08-01 到 2026-08-07",
        "当前没有可用的训练量分布和最近训练记录。",
      ],
      evidence: {
        source: "deterministic_tool_executor",
        tool_names: ["get_recommendation_context"],
        workout_ids: [],
        set_ids: [],
        calculation_rules: [],
      },
    });
  });

  it("routes next-focus, muscle-balance, imbalance, and evidence modes", () => {
    const nextFocus = buildRecommendationContextAnswer(
      "next_training_focus",
      "下一次练什么",
      recommendationContext,
    );
    const balance = buildRecommendationContextAnswer(
      "muscle_balance",
      "胸练得够吗",
      recommendationContext,
    );
    const imbalance = buildRecommendationContextAnswer(
      "training_imbalance",
      "偏科吗",
      recommendationContext,
    );
    const evidence = buildRecommendationContextAnswer(
      "evidence_explain",
      "依据是什么",
      recommendationContext,
    );

    expect(nextFocus.summary).toBe(
      "根据统计范围内的训练记录，下一次训练可以优先补背部或腿部。",
    );
    expect(balance.summary).toBe(
      "从最近记录看，胸部相关训练并不算少，训练量已经比较靠前。 当前动作字典的肌群信息有限，所以这个判断主要基于动作名称和训练量分布。",
    );
    expect(imbalance.summary).toBe(
      "最近训练量有一点集中在 Bench Press，从分布上看存在一定偏科倾向。",
    );
    expect(imbalance.bullets).toContain(
      "Top 3 动作里，第一位约占 60% 的训练量。",
    );
    expect(evidence.bullets).toEqual([
      "统计范围：2026-08-01 到 2026-08-07",
      "当前共参考 3 条 workout、3 条 set。",
      "目前纳入 2 条 calculation rules。",
      "如果当前动作字典的肌群信息不完整，我会更多依据动作名称、训练量和最近训练频率来解释。",
    ]);
  });

  it("keeps recovery guidance on fixed 24-hour buckets", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:00:00.000Z"));

    const answer = buildRecommendationContextAnswer(
      "recovery_check",
      "胸今天还能练吗",
      recommendationContext,
    );

    expect(answer.summary).toBe(
      "胸部相关训练在你最近记录里出现得不算少。 最近一次纳入参考的训练距离现在大约 2 天。 我只能根据训练记录做一般性提醒，不能判断疼痛、疲劳或健康风险。如果有疼痛或不适，应优先休息或咨询专业人士。",
    );
    expect(answer.bullets[0]).toBe("统计范围：2026-08-01 到 2026-08-07");
  });

  it("builds plateau answers with and without sources", () => {
    const noSources = buildPlateauDiagnosisAnswer({
      message: "卧推平台期",
      result: exerciseProgress,
      sources: [],
    });
    const withSources = buildPlateauDiagnosisAnswer({
      message: "卧推平台期",
      result: {
        ...exerciseProgress,
        totals: { ...exerciseProgress.totals, workout_count: 3 },
      },
      sources: [
        {
          id: "k1",
          title: "Progressive overload",
          category: "strength",
          chunk_text: "Increase one variable at a time.",
          source_type: "seed",
          tags: ["progression"],
          score: 0.9,
          retrieval_mode: "hybrid",
        },
      ],
    });

    expect(noSources.bullets).toContain(
      "样本还偏少，所以不能直接判定为真正的平台期。",
    );
    expect(noSources.bullets).toContain("这次诊断没有检索到可用训练知识来源。");
    expect(withSources.bullets).toContain(
      "样本已经可以做初步诊断，但短期表现波动仍然需要考虑。",
    );
    expect(withSources.bullets).toContain("Sources：Progressive overload。");
    expect(withSources.sources).toEqual([
      {
        id: "k1",
        title: "Progressive overload",
        category: "strength",
        chunk_text: "Increase one variable at a time.",
        source_type: "seed",
        tags: ["progression"],
      },
    ]);
    expect(withSources.evidence.tool_names).toEqual(["get_exercise_progress"]);
    expect(withSources.limitations).toHaveLength(2);
  });

  it("keeps provider message evidence and fallback field labels exact", () => {
    expect(buildProviderMessageAnswer("provider text")).toEqual({
      summary: "provider text",
      bullets: [],
      evidence: {
        source: "deterministic_mock_provider",
        tool_names: [],
        workout_ids: [],
        set_ids: [],
        calculation_rules: [],
      },
    });
    expect(
      buildProviderErrorFallbackGuidance([
        "exercise_id",
        "start_date",
        "end_date",
        "custom_field",
      ]),
    ).toBe(
      "暂时无法完成这次训练数据查询。请先指定要分析的动作、开始日期、结束日期、custom_field，再重新提问。",
    );
  });

  it("normalizes a core answer and preserves a structured answer identity", () => {
    const core = buildProviderMessageAnswer("provider text");
    const normalized = normalizeStructuredAnswer(core, "summary");

    expect(normalized).toEqual({
      summary: "provider text",
      bullets: [],
      conclusion: "provider text",
      recommendation:
        "请结合最近训练记录、主观疲劳和动作状态保守调整训练安排。",
      evidence: core.evidence,
      sources: [],
      intent: "summary",
      limitations: [],
    });
    expect(normalizeStructuredAnswer(normalized, "unsupported")).toBe(
      normalized,
    );
  });
});
