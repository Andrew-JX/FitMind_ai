export type ExerciseAliasMap = Record<string, readonly string[]>;

export const SYSTEM_EXERCISE_ALIASES = {
  bench_press_barbell: [
    "\u6760\u94c3\u5367\u63a8",
    "\u5e73\u677f\u5367\u63a8",
  ],
  bench_press_dumbbell: [
    "\u54d1\u94c3\u5367\u63a8",
    "\u54d1\u94c3\u63a8\u80f8",
  ],
  cable_fly: ["\u7ef3\u7d22\u5939\u80f8"],
  chest_fly_machine: ["\u8774\u8776\u673a\u5939\u80f8"],
  chin_up_bodyweight: ["\u53cd\u624b\u5f15\u4f53"],
  dumbbell_row: ["\u54d1\u94c3\u5212\u8239"],
  face_pull_cable: ["\u9762\u62c9", "\u7ef3\u7d22\u9762\u62c9"],
  hammer_curl_dumbbell: ["\u9524\u5f0f\u5f2f\u4e3e"],
  hip_thrust_barbell: ["\u81c0\u63a8"],
  lat_pulldown_cable: [
    "\u9ad8\u4f4d\u4e0b\u62c9",
  ],
  lateral_raise_dumbbell: ["\u4fa7\u5e73\u4e3e", "\u54d1\u94c3\u4fa7\u5e73\u4e3e"],
  leg_curl_machine: ["\u817f\u5f2f\u4e3e"],
  leg_extension_machine: ["\u817f\u5c48\u4f38"],
  seated_cable_row: [
    "\u5750\u59ff\u5212\u8239",
    "\u7ef3\u7d22\u5212\u8239",
  ],
  seated_dumbbell_shoulder_press: ["\u5750\u59ff\u54d1\u94c3\u63a8\u80a9"],
  shoulder_press_barbell: ["\u6760\u94c3\u63a8\u80a9", "\u7ad9\u59ff\u63a8\u4e3e"],
  shoulder_press_dumbbell: ["\u54d1\u94c3\u63a8\u80a9"],
  leg_press_machine: ["\u817f\u4e3e", "\u5012\u8e6c"],
  pull_up_bodyweight: ["\u5f15\u4f53\u5411\u4e0a"],
  romanian_deadlift_barbell: ["\u7f57\u9a6c\u5c3c\u4e9a\u786c\u62c9"],
  straight_arm_pulldown_cable: ["\u76f4\u81c2\u4e0b\u538b"],
} as const satisfies ExerciseAliasMap;

export const BROAD_EXERCISE_ALIASES = {
  "\u5367\u63a8": ["bench_press_barbell", "bench_press_dumbbell"],
  "\u63a8\u80f8": ["bench_press_barbell", "bench_press_dumbbell"],
  "\u63a8\u80a9": [
    "shoulder_press_barbell",
    "shoulder_press_dumbbell",
    "seated_dumbbell_shoulder_press",
  ],
  "\u5212\u8239": ["seated_cable_row", "barbell_row"],
  "\u5939\u80f8": ["cable_fly", "chest_fly_machine"],
  "\u98de\u9e1f": ["rear_delt_fly_machine", "cable_fly", "chest_fly_machine"],
  "\u4e0b\u62c9": ["lat_pulldown_cable", "straight_arm_pulldown_cable"],
  "\u5f2f\u4e3e": ["barbell_curl", "dumbbell_curl", "hammer_curl_dumbbell"],
  "\u786c\u62c9": ["romanian_deadlift_barbell", "deadlift_barbell"],
} as const satisfies ExerciseAliasMap;
