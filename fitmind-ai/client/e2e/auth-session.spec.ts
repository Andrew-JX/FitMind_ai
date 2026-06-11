import { expect, test } from "@playwright/test";

import { installApiMocks } from "./support/mock-api";

const LOGIN_SUBMIT = "登录 FitMind AI";
const LOGOUT_BUTTON = "退出登录";

test.describe("auth session (HttpOnly cookie)", () => {
  test("restores an existing session on load via /me", async ({ page }) => {
    await installApiMocks(page, { authenticated: true });
    await page.goto("/");

    await expect(page.getByText(LOGOUT_BUTTON)).toBeVisible();
    await expect(page.getByText("当前用户：")).toBeVisible();
    await expect(page.getByRole("button", { name: LOGIN_SUBMIT })).toHaveCount(
      0,
    );
  });

  test("keeps the session after a full page reload", async ({ page }) => {
    await installApiMocks(page, { authenticated: true });
    await page.goto("/");
    await expect(page.getByText(LOGOUT_BUTTON)).toBeVisible();

    await page.reload();

    await expect(page.getByText(LOGOUT_BUTTON)).toBeVisible();
  });

  test("shows the login screen when there is no session", async ({ page }) => {
    await installApiMocks(page, { authenticated: false });
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: LOGIN_SUBMIT }),
    ).toBeVisible();
    await expect(page.getByText(LOGOUT_BUTTON)).toHaveCount(0);
  });

  test("logs in and reaches the authenticated app shell", async ({ page }) => {
    await installApiMocks(page, { authenticated: false });
    await page.goto("/");

    await page.getByLabel("邮箱", { exact: true }).fill("demo@fitmind.ai");
    await page.getByLabel("密码", { exact: true }).fill("password123");
    await page.getByRole("button", { name: LOGIN_SUBMIT }).click();

    await expect(page.getByText(LOGOUT_BUTTON)).toBeVisible();
  });

  test("logs out and returns to the login screen", async ({ page }) => {
    await installApiMocks(page, { authenticated: true });
    await page.goto("/");
    await expect(page.getByText(LOGOUT_BUTTON)).toBeVisible();

    await page.getByText(LOGOUT_BUTTON).click();

    await expect(
      page.getByRole("button", { name: LOGIN_SUBMIT }),
    ).toBeVisible();
  });
});
