const DEFAULT_API_ORIGIN = "https://fitmind-ai-psi.vercel.app";

export async function onRequest(context) {
  const apiOrigin = context.env.VERCEL_API_ORIGIN || DEFAULT_API_ORIGIN;
  const incomingUrl = new URL(context.request.url);
  const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, apiOrigin);
  const headers = new Headers(context.request.headers);

  headers.delete("host");
  headers.set("x-forwarded-host", incomingUrl.host);
  headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

  return fetch(targetUrl, {
    method: context.request.method,
    headers,
    body:
      context.request.method === "GET" || context.request.method === "HEAD"
        ? undefined
        : context.request.body,
    redirect: "manual",
  });
}
