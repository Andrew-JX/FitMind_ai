import { describe, expect, it } from "vitest";

import {
  parseWorkoutIntakeDraft,
  type WorkoutIntakeExerciseDictionaryItem,
} from "./workout-intake-parser.js";

const exerciseDictionary: WorkoutIntakeExerciseDictionaryItem[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    code: "bench_press_barbell",
    name_en: "Barbell Bench Press",
    name_zh: "杠铃卧推",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    code: "bench_press_dumbbell",
    name_en: "Dumbbell Bench Press",
    name_zh: "\u54d1\u94c3\u5367\u63a8",
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    code: "incline_bench_press_barbell",
    name_en: "Incline Barbell Bench Press",
    name_zh: "上斜杠铃卧推",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    code: "seated_cable_row",
    name_en: "Seated Cable Row",
    name_zh: "坐姿划船",
  },
];

describe("workout-intake-parser", () => {
  it("parses Chinese bench press sets into a conservative draft", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "今天卧推三组，60公斤10个，65公斤8个，70公斤6个；坐姿划船两组50公斤12个。",
        performed_at: "2026-05-29T10:00:00.000Z",
        duration_min: 60,
        note: "训练状态不错",
      },
      exerciseDictionary,
    );

    expect(result.draft.performed_at).toBe("2026-05-29T10:00:00.000Z");
    expect(result.draft.duration_min).toBe(60);
    expect(result.draft.note).toBe("训练状态不错");
    expect(result.draft.exercises).toHaveLength(2);

    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "卧推",
      match_status: "ambiguous",
      matched_exercise_id: null,
      matched_exercise_name: null,
      sets: [
        { weight_kg: 60, reps: 10, rpe: null, intensity_label: null },
        { weight_kg: 65, reps: 8, rpe: null, intensity_label: null },
        { weight_kg: 70, reps: 6, rpe: null, intensity_label: null },
      ],
    });
    expect(result.draft.exercises[0]?.candidate_exercises).toHaveLength(2);

    expect(result.draft.exercises[1]).toMatchObject({
      input_name: "坐姿划船",
      match_status: "matched",
      matched_exercise_id: "33333333-3333-4333-8333-333333333333",
      matched_exercise_name: "\u5750\u59ff\u5212\u8239",
      sets: [
        { weight_kg: 50, reps: 12, rpe: null, intensity_label: null },
        { weight_kg: 50, reps: 12, rpe: null, intensity_label: null },
      ],
    });
  });

  it("splits multiple exercises separated only by a comma", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "哑铃卧推60公斤8个，坐姿划船50公斤12个",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      exerciseDictionary,
    );

    expect(result.draft.exercises).toHaveLength(2);
    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "哑铃卧推",
      match_status: "matched",
      matched_exercise_id: "22222222-2222-4222-8222-222222222222",
      sets: [{ weight_kg: 60, reps: 8 }],
    });
    expect(result.draft.exercises[1]).toMatchObject({
      input_name: "坐姿划船",
      match_status: "matched",
      matched_exercise_id: "33333333-3333-4333-8333-333333333333",
      sets: [{ weight_kg: 50, reps: 12 }],
    });
  });

  it("splits a run-on multi-exercise utterance with no punctuation", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "哑铃卧推60公斤8个坐姿划船50公斤12个",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      exerciseDictionary,
    );

    expect(result.draft.exercises).toHaveLength(2);
    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "哑铃卧推",
      matched_exercise_id: "22222222-2222-4222-8222-222222222222",
      sets: [{ weight_kg: 60, reps: 8 }],
    });
    expect(result.draft.exercises[1]).toMatchObject({
      input_name: "坐姿划船",
      matched_exercise_id: "33333333-3333-4333-8333-333333333333",
      sets: [{ weight_kg: 50, reps: 12 }],
    });
  });

  it("splits exercises joined by 和 / 还有 connectors", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "杠铃卧推60公斤8次和坐姿划船50公斤10次",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      exerciseDictionary,
    );

    expect(result.draft.exercises).toHaveLength(2);
    expect(result.draft.exercises[0]?.matched_exercise_id).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(result.draft.exercises[1]?.matched_exercise_id).toBe(
      "33333333-3333-4333-8333-333333333333",
    );
  });

  it("converts pounds to kilograms", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "杠铃卧推4组75磅8次",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      exerciseDictionary,
    );

    expect(result.draft.exercises[0]?.sets).toHaveLength(4);
    expect(result.draft.exercises[0]?.sets[0]).toMatchObject({
      weight_kg: 34,
      reps: 8,
    });
  });

  it("merges an announce-then-detail utterance into one entry per exercise", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "做了杠铃卧推和坐姿划船，其中杠铃卧推3组60公斤8次，坐姿划船3组50公斤10次",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      exerciseDictionary,
    );

    expect(result.draft.exercises).toHaveLength(2);
    expect(result.draft.exercises[0]).toMatchObject({
      matched_exercise_id: "11111111-1111-4111-8111-111111111111",
      sets: [
        { weight_kg: 60, reps: 8 },
        { weight_kg: 60, reps: 8 },
        { weight_kg: 60, reps: 8 },
      ],
    });
    expect(result.draft.exercises[1]).toMatchObject({
      matched_exercise_id: "33333333-3333-4333-8333-333333333333",
      sets: [
        { weight_kg: 50, reps: 10 },
        { weight_kg: 50, reps: 10 },
        { weight_kg: 50, reps: 10 },
      ],
    });
  });

  it("keeps an unrecognized second exercise instead of absorbing it into the first", () => {
    // 深蹲 is intentionally absent from the dictionary; its sets must not be
    // merged into the preceding bench press.
    const result = parseWorkoutIntakeDraft(
      {
        text: "杠铃卧推60公斤8次，深蹲100公斤5次",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      exerciseDictionary,
    );

    expect(result.draft.exercises).toHaveLength(2);
    expect(result.draft.exercises[0]).toMatchObject({
      matched_exercise_id: "11111111-1111-4111-8111-111111111111",
      sets: [{ weight_kg: 60, reps: 8 }],
    });
    expect(result.draft.exercises[1]?.input_name).toContain("深蹲");
    expect(result.draft.exercises[1]?.sets).toEqual([
      { weight_kg: 100, reps: 5, rpe: null, intensity_label: null },
    ]);
  });

  it("parses common weight and rep formats", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "杠铃卧推 60kg x 10 65 x 8 70kg 6 reps",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      exerciseDictionary,
    );

    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "杠铃卧推",
      match_status: "matched",
      sets: [
        { weight_kg: 60, reps: 10 },
        { weight_kg: 65, reps: 8 },
        { weight_kg: 70, reps: 6 },
      ],
    });
  });

  it("expands repeated single-set descriptions", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "杠铃卧推三组60公斤10个",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      exerciseDictionary,
    );

    expect(result.draft.exercises[0]?.sets).toEqual([
      { weight_kg: 60, reps: 10, rpe: null, intensity_label: null },
      { weight_kg: 60, reps: 10, rpe: null, intensity_label: null },
      { weight_kg: 60, reps: 10, rpe: null, intensity_label: null },
    ]);
  });

  it("returns unresolved entries for unknown movement names", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "火星推举 20x10",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      exerciseDictionary,
    );

    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "火星推举",
      match_status: "unresolved",
      matched_exercise_id: null,
      matched_exercise_name: null,
      candidate_exercises: [],
    });
    expect(result.unresolved_items).toEqual([
      { text: "火星推举", reason: "no_candidates" },
    ]);
  });
});

