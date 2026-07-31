import { HttpClientError } from "../../services/http-client";

/**
 * Map an auth request failure to user-facing Chinese copy.
 *
 * @param error - Unknown rejection value from an auth API call
 * @returns Message safe to render in the auth screen
 *
 * @remarks
 * The fallback returns the server's own message, which is English. Every
 * failure the user can actually trigger therefore needs a branch here, or the
 * UI leaks English into an otherwise Chinese screen.
 */
export function getReadableAuthErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    // Invite-only deployments close registration server-side.
    if (error.code === "REGISTRATION_CLOSED") {
      return "当前为邀请制，暂不开放注册。请联系管理员开通账号后登录。";
    }

    if (
      error.status === 409 ||
      error.message === "An account with this email already exists."
    ) {
      return "这个邮箱已经注册过了，请直接登录或更换邮箱。";
    }

    if (error.message === "Invalid email or password.") {
      return "邮箱或密码不正确。";
    }

    return error.message;
  }

  return "Authentication could not be verified.";
}
