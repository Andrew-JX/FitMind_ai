import { describe, expect, it } from "vitest";

import {
  matchExercise,
  type ExerciseMatchingDictionaryItem,
} from "./exercise-matching-service.js";

const dictionary: ExerciseMatchingDictionaryItem[] = [
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
    code: "lat_pulldown_cable",
    name_en: "Lat Pulldown",
    name_zh: "\u9ad8\u4f4d\u4e0b\u62c9",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    code: "seated_cable_row",
    name_en: "Seated Cable Row",
    name_zh: "\u5750\u59ff\u5212\u8239",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    code: "barbell_row",
    name_en: "Barbell Row",
    name_zh: "\u6760\u94c3\u5212\u8239",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    code: "leg_press_machine",
    name_en: "Leg Press",
    name_zh: "\u817f\u4e3e",
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    code: "romanian_deadlift_barbell",
    name_en: "Barbell Romanian Deadlift",
    name_zh: "\u6760\u94c3\u7f57\u9a6c\u5c3c\u4e9a\u786c\u62c9",
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    code: "deadlift_barbell",
    name_en: "Barbell Deadlift",
    name_zh: "\u6760\u94c3\u786c\u62c9",
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    code: "shoulder_press_dumbbell",
    name_en: "Dumbbell Shoulder Press",
    name_zh: "\u54d1\u94c3\u63a8\u80a9",
  },
  {
    id: "99999999-9999-4999-8999-999999999998",
    code: "seated_dumbbell_shoulder_press",
    name_en: "Seated Dumbbell Shoulder Press",
    name_zh: "\u5750\u59ff\u54d1\u94c3\u63a8\u80a9",
  },
  {
    id: "99999999-9999-4999-8999-999999999997",
    code: "lateral_raise_dumbbell",
    name_en: "Dumbbell Lateral Raise",
    name_zh: "\u54d1\u94c3\u4fa7\u5e73\u4e3e",
  },
  {
    id: "99999999-9999-4999-8999-999999999996",
    code: "pull_up_bodyweight",
    name_en: "Pull-Up",
    name_zh: "\u5f15\u4f53\u5411\u4e0a",
  },
  {
    id: "99999999-9999-4999-8999-999999999995",
    code: "chin_up_bodyweight",
    name_en: "Chin-Up",
    name_zh: "\u53cd\u624b\u5f15\u4f53",
  },
  {
    id: "99999999-9999-4999-8999-999999999994",
    code: "cable_fly",
    name_en: "Cable Fly",
    name_zh: "\u7ef3\u7d22\u5939\u80f8",
  },
  {
    id: "99999999-9999-4999-8999-999999999993",
    code: "chest_fly_machine",
    name_en: "Machine Chest Fly",
    name_zh: "\u8774\u8776\u673a\u5939\u80f8",
  },
  {
    id: "99999999-9999-4999-8999-999999999992",
    code: "straight_arm_pulldown_cable",
    name_en: "Cable Straight-Arm Pulldown",
    name_zh: "\u7ef3\u7d22\u76f4\u81c2\u4e0b\u538b",
  },
];

