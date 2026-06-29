import { describe, expect, it } from "vitest";

import {
  classifyAssistantSafety,
  composeMedicalSafetyAnswer,
  isAssistantSafetyGateEnabled,
} from "./assistant-safety.js";

describe("classifyAssistantSafety", () => {
  it("routes ambiguous pain or symptom reports to the medical boundary", () => {
    expect(classifyAssistantSafety("我膝盖疼，下周还能练腿吗")).toEqual({
      boundary: "medical_boundary",
      reason: "ambiguous_pain_or_symptom",
    });
    expect(classifyAssistantSafety("肩膀有点不舒服，还能卧推吗")).toEqual({
      boundary: "medical_boundary",
      reason: "ambiguous_pain_or_symptom",
    });
    expect(
      classifyAssistantSafety("我膝盖以前受过伤，最近又开始疼了，能练吗"),
    ).toEqual({
      boundary: "medical_boundary",
      reason: "ambiguous_pain_or_symptom",
    });
    expect(classifyAssistantSafety("旧伤复发，膝盖又疼了")).toEqual({
      boundary: "medical_boundary",
      reason: "ambiguous_pain_or_symptom",
    });
  });

  it("exempts pure DOMS soreness before current or recurrence markers", () => {
    expect(classifyAssistantSafety("肩膀这两天有点酸痛正常吗")).toEqual({
      boundary: "none",
      reason: null,
    });
    expect(classifyAssistantSafety("肩膀酸痛越来越严重")).toEqual({
      boundary: "medical_boundary",
      reason: "ambiguous_pain_or_symptom",
    });
  });

  it("routes acute pain, red flags, medication, and treatment requests", () => {
    expect(classifyAssistantSafety("我现在深蹲一弯膝盖就剧痛")).toEqual({
      boundary: "medical_boundary",
      reason: "acute_pain",
    });
    expect(classifyAssistantSafety("训练时 chest tightness")).toEqual({
      boundary: "medical_boundary",
      reason: "red_flag_symptom",
    });
    expect(classifyAssistantSafety("我该吃什么止痛药")).toEqual({
      boundary: "medical_boundary",
      reason: "medication_request",
    });
    expect(classifyAssistantSafety("是不是韧带撕裂，怎么治")).toEqual({
      boundary: "medical_boundary",
      reason: "diagnosis_or_treatment_request",
    });
  });

  it("lets explicit chronic constraints continue through normal training flows", () => {
    expect(classifyAssistantSafety("我膝盖以前受过伤，想避开深蹲")).toEqual({
      boundary: "none",
      reason: null,
    });
    expect(classifyAssistantSafety("肩旧伤，下周计划少安排推举")).toEqual({
      boundary: "none",
      reason: null,
    });
    expect(classifyAssistantSafety("帮我把 knee 加到伤病约束")).toEqual({
      boundary: "none",
      reason: null,
    });
  });

  it("lets normal training knowledge and plan prompts pass", () => {
    expect(classifyAssistantSafety("RPE 是什么？")).toEqual({
      boundary: "none",
      reason: null,
    });
    expect(classifyAssistantSafety("帮我安排下周训练")).toEqual({
      boundary: "none",
      reason: null,
    });
  });
});

describe("isAssistantSafetyGateEnabled", () => {
  const originalSafetyGate = process.env.ASSISTANT_SAFETY_GATE;

  function withSafetyGate(
    value: string | undefined,
    assertion: () => void,
  ): void {
    if (value === undefined) {
      delete process.env.ASSISTANT_SAFETY_GATE;
    } else {
      process.env.ASSISTANT_SAFETY_GATE = value;
    }

    try {
      assertion();
    } finally {
      if (originalSafetyGate === undefined) {
        delete process.env.ASSISTANT_SAFETY_GATE;
      } else {
        process.env.ASSISTANT_SAFETY_GATE = originalSafetyGate;
      }
    }
  }

  it("defaults on for unset, blank, typo, and enable tokens", () => {
    for (const value of [undefined, "", "maybe", "on", "true", "1", "yes"]) {
      withSafetyGate(value, () => {
        expect(isAssistantSafetyGateEnabled()).toBe(true);
      });
    }
  });

  it("turns off only for explicit disable tokens", () => {
    for (const value of ["off", "false", "0", "no"]) {
      withSafetyGate(value, () => {
        expect(isAssistantSafetyGateEnabled()).toBe(false);
      });
    }
  });
});

describe("composeMedicalSafetyAnswer", () => {
  it("returns a deterministic unsupported answer without public safety fields", () => {
    const answer = composeMedicalSafetyAnswer({
      boundary: "medical_boundary",
      reason: "acute_pain",
    });

    expect(answer.intent).toBe("unsupported");
    expect(answer.evidence.tool_names).toEqual([]);
    expect(answer.sources).toEqual([]);
    expect(Object.keys(answer)).not.toContain("safety");
    expect(answer.summary).toContain("不能诊断");
    expect(answer.limitations.join(" ")).toContain("不是医疗诊断");
  });
});
