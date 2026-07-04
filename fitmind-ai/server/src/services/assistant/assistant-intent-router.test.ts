import { describe, expect, it } from "vitest";

import {
  classifyAssistantIntent,
  isOutOfScopeMessage,
} from "./assistant-intent-router.js";

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
    expect(classifyAssistantIntent("PRE是什么").intent).toBe("knowledge");
    expect(classifyAssistantIntent("pre 是什么？").intent).toBe("knowledge");
    expect(classifyAssistantIntent("PRE 是什么？").intent).toBe("knowledge");
    expect(classifyAssistantIntent("主观用力是什么？").intent).toBe(
      "knowledge",
    );
    expect(classifyAssistantIntent("主观用力程度是什么？").intent).toBe(
      "knowledge",
    );
    expect(classifyAssistantIntent("卧推没进步是不是训练量不够？").intent).toBe(
      "mixed_tool_rag",
    );
  });

  it("routes Phase 5 coach product prompts to coach intents", () => {
    expect(classifyAssistantIntent("帮我做一份本周训练报告").intent).toBe(
      "weekly_report",
    );
    // 常见简写"周报"走关键词快路径（确定性、省一次 LLM 调用）。
    expect(classifyAssistantIntent("周报").intent).toBe("weekly_report");
    expect(classifyAssistantIntent("卧推平台期怎么诊断").intent).toBe(
      "plateau_diagnosis",
    );
    expect(classifyAssistantIntent("给我一个下周训练草案").intent).toBe(
      "next_week_plan",
    );
    expect(classifyAssistantIntent("给我一个下周训练的草程").intent).toBe(
      "next_week_plan",
    );
    expect(classifyAssistantIntent("下周我怎么练").intent).toBe(
      "next_week_plan",
    );
    expect(classifyAssistantIntent("帮我安排下周训练").intent).toBe(
      "next_week_plan",
    );
  });

  it("keeps unsupported prompts out of the training assistant scope", () => {
    expect(classifyAssistantIntent("明天天气怎么样？").intent).toBe(
      "unsupported",
    );
    expect(classifyAssistantIntent("讲个笑话").intent).toBe("unsupported");
  });

  it("routes knowledge-base topics without coverage out of the curated vocab (no confident wrong answers)", () => {
    // 这些词不在精选词表/知识库 → 不路由 knowledge，交给澄清，避免向量召回"最近的错 chunk"。
    expect(classifyAssistantIntent("训练前怎么热身？").intent).toBe(
      "unsupported",
    );
    expect(classifyAssistantIntent("睡眠对训练重要吗").intent).toBe(
      "unsupported",
    );
  });

  it("flags only genuinely out-of-scope or empty messages (Slice 11a fallback gate)", () => {
    expect(isOutOfScopeMessage("明天天气怎么样？")).toBe(true);
    expect(isOutOfScopeMessage("讲个笑话")).toBe(true);
    expect(isOutOfScopeMessage("   ")).toBe(true);
    expect(isOutOfScopeMessage("训练前怎么热身？")).toBe(false);
    expect(isOutOfScopeMessage("我最近有点疲劳还能练吗")).toBe(false);
  });
});
