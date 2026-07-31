import { describe, expect, it } from "vitest";

import { HttpClientError } from "../../services/http-client";
import { getReadableAuthErrorMessage } from "./auth-error-message";

describe("getReadableAuthErrorMessage", () => {
  // Regression pin for the "English leaks into a Chinese screen" failure mode:
  // without a branch the fallback would render "Registration is invite-only."
  it("translates a closed-registration rejection", () => {
    const message = getReadableAuthErrorMessage(
      new HttpClientError({
        status: 403,
        code: "REGISTRATION_CLOSED",
        message: "Registration is invite-only.",
      }),
    );

    expect(message).toBe(
      "当前为邀请制，暂不开放注册。请联系管理员开通账号后登录。",
    );
  });

  it("translates a duplicate email rejection", () => {
    const message = getReadableAuthErrorMessage(
      new HttpClientError({
        status: 409,
        code: "VALIDATION_ERROR",
        message: "An account with this email already exists.",
      }),
    );

    expect(message).toBe("这个邮箱已经注册过了，请直接登录或更换邮箱。");
  });

  it("translates invalid credentials", () => {
    const message = getReadableAuthErrorMessage(
      new HttpClientError({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Invalid email or password.",
      }),
    );

    expect(message).toBe("邮箱或密码不正确。");
  });

  it("falls back to the server message for unmapped failures", () => {
    const message = getReadableAuthErrorMessage(
      new HttpClientError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Internal server error.",
      }),
    );

    expect(message).toBe("Internal server error.");
  });

  it("falls back to a generic message for non-HTTP rejections", () => {
    expect(getReadableAuthErrorMessage(new Error("boom"))).toBe(
      "Authentication could not be verified.",
    );
  });
});
