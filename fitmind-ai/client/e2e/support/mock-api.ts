import type { Page, Route } from "@playwright/test";

/** Stable demo user returned by the mocked auth endpoints. */
export const MOCK_USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "demo@fitmind.ai",
  display_name: "Demo Lifter",
};

function respondJson(
  route: Route,
  status: number,
  body: unknown,
): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export interface ApiMockOptions {
  /** Whether the simulated HttpOnly session cookie is already valid on load. */
  authenticated: boolean;
}

/**
 * Install deterministic backend mocks for the auth-focused E2E flows.
 *
 * @param page - Playwright page to attach route handlers to.
 * @param options - Initial authenticated state for the simulated session.
 *
 * @remarks
 * Mocks let these E2E tests run with no API server, database, or secrets. The
 * catch-all is registered first so the specific auth routes (added later) win.
 * Non-auth endpoints return a 500 envelope so data hooks render their error
 * state instead of crashing on unexpected shapes; the auth-centric assertions
 * never depend on training data.
 */
export async function installApiMocks(
  page: Page,
  options: ApiMockOptions,
): Promise<void> {
  let authenticated = options.authenticated;

  await page.route("**/api/**", (route) =>
    respondJson(route, 500, {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Not mocked in this E2E." },
    }),
  );

  await page.route("**/api/auth/me", (route) => {
    if (authenticated) {
      return respondJson(route, 200, { ok: true, data: { user: MOCK_USER } });
    }

    return respondJson(route, 401, {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing authentication credentials.",
      },
    });
  });

  await page.route("**/api/auth/login", (route) => {
    authenticated = true;

    return respondJson(route, 200, {
      ok: true,
      data: { user: MOCK_USER, token: "e2e-token" },
    });
  });

  await page.route("**/api/auth/logout", (route) => {
    authenticated = false;

    return respondJson(route, 200, { ok: true, data: { success: true } });
  });
}
