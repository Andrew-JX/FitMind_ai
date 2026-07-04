import { describe, expect, it } from "vitest";

import type { WorkoutIntakeParseRequest } from "../../schemas/workout-intake-schemas.js";
import type { WorkoutIntakeExerciseDictionaryItem } from "./workout-intake-parser.js";
import { parseHybridWorkoutIntakeDraft } from "./workout-intake-hybrid-parser.js";

const dictionary: WorkoutIntakeExerciseDictionaryItem[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    code: "bench_press_barbell",
    name_en: "Barbell Bench Press",
    name_zh: "\u6760\u94c3\u5367\u63a8",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    code: "incline_bench_press_dumbbell",
    name_en: "Incline Dumbbell Bench Press",
    name_zh: "\u4e0a\u659c\u54d1\u94c3\u5367\u63a8",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    code: "lat_pulldown_cable",
    name_en: "Lat Pulldown",
    name_zh: "\u9ad8\u4f4d\u4e0b\u62c9",
  },
];

function createInput(text: string): WorkoutIntakeParseRequest {
  return {
    performed_at: "2026-05-29T10:00:00.000Z",
    text,
  };
}

function expectNoFakeZeroSets(
  result: Awaited<ReturnType<typeof parseHybridWorkoutIntakeDraft>>,
) {
  for (const exercise of result.draft.exercises) {
    for (const set of exercise.sets) {
      expect(set.weight_kg).toBeGreaterThan(0);
      expect(set.reps).toBeGreaterThan(0);
    }
  }
}

