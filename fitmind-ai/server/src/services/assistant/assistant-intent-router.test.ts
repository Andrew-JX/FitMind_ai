import { describe, expect, it } from "vitest";

import { classifyAssistantIntent } from "./assistant-intent-router.js";

describe("classifyAssistantIntent", () => {
  it("routes natural training questions to deterministic tool intents", () => {
    expect(classifyAssistantIntent("我最近卧推是不是没进步？").intent).toBe(
      "progress",
    );
    expect(classifyAssistantIntent("我这周训练量够吗？").intent).toBe(
      "summary",
    );
    expect(classifyAssistantIntent("我是不是胸练太多了？").intent).toBe(
      "imbalance",
    );
    expect(classifyAssistantIntent("你根据什么判断？").intent).toBe("evidence");
  });

  it("routes knowledge and mixed questions to RAG-aware intents", () => {
    expect(classifyAssistantIntent("RPE 是什么？").intent).toBe("knowledge");
    expect(classifyAssistantIntent("Pre是什么").intent).toBe("knowledge");
    expect(classifyAssistantIntent("PRE 是什么？").intent).toBe("knowledge");
    expect(classifyAssistantIntent("主观用力是什么？").intent).toBe("knowledge");
    expect(classifyAssistantIntent("卧推没进步是不是训练量不够？").intent).toBe(
      "mixed_tool_rag",
    );
  });

  it("routes Phase 5 coach product prompts to coach intents", () => {
    expect(classifyAssistantIntent("帮我做一份本周训练报告").intent).toBe(
      "weekly_report",
    );
    expect(classifyAssistantIntent("卧推平台期怎么诊断").intent).toBe(
      "plateau_diagnosis",
    );
    expect(classifyAssistantIntent("给我一个下周训练草案").intent).toBe(
      "next_week_plan",
    );
  });

  it("keeps unsupported prompts out of the training assistant scope", () => {
    expect(classifyAssistantIntent("明天天气怎么样？").intent).toBe(
      "unsupported",
    );
    expect(classifyAssistantIntent("讲个笑话").intent).toBe("unsupported");
  });
});
