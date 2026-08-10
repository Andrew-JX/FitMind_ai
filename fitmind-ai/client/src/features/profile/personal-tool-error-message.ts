import { HttpClientError } from "../../services/http-client";

/** Turn health-tool write failures into actions the user can actually take. */
export function getPersonalToolWriteErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof HttpClientError)) {
    return fallback;
  }

  if (error.code === "CONSENT_REQUIRED") {
    if (typeof error.details?.expected_policy_version === "string") {
      return "隐私政策已更新，请刷新页面，重新阅读并同意后再保存。";
    }

    return "保存前需要单独同意处理敏感健康信息，请勾选同意后重试。";
  }

  if (error.code === "NETWORK_ERROR") {
    return "暂时无法连接服务器，请检查网络后重试。";
  }

  return fallback;
}