describe("parseHybridWorkoutIntakeDraft", () => {
  it("keeps high-quality rule parser results without calling LLM fallback", async () => {
    const result = await parseHybridWorkoutIntakeDraft(
      createInput("\u6760\u94c3\u5367\u63a8\u4e09\u7ec4 60x10 65x8 70x6"),
      dictionary,
      { provider: "mock" },
    );

    expect(result.evidence.source).toBe("rule_parser");
    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "\u6760\u94c3\u5367\u63a8",
      match_status: "matched",
      sets: [
        { reps: 10, weight_kg: 60 },
        { reps: 8, weight_kg: 65 },
        { reps: 6, weight_kg: 70 },
      ],
    });
    expectNoFakeZeroSets(result);
  });

  it("uses mock LLM fallback for oral decimal workout text", async () => {
    const result = await parseHybridWorkoutIntakeDraft(
      createInput(
        "\u6211\u4eca\u5929\u505a\u4e86\u4e0a\u659c\u54d1\u94c3\u5367\u63a8\u505a\u4e86\u4e09\u7ec4\u6bcf\u7ec4\u662f27.5\u516c\u65a4 \u6bcf\u7ec4\u7684\u6b21\u6570\u662f8",
      ),
      dictionary,
      { provider: "mock" },
    );

    expect(result.evidence.source).toBe("llm_structured_fallback");
    expect(result.draft.exercises).toHaveLength(1);
    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "\u4e0a\u659c\u54d1\u94c3\u5367\u63a8",
      match_status: "matched",
      matched_exercise_id: "22222222-2222-4222-8222-222222222222",
      sets: [
        { reps: 8, weight_kg: 27.5 },
        { reps: 8, weight_kg: 27.5 },
        { reps: 8, weight_kg: 27.5 },
      ],
    });
    expect(result.unresolved_items).toEqual([]);
    expectNoFakeZeroSets(result);
  });

  it("preserves deterministic date parsing when LLM fallback builds the draft", async () => {
    const result = await parseHybridWorkoutIntakeDraft(
      {
        performed_at: "2026-05-30T10:00:00.000+10:00",
        text: "\u6628\u5929\u6211\u505a\u4e86\u4e0a\u659c\u54d1\u94c3\u5367\u63a8\u505a\u4e86\u4e09\u7ec4\u6bcf\u7ec4\u662f27.5\u516c\u65a4 \u6bcf\u7ec4\u7684\u6b21\u6570\u662f8",
      },
      dictionary,
      { provider: "mock" },
    );

    expect(result.evidence.source).toBe("llm_structured_fallback");
    expect(result.draft).toMatchObject({
      date_label: "\u6628\u5929",
      date_source: "explicit_text",
      performed_at: "2026-05-29T10:00:00.000+10:00",
    });
    expect(result.draft.exercises[0]?.sets).toHaveLength(3);
  });

  it("uses mock LLM fallback for realistic oral high-pulldown workout text", async () => {
    const result = await parseHybridWorkoutIntakeDraft(
      createInput(
        "\u6211\u4eca\u5929\u8bad\u7ec3\u4e86\u80cc\u90e8\u505a\u4e86\u9ad8\u4f4d\u4e0b\u62c9\u505a\u4e863\u7ec4\u6bcf\u7ec4\u505a\u7684\u662f70\u516c\u65a4\u7136\u540e\u6bcf\u7ec4\u505a\u4e8610\u6b21",
      ),
      dictionary,
      { provider: "mock" },
    );

    expect(result.evidence.source).toMatch(
      /^(rule_parser|llm_structured_fallback)$/u,
    );
    expect(result.draft.exercises).toHaveLength(1);
    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "\u9ad8\u4f4d\u4e0b\u62c9",
      match_status: "matched",
      matched_exercise_id: "33333333-3333-4333-8333-333333333333",
      incomplete_sets: [],
      sets: [
        { reps: 10, weight_kg: 70 },
        { reps: 10, weight_kg: 70 },
        { reps: 10, weight_kg: 70 },
      ],
    });
    expect(result.unresolved_items).toEqual([]);
    expect(result.warnings).toEqual([]);
    expectNoFakeZeroSets(result);
  });

  it("uses mock LLM fallback for oral high-pulldown text with explicit reps field", async () => {
    const result = await parseHybridWorkoutIntakeDraft(
      createInput(
        "\u6211\u4eca\u5929\u8bad\u7ec3\u4e86\u80cc\u90e8\u505a\u4e86\u9ad8\u4f4d\u4e0b\u62c9\u505a\u4e863\u7ec4\u6bcf\u7ec4\u505a\u7684\u662f70\u516c\u65a4 \u6bcf\u7ec4\u7684\u6b21\u6570\u662f10",
      ),
      dictionary,
      { provider: "mock" },
    );

    expect(result.evidence.source).toBe("llm_structured_fallback");
    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "\u9ad8\u4f4d\u4e0b\u62c9",
      match_status: "matched",
      sets: [
        { reps: 10, weight_kg: 70 },
        { reps: 10, weight_kg: 70 },
        { reps: 10, weight_kg: 70 },
      ],
    });
    expect(result.warnings).toEqual([]);
    expectNoFakeZeroSets(result);
  });

  it("triggers fallback when the rule parser matches an exercise without valid sets", async () => {
    let fallbackCalls = 0;
    const result = await parseHybridWorkoutIntakeDraft(
      createInput("\u9ad8\u4f4d\u4e0b\u62c9"),
      dictionary,
      {
        llmParser: async () => {
          fallbackCalls += 1;

          return JSON.stringify({
            exercises: [
              {
                spoken_name: "\u9ad8\u4f4d\u4e0b\u62c9",
                sets: [{ reps: 10, weight_kg: 70 }],
                incomplete_sets: [],
              },
            ],
            warnings: [],
          });
        },
        provider: "mock",
      },
    );

    expect(fallbackCalls).toBe(1);
    expect(result.evidence.source).toBe("llm_structured_fallback");
    expect(result.draft.exercises[0]?.sets).toEqual([
      { intensity_label: null, reps: 10, rpe: null, weight_kg: 70 },
    ]);
  });

  it("does not guess missing reps in LLM fallback output", async () => {
    const result = await parseHybridWorkoutIntakeDraft(
      createInput(
        "\u9ad8\u4f4d\u4e0b\u62c9\u5341\u7ec4\u6bcf\u7ec470\u516c\u65a4",
      ),
      dictionary,
      { provider: "mock" },
    );

    expect(result.evidence.source).toBe("llm_structured_fallback");
    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "\u9ad8\u4f4d\u4e0b\u62c9",
      match_status: "matched",
      sets: [],
      incomplete_sets: [
        {
          group_count: 10,
          missing_fields: ["reps"],
          reps: null,
          weight_kg: 70,
        },
      ],
    });
    expectNoFakeZeroSets(result);
  });

  it("does not let an empty LLM fallback erase a conservative rule draft", async () => {
    const result = await parseHybridWorkoutIntakeDraft(
      createInput(
        "\u9ad8\u4f4d\u4e0b\u62c9\u5341\u7ec4\u6bcf\u7ec470\u516c\u65a4",
      ),
      dictionary,
      {
        llmParser: async () =>
          JSON.stringify({
            exercises: [],
            warnings: [
              "\u667a\u80fd\u89e3\u6790\u6ca1\u6709\u8bc6\u522b\u5230\u660e\u786e\u52a8\u4f5c\u3002",
            ],
          }),
        provider: "mock",
      },
    );

    expect(result.evidence.source).toBe("rule_parser_llm_unavailable");
    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "\u9ad8\u4f4d\u4e0b\u62c9",
      match_status: "matched",
      sets: [],
      incomplete_sets: [
        {
          group_count: 10,
          missing_fields: ["reps"],
          weight_kg: 70,
        },
      ],
    });
  });

  it("returns Chinese warnings when fallback output still needs user correction", async () => {
    const result = await parseHybridWorkoutIntakeDraft(
      createInput(
        "\u9ad8\u4f4d\u4e0b\u62c9\u5341\u7ec4\u6bcf\u7ec470\u516c\u65a4",
      ),
      dictionary,
      { provider: "mock" },
    );

    expect(result.warnings).toContain(
      "\u6709\u7ec4\u6570\u4fe1\u606f\u4e0d\u5b8c\u6574\uff0c\u8bf7\u8865\u5145\u91cd\u91cf\u6216\u6b21\u6570\u540e\u518d\u4fdd\u5b58\u3002",
    );
    expect(result.warnings.join(" ")).not.toMatch(/[A-Za-z]/u);
  });

  it("falls back to the rule parser result when LLM JSON is invalid", async () => {
    const result = await parseHybridWorkoutIntakeDraft(
      createInput(
        "\u6211\u4eca\u5929\u505a\u4e86\u4e0a\u659c\u54d1\u94c3\u5367\u63a8\u505a\u4e86\u4e09\u7ec4\u6bcf\u7ec4\u662f27.5\u516c\u65a4 \u6bcf\u7ec4\u7684\u6b21\u6570\u662f8",
      ),
      dictionary,
      {
        llmParser: async () => "not json",
        provider: "mock",
      },
    );

    expect(result.evidence.source).toBe("rule_parser_llm_unavailable");
    expect(result.evidence.fallback_warnings[0]).toContain(
      "\u667a\u80fd\u89e3\u6790\u7ed3\u679c\u672a\u901a\u8fc7\u6821\u9a8c\uff0c\u5df2\u8fd4\u56de\u4fdd\u5b88\u89c4\u5219\u89e3\u6790\u8349\u7a3f\u3002",
    );
  });

  it("escalates to LLM fallback when varied per-set weights look flattened by the rule parser", async () => {
    let fallbackCalls = 0;
    const result = await parseHybridWorkoutIntakeDraft(
      createInput(
        "杠铃卧推 第一组60公斤做了10个 第二组加到70公斤做8个 第三组80公斤做6个",
      ),
      dictionary,
      {
        llmParser: async () => {
          fallbackCalls += 1;

          return JSON.stringify({
            exercises: [
              {
                spoken_name: "杠铃卧推",
                sets: [
                  { reps: 10, weight_kg: 60 },
                  { reps: 8, weight_kg: 70 },
                  { reps: 6, weight_kg: 80 },
                ],
                incomplete_sets: [],
              },
            ],
            warnings: [],
          });
        },
        provider: "mock",
      },
    );

    expect(fallbackCalls).toBe(1);
    expect(result.evidence.source).toBe("llm_structured_fallback");
    expect(result.draft.exercises[0]?.sets).toEqual([
      { intensity_label: null, reps: 10, rpe: null, weight_kg: 60 },
      { intensity_label: null, reps: 8, rpe: null, weight_kg: 70 },
      { intensity_label: null, reps: 6, rpe: null, weight_kg: 80 },
    ]);
    expectNoFakeZeroSets(result);
  });

  it("does not escalate when the rule parser already captured every distinct weight", async () => {
    let fallbackCalls = 0;
    const result = await parseHybridWorkoutIntakeDraft(
      createInput("杠铃卧推 60公斤10次 80公斤8次"),
      dictionary,
      {
        llmParser: async () => {
          fallbackCalls += 1;

          return JSON.stringify({ exercises: [], warnings: [] });
        },
        provider: "mock",
      },
    );

    expect(fallbackCalls).toBe(0);
    expect(result.evidence.source).toBe("rule_parser");
    expect(result.draft.exercises[0]?.sets).toEqual([
      { intensity_label: null, reps: 10, rpe: null, weight_kg: 60 },
      { intensity_label: null, reps: 8, rpe: null, weight_kg: 80 },
    ]);
  });

  it("ignores an LLM-provided exercise id and re-matches against the dictionary", async () => {
    const result = await parseHybridWorkoutIntakeDraft(
      createInput(
        "\u6211\u4eca\u5929\u505a\u4e86\u4e0a\u659c\u54d1\u94c3\u5367\u63a8\u505a\u4e86\u4e09\u7ec4\u6bcf\u7ec4\u662f27.5\u516c\u65a4 \u6bcf\u7ec4\u7684\u6b21\u6570\u662f8",
      ),
      dictionary,
      {
        llmParser: async () =>
          JSON.stringify({
            exercises: [
              {
                // Bogus id that must be ignored; the real match comes from the dictionary.
                exercise_id: "99999999-9999-4999-8999-999999999999",
                spoken_name: "\u4e0a\u659c\u54d1\u94c3\u5367\u63a8",
                sets: [{ reps: 8, weight_kg: 27.5 }],
                incomplete_sets: [],
              },
            ],
            warnings: [],
          }),
        provider: "mock",
      },
    );

    expect(result.evidence.source).toBe("llm_structured_fallback");
    expect(result.draft.exercises[0]?.matched_exercise_id).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
  });
});
