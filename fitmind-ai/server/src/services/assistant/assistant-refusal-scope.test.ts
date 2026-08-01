import { describe, expect, it } from "vitest";

import { classifyUnsupportedScope } from "./assistant-refusal-scope.js";

describe("classifyUnsupportedScope", () => {
  // The ER-3 spec names 生酮饮食 as the out-of-scope reference case.
  it.each(["生酮饮食有用吗", "我女朋友生气了怎么办", "明天天气怎么样？"])(
    "treats %s as outside the product",
    (message) => {
      expect(classifyUnsupportedScope({ message })).toBe("out_of_scope");
    },
  );

  it.each([
    "帮我看看训练",
    "我这周练得咋样啊啊啊",
    "增肌该怎么安排",
    "深蹲重量上不去",
  ])("treats %s as a training question it did not understand", (message) => {
    expect(classifyUnsupportedScope({ message })).toBe("unrecognized");
  });

  // A resolved exercise makes the turn training-related regardless of wording,
  // so the message pattern must not get the final say.
  it("respects an exercise signal over the message wording", () => {
    expect(
      classifyUnsupportedScope({
        message: "这个咋样",
        hasExerciseSignal: true,
      }),
    ).toBe("unrecognized");
  });

  it("falls back to the message when no exercise signal is present", () => {
    expect(
      classifyUnsupportedScope({
        message: "这个咋样",
        hasExerciseSignal: false,
      }),
    ).toBe("out_of_scope");
  });
});
