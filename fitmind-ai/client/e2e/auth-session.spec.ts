import { expect, test } from "@playwright/test";

import { installApiMocks } from "./support/mock-api";

const LOGIN_SUBMIT = "登录 FitMind AI";
const LOGOUT_BUTTON = "退出登录";
/** Bottom-nav profile tab: only rendered inside the authenticated app shell. */
const PROFILE_TAB = "个人";

test.describe("auth session (HttpOnly cookie)", () => {
  test("restores an existing session on load via /me", async ({ page }) => {
    await installApiMocks(page, { authenticated: true });
    await page.goto("/");

    await expect(page.getByRole("button", { name: PROFILE_TAB })).toBeVisible();
    await expect(page.getByRole("button", { name: LOGIN_SUBMIT })).toHaveCount(
      0,
    );

    // The account card and logout entry live on the profile tab.
    await page.getByRole("button", { name: PROFILE_TAB }).click();
    await expect(page.getByText(LOGOUT_BUTTON)).toBeVisible();
  });

  test("loads training data after a cookie-restored session (no in-memory token)", async ({
    page,
  }) => {
    await installApiMocks(page, { authenticated: true });

    // Regression guard: when the session is restored from the cookie there is no
    // in-memory token, so data hooks must still fire (they authenticate via the
    // cookie). Before the fix, a null token gated these requests out entirely.
    const workoutsRequest = page.waitForRequest(
      (request) =>
        request.url().includes("/api/workouts") && request.method() === "GET",
    );

    await page.goto("/");

    await expect(page.getByRole("button", { name: PROFILE_TAB })).toBeVisible();
    await workoutsRequest;
  });

  test("keeps the session after a full page reload", async ({ page }) => {
    await installApiMocks(page, { authenticated: true });
    await page.goto("/");
    await expect(page.getByRole("button", { name: PROFILE_TAB })).toBeVisible();

    await page.reload();

    await expect(page.getByRole("button", { name: PROFILE_TAB })).toBeVisible();
  });

  test("shows the login screen when there is no session", async ({ page }) => {
    await installApiMocks(page, { authenticated: false });
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: LOGIN_SUBMIT }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: PROFILE_TAB })).toHaveCount(
      0,
    );
  });

  test("logs in and reaches the authenticated app shell", async ({ page }) => {
    await installApiMocks(page, { authenticated: false });
    await page.goto("/");

    await page.getByLabel("邮箱", { exact: true }).fill("demo@fitmind.ai");
    await page.getByLabel("密码", { exact: true }).fill("password123");
    await page.getByRole("button", { name: LOGIN_SUBMIT }).click();

    await expect(page.getByRole("button", { name: PROFILE_TAB })).toBeVisible();
  });

  test("logs out from the profile tab and returns to the login screen", async ({
    page,
  }) => {
    await installApiMocks(page, { authenticated: true });
    await page.goto("/");
    await expect(page.getByRole("button", { name: PROFILE_TAB })).toBeVisible();

    await page.getByRole("button", { name: PROFILE_TAB }).click();
    await page.getByText(LOGOUT_BUTTON).click();

    await expect(
      page.getByRole("button", { name: LOGIN_SUBMIT }),
    ).toBeVisible();
  });
});
