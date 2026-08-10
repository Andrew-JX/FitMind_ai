import { describe, expect, it } from "vitest";

import { HttpClientError } from "../../services/http-client";
import { getPersonalToolWriteErrorMessage } from "./personal-tool-error-message";

describe("getPersonalToolWriteErrorMessage", () => {
  it("explains that stale policy consent requires a reload", () => {
    const error = new HttpClientError({
      code: "CONSENT_REQUIRED",
      message: "stale",
      status: 422,
      details: { expected_policy_version: "2026-08-09" },
    });

    expect(getPersonalToolWriteErrorMessage(error, "fallback")).toContain(
      "隐私政策已更新",
    );
  });

  it("explains missing separate health consent", () => {
    const error = new HttpClientError({
      code: "CONSENT_REQUIRED",
      message: "missing",
      status: 422,
    });

    expect(getPersonalToolWriteErrorMessage(error, "fallback")).toContain(
      "单独同意",
    );
  });

  it("distinguishes network failure from an ordinary write failure", () => {
    const error = new HttpClientError({
      code: "NETWORK_ERROR",
      message: "offline",
    });

    expect(getPersonalToolWriteErrorMessage(error, "fallback")).toContain(
      "检查网络",
    );
  });

  it("keeps the caller fallback for unrelated failures", () => {
    expect(
      getPersonalToolWriteErrorMessage(new Error("unknown"), "没有保存成功"),
    ).toBe("没有保存成功");
  });
});