const oralExerciseDictionary: WorkoutIntakeExerciseDictionaryItem[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    code: "bench_press_barbell",
    name_en: "Barbell Bench Press",
    name_zh: "\u6760\u94c3\u5367\u63a8",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    code: "bench_press_dumbbell",
    name_en: "Dumbbell Bench Press",
    name_zh: "\u54d1\u94c3\u5367\u63a8",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    code: "seated_cable_row",
    name_en: "Seated Cable Row",
    name_zh: "\u5750\u59ff\u5212\u8239",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    code: "lat_pulldown_cable",
    name_en: "Lat Pulldown",
    name_zh: "\u9ad8\u4f4d\u4e0b\u62c9",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    code: "barbell_row",
    name_en: "Barbell Row",
    name_zh: "\u6760\u94c3\u5212\u8239",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    code: "shoulder_press_dumbbell",
    name_en: "Dumbbell Shoulder Press",
    name_zh: "\u54d1\u94c3\u63a8\u80a9",
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    code: "pull_up_bodyweight",
    name_en: "Pull-Up",
    name_zh: "\u5f15\u4f53\u5411\u4e0a",
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    code: "lateral_raise_dumbbell",
    name_en: "Dumbbell Lateral Raise",
    name_zh: "\u54d1\u94c3\u4fa7\u5e73\u4e3e",
  },
];

