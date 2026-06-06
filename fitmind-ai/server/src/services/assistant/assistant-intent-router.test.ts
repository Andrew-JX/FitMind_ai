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
    expect(classifyAssistantIntent("卧推没进步是不是训练量不够？").intent).toBe(
      "mixed_tool_rag",
    );
  });

  it("keeps unsupported prompts out of the training assistant scope", () => {
    expect(classifyAssistantIntent("明天天气怎么样？").intent).toBe(
      "unsupported",
    );
    expect(classifyAssistantIntent("讲个笑话").intent).toBe("unsupported");
  });
});
