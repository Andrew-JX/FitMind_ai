const DEFAULT_API_ORIGIN = "https://fitmind-ai-psi.vercel.app";

export default {
  async fetch(request, env) {
    const incomingUrl = new URL(request.url);

    if (incomingUrl.pathname.startsWith("/api/")) {
      const apiOrigin = env.VERCEL_API_ORIGIN || DEFAULT_API_ORIGIN;
      const targetUrl = new URL(
        `${incomingUrl.pathname}${incomingUrl.search}`,
        apiOrigin,
      );
      const headers = new Headers(request.headers);

      headers.delete("host");
      headers.set("x-forwarded-host", incomingUrl.host);
      headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

      return fetch(targetUrl, {
        method: request.method,
        headers,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : request.body,
        redirect: "manual",
      });
    }

    return env.ASSETS.fetch(request);
  },
};
