import { describe, expect, it } from "vitest";

import { getFeedbackSourceRoute } from "./app-navigation";

describe("getFeedbackSourceRoute", () => {
  it("keeps history and analysis distinguishable inside the shared tab", () => {
    expect(getFeedbackSourceRoute("history", "history")).toBe("/history");
    expect(getFeedbackSourceRoute("history", "analysis")).toBe("/analysis");
  });

  it("maps the remaining bottom workspaces to their own routes", () => {
    expect(getFeedbackSourceRoute("training", "history")).toBe("/training");
    expect(getFeedbackSourceRoute("assistant", "history")).toBe("/assistant");
    expect(getFeedbackSourceRoute("profile", "history")).toBe("/profile");
  });
});