function expectNoFakeZeroSets(
  result: ReturnType<typeof parseWorkoutIntakeDraft>,
) {
  for (const exercise of result.draft.exercises) {
    for (const set of exercise.sets) {
      expect(set.weight_kg).toBeGreaterThan(0);
      expect(set.reps).toBeGreaterThan(0);
    }
  }
}

describe("workout-intake-parser oral guardrails", () => {
  it("uses relative date hints from text for draft performed_at", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "\u6628\u5929\u7ec3\u4e86\u9ad8\u4f4d\u4e0b\u62c9\u4e09\u7ec470\u516c\u65a410\u4e2a",
        performed_at: "2026-05-30T10:00:00.000+10:00",
      },
      oralExerciseDictionary,
    );

    expect(result.draft).toMatchObject({
      date_label: "\u6628\u5929",
      date_source: "explicit_text",
      performed_at: "2026-05-29T10:00:00.000+10:00",
    });
  });

  it("uses absolute Chinese date hints from text for draft performed_at", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "\u4e94\u6708\u4e8c\u5341\u4e5d\u53f7\u7ec3\u4e86\u9ad8\u4f4d\u4e0b\u62c9\u4e09\u7ec470\u516c\u65a410\u4e2a",
        performed_at: "2026-05-30T10:00:00.000+10:00",
      },
      oralExerciseDictionary,
    );

    expect(result.draft).toMatchObject({
      date_label: "2026-05-29",
      date_source: "explicit_text",
      performed_at: "2026-05-29T10:00:00.000+10:00",
    });
  });

  it.each([
    "\u9ad8\u4f4d\u4e0b\u62c9\u5341\u7ec4\uff0c\u6bcf\u7ec470\u516c\u65a4\u505a10\u4e2a",
    "\u9ad8\u4f4d\u4e0b\u62c9\u505a\u4e86\u5341\u7ec4\uff0c\u6bcf\u7ec470\u516c\u65a410\u4e2a",
    "\u5341\u7ec4\u9ad8\u4f4d\u4e0b\u62c9\uff0c\u6bcf\u7ec470\u516c\u65a4\u505a10\u4e2a",
  ])("parses oral repeated-set phrasing: %s", (text) => {
    const result = parseWorkoutIntakeDraft(
      {
        text,
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      oralExerciseDictionary,
    );

    expect(result.draft.exercises).toHaveLength(1);
    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "\u9ad8\u4f4d\u4e0b\u62c9",
      match_status: "matched",
      matched_exercise_id: "44444444-4444-4444-8444-444444444444",
    });
    expect(result.draft.exercises[0]?.sets).toHaveLength(10);
    expect(result.draft.exercises[0]?.sets).toEqual(
      Array.from({ length: 10 }, () => ({
        intensity_label: null,
        reps: 10,
        rpe: null,
        weight_kg: 70,
      })),
    );
    expect(result.draft.exercises[0]?.incomplete_sets).toEqual([]);
    expectNoFakeZeroSets(result);
  });

  it("returns incomplete draft data instead of fake zero sets when reps are missing", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "\u6211\u6628\u5929\u8bad\u7ec3\u4e86\u80cc\u90e8\u505a\u4e86\u9ad8\u4f4d\u4e0b\u62c9\u505a\u4e86\u5341\u7ec4\uff0c\u6bcf\u7ec4\u662f70\u516c\u65a4",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      oralExerciseDictionary,
    );

    expect(result.draft.exercises).toHaveLength(1);
    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "\u9ad8\u4f4d\u4e0b\u62c9",
      match_status: "matched",
      matched_exercise_id: "44444444-4444-4444-8444-444444444444",
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
    expect(result.warnings.join(" ")).toContain(
      "\u7ec4\u6570\u4fe1\u606f\u4e0d\u5b8c\u6574",
    );
    expectNoFakeZeroSets(result);
  });

  it("ignores context phrases instead of creating unresolved exercises from oral filler", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "\u6211\u4eca\u5929\u8fd8\u7ec3\u4e86\u80cc\u90e8\u505a\u4e86\u5341\u7ec4\u9ad8\u4f4d\u4e0b\u62c9\u3002\u7136\u540e\u6bcf\u7ec4\u7684\u8bdd\u662f\u752870\u516c\u65a4\u505a\u7684",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      oralExerciseDictionary,
    );

    expect(result.draft.exercises).toHaveLength(1);
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
    expect(result.unresolved_items).toEqual([
      { text: "\u9ad8\u4f4d\u4e0b\u62c9", reason: "incomplete_sets" },
    ]);
    expectNoFakeZeroSets(result);
  });

  it("keeps broad oral movement names ambiguous", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "\u5212\u8239\u4e24\u7ec450\u516c\u65a410\u4e2a",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      oralExerciseDictionary,
    );

    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "\u5212\u8239",
      match_status: "ambiguous",
      matched_exercise_id: null,
      matched_exercise_name: null,
    });
    expect(result.draft.exercises[0]?.candidate_exercises).toHaveLength(2);
    expectNoFakeZeroSets(result);
  });

  it.each([
    [
      "\u54d1\u94c3\u63a8\u80a9\u4e09\u7ec420\u516c\u65a410\u6b21",
      "\u54d1\u94c3\u63a8\u80a9",
      "66666666-6666-4666-8666-666666666666",
      3,
      20,
      10,
    ],
    [
      "\u54d1\u94c3\u4fa7\u5e73\u4e3e\u56db\u7ec48\u516c\u65a412\u6b21",
      "\u54d1\u94c3\u4fa7\u5e73\u4e3e",
      "88888888-8888-4888-8888-888888888888",
      4,
      8,
      12,
    ],
  ])(
    "matches expanded weighted movement aliases: %s",
    (text, inputName, exerciseId, setCount, weightKg, reps) => {
      const result = parseWorkoutIntakeDraft(
        {
          text,
          performed_at: "2026-05-29T10:00:00.000Z",
        },
        oralExerciseDictionary,
      );

      expect(result.draft.exercises[0]).toMatchObject({
        input_name: inputName,
        match_status: "matched",
        matched_exercise_id: exerciseId,
      });
      expect(result.draft.exercises[0]?.sets).toEqual(
        Array.from({ length: setCount as number }, () => ({
          intensity_label: null,
          reps,
          rpe: null,
          weight_kg: weightKg,
        })),
      );
    },
  );

  it("matches bodyweight pull-up aliases as zero-weight completed sets", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "\u5f15\u4f53\u5411\u4e0a\u4e09\u7ec410\u6b21",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      oralExerciseDictionary,
    );

    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "\u5f15\u4f53\u5411\u4e0a",
      match_status: "matched",
      matched_exercise_id: "77777777-7777-4777-8777-777777777777",
      sets: Array.from({ length: 3 }, () => ({
        intensity_label: null,
        reps: 10,
        rpe: null,
        weight_kg: 0,
      })),
      incomplete_sets: [],
    });
  });

  it.each([
    "\u6760\u94c3\u5367\u63a8\u505a\u4e8610\u7ec4\u6bcf\u7ec4\u505a\u7684\u662f70\u516c\u65a4\uff0c\u6bcf\u7ec4\u505a\u4e8610\u6b21",
    "\u9ad8\u4f4d\u4e0b\u62c9\u505a\u4e86\u5341\u7ec4\uff0c\u6bcf\u7ec4\u662f70\u516c\u65a4\uff0c\u6bcf\u7ec4\u505a\u4e8610\u4e2a",
  ])("merges cross-clause oral set details into one exercise: %s", (text) => {
    const result = parseWorkoutIntakeDraft(
      {
        text,
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      oralExerciseDictionary,
    );

    expect(result.draft.exercises).toHaveLength(1);
    expect(result.draft.exercises[0]?.sets).toHaveLength(10);
    expect(result.draft.exercises[0]?.sets).toEqual(
      Array.from({ length: 10 }, () => ({
        intensity_label: null,
        reps: 10,
        rpe: null,
        weight_kg: 70,
      })),
    );
    expect(result.draft.exercises[0]?.incomplete_sets).toEqual([]);
    expect(result.unresolved_items).toEqual([]);
    expectNoFakeZeroSets(result);
  });

  it("returns missing weight when oral details include group count and reps only", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "\u6211\u4eca\u5929\u505a\u4e86\u6760\u94c3\u5367\u63a8\u505a\u4e8610\u7ec4\uff0c\u6bcf\u7ec4\u505a\u4e8610\u6b21",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      oralExerciseDictionary,
    );

    expect(result.draft.exercises).toHaveLength(1);
    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "\u6760\u94c3\u5367\u63a8",
      match_status: "matched",
      sets: [],
      incomplete_sets: [
        {
          group_count: 10,
          missing_fields: ["weight_kg"],
          reps: 10,
          weight_kg: null,
        },
      ],
    });
    expect(result.unresolved_items).toEqual([
      { text: "\u6760\u94c3\u5367\u63a8", reason: "incomplete_sets" },
    ]);
    expectNoFakeZeroSets(result);
  });

  it("does not create an unresolved exercise from a set-only follow-up clause", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "\u6760\u94c3\u5367\u63a8\u505a\u4e8610\u7ec4\u6bcf\u7ec4\u505a\u7684\u662f70\u516c\u65a4\u3002\u6bcf\u7ec4\u505a\u4e8610\u6b21",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      oralExerciseDictionary,
    );

    expect(result.draft.exercises).toHaveLength(1);
    expect(result.draft.exercises[0]?.input_name).toBe("\u6760\u94c3\u5367\u63a8");
    expect(result.draft.exercises[0]?.sets).toHaveLength(10);
    expect(result.unresolved_items).toEqual([]);
    expectNoFakeZeroSets(result);
  });

  it("preserves decimal weights when building incomplete draft data", () => {
    const result = parseWorkoutIntakeDraft(
      {
        text: "\u4e0a\u659c\u54d1\u94c3\u5367\u63a8\u4e09\u7ec4\u6bcf\u7ec4\u662f27.5\u516c\u65a4",
        performed_at: "2026-05-29T10:00:00.000Z",
      },
      [
        ...oralExerciseDictionary,
        {
          id: "66666666-6666-4666-8666-666666666666",
          code: "incline_bench_press_dumbbell",
          name_en: "Incline Dumbbell Bench Press",
          name_zh: "\u4e0a\u659c\u54d1\u94c3\u5367\u63a8",
        },
      ],
    );

    expect(result.draft.exercises).toHaveLength(1);
    expect(result.draft.exercises[0]).toMatchObject({
      input_name: "\u4e0a\u659c\u54d1\u94c3\u5367\u63a8",
      incomplete_sets: [
        {
          group_count: 3,
          missing_fields: ["reps"],
          weight_kg: 27.5,
        },
      ],
      sets: [],
    });
    expectNoFakeZeroSets(result);
  });
});