describe("exercise-matching-service", () => {
  it("matches exact system aliases to canonical exercises", () => {
    expect(matchExercise("\u6760\u94c3\u5367\u63a8", dictionary)).toMatchObject({
      matched_exercise_id: "11111111-1111-4111-8111-111111111111",
      matched_exercise_name: "\u6760\u94c3\u5367\u63a8",
      match_status: "matched",
    });

    expect(matchExercise("\u9ad8\u4f4d\u4e0b\u62c9", dictionary)).toMatchObject({
      matched_exercise_id: "33333333-3333-4333-8333-333333333333",
      matched_exercise_name: "\u9ad8\u4f4d\u4e0b\u62c9",
      match_status: "matched",
    });

    expect(matchExercise("\u5750\u59ff\u5212\u8239", dictionary)).toMatchObject({
      matched_exercise_id: "44444444-4444-4444-8444-444444444444",
      matched_exercise_name: "\u5750\u59ff\u5212\u8239",
      match_status: "matched",
    });

    expect(matchExercise("\u54d1\u94c3\u63a8\u80a9", dictionary)).toMatchObject({
      matched_exercise_id: "99999999-9999-4999-8999-999999999999",
      matched_exercise_name: "\u54d1\u94c3\u63a8\u80a9",
      match_status: "matched",
    });

    expect(
      matchExercise("\u5750\u59ff\u54d1\u94c3\u63a8\u80a9", dictionary),
    ).toMatchObject({
      matched_exercise_id: "99999999-9999-4999-8999-999999999998",
      matched_exercise_name: "\u5750\u59ff\u54d1\u94c3\u63a8\u80a9",
      match_status: "matched",
    });

    expect(matchExercise("\u5f15\u4f53\u5411\u4e0a", dictionary)).toMatchObject({
      matched_exercise_id: "99999999-9999-4999-8999-999999999996",
      matched_exercise_name: "\u5f15\u4f53\u5411\u4e0a",
      match_status: "matched",
    });
  });

  it("keeps broad aliases ambiguous instead of selecting the first candidate", () => {
    const bench = matchExercise("\u5367\u63a8", dictionary);
    const push = matchExercise("\u63a8\u80f8", dictionary);
    const row = matchExercise("\u5212\u8239", dictionary);
    const shoulderPress = matchExercise("\u63a8\u80a9", dictionary);
    const fly = matchExercise("\u5939\u80f8", dictionary);
    const pulldown = matchExercise("\u4e0b\u62c9", dictionary);

    expect(bench).toMatchObject({
      matched_exercise_id: null,
      matched_exercise_name: null,
      match_status: "ambiguous",
    });
    expect(bench.candidate_exercises).toHaveLength(2);

    expect(push.match_status).toBe("ambiguous");
    expect(push.matched_exercise_id).toBeNull();
    expect(push.candidate_exercises).toHaveLength(2);

    expect(row.match_status).toBe("ambiguous");
    expect(row.matched_exercise_id).toBeNull();
    expect(row.candidate_exercises).toHaveLength(2);

    expect(shoulderPress.match_status).toBe("ambiguous");
    expect(shoulderPress.matched_exercise_id).toBeNull();
    expect(shoulderPress.candidate_exercises.length).toBeGreaterThanOrEqual(2);

    expect(fly.match_status).toBe("ambiguous");
    expect(fly.matched_exercise_id).toBeNull();
    expect(fly.candidate_exercises).toHaveLength(2);

    expect(pulldown.match_status).toBe("ambiguous");
    expect(pulldown.matched_exercise_id).toBeNull();
    expect(pulldown.candidate_exercises).toHaveLength(2);
  });

  it("returns unresolved for unknown exercise phrases", () => {
    expect(matchExercise("\u706b\u661f\u63a8\u4e3e", dictionary)).toEqual({
      candidate_exercises: [],
      matched_exercise_id: null,
      matched_exercise_name: null,
      match_confidence: 0,
      match_status: "unresolved",
    });
  });

  it("normalizes English case and spacing", () => {
    expect(matchExercise("  lat   PULLDOWN  ", dictionary)).toMatchObject({
      matched_exercise_id: "33333333-3333-4333-8333-333333333333",
      matched_exercise_name: "\u9ad8\u4f4d\u4e0b\u62c9",
      match_status: "matched",
    });
  });

  it("matches deadlift aliases conservatively", () => {
    expect(
      matchExercise("\u7f57\u9a6c\u5c3c\u4e9a\u786c\u62c9", dictionary),
    ).toMatchObject({
      matched_exercise_id: "77777777-7777-4777-8777-777777777777",
      matched_exercise_name: "\u6760\u94c3\u7f57\u9a6c\u5c3c\u4e9a\u786c\u62c9",
      match_status: "matched",
    });

    const broadDeadlift = matchExercise("\u786c\u62c9", dictionary);

    expect(broadDeadlift.match_status).toBe("ambiguous");
    expect(broadDeadlift.matched_exercise_id).toBeNull();
    expect(broadDeadlift.candidate_exercises).toHaveLength(2);
  });

  it("does not match unsafe single-character or broad Chinese filler terms", () => {
    for (const phrase of ["\u62c9", "\u80cc", "\u505a", "\u63a8", "\u4e3e"]) {
      expect(matchExercise(phrase, dictionary)).toEqual({
        candidate_exercises: [],
        matched_exercise_id: null,
        matched_exercise_name: null,
        match_confidence: 0,
        match_status: "unresolved",
      });
    }
  });

  it("keeps contains fallback as candidates instead of silently matching", () => {
    const result = matchExercise("pulldown", dictionary);

    expect(result).toMatchObject({
      matched_exercise_id: null,
      matched_exercise_name: null,
      match_status: "ambiguous",
    });
    expect(result.candidate_exercises).toEqual([
      {
        confidence: 0.68,
        exercise_id: "33333333-3333-4333-8333-333333333333",
        exercise_name: "\u9ad8\u4f4d\u4e0b\u62c9",
      },
      {
        confidence: 0.68,
        exercise_id: "99999999-9999-4999-8999-999999999992",
        exercise_name: "\u76f4\u81c2\u4e0b\u538b",
      },
    ]);
  });
});
