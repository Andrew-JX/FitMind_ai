import { expect, test } from "@playwright/test";

import {
  installApiMocks,
  MOCK_POLICY_VERSION,
  OPEN_OVERSEAS_POLICY,
} from "./support/mock-api";

const REGISTER_TAB = "注册";
const REGISTER_SUBMIT = "创建账号";
const LOGIN_SUBMIT = "登录 FitMind AI";
const PROFILE_TAB = "个人";
const CONSENT_CHECKBOX = /存储在中国境外的服务器/;

test.describe("registration policy drives the sign-up form", () => {
  test("does not carry a failed login into the registration form", async ({
    page,
  }) => {
    const mocks = await installApiMocks(page, {
      authenticated: false,
      loginResult: "internal-error",
    });
    await page.goto("/");

    await page.getByLabel("邮箱", { exact: true }).fill("demo@fitmind.ai");
    await page.getByLabel("密码", { exact: true }).fill("password123");
    await page.getByLabel(/记住邮箱/).check();
    await page.getByRole("button", { name: LOGIN_SUBMIT }).click();

    await expect(page.getByText("登录失败")).toBeVisible();
    await page.getByRole("button", { name: REGISTER_TAB }).click();

    await expect(page.getByText("注册失败")).toHaveCount(0);
    await expect(page.getByLabel("邮箱", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("密码", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("确认密码", { exact: true })).toHaveValue("");
    expect(mocks.getLoginCalls()).toBe(1);
    expect(mocks.getRegisterBody()).toBeNull();
  });

  test("sends the cross-border consent with the register request", async ({
    page,
  }) => {
    const mocks = await installApiMocks(page, { authenticated: false });
    await page.goto("/");

    await page.getByRole("button", { name: REGISTER_TAB }).click();
    await page.getByLabel("邮箱", { exact: true }).fill("new@fitmind.ai");
    await page.getByLabel("密码", { exact: true }).fill("password123");
    await page.getByLabel("确认密码", { exact: true }).fill("password123");
    await page.getByLabel(CONSENT_CHECKBOX).check();
    await page.getByRole("button", { name: REGISTER_SUBMIT }).click();

    await expect(page.getByRole("button", { name: PROFILE_TAB })).toBeVisible();

    // The assertion that matters: the consent is in the request body, carrying
    // the version the server published. A rendered checkbox proves nothing —
    // the previous implementation had one and still let the server create
    // accounts with no consent at all.
    expect(mocks.getRegisterBody()).toMatchObject({
      email: "new@fitmind.ai",
      cross_border_consent: {
        accepted: true,
        policy_version: MOCK_POLICY_VERSION,
      },
    });
  });

  test("refuses to submit while the consent box is clear", async ({ page }) => {
    const mocks = await installApiMocks(page, { authenticated: false });
    await page.goto("/");

    await page.getByRole("button", { name: REGISTER_TAB }).click();
    await page.getByLabel("邮箱", { exact: true }).fill("new@fitmind.ai");
    await page.getByLabel("密码", { exact: true }).fill("password123");
    await page.getByLabel("确认密码", { exact: true }).fill("password123");
    await page.getByRole("button", { name: REGISTER_SUBMIT }).click();

    await expect(page.getByText(/请先阅读并勾选跨境存储同意项/)).toBeVisible();
    expect(mocks.getRegisterBody()).toBeNull();
  });

  // A mainland instance stores nothing abroad, so the box must not appear at
  // all. The same bundle used to render it — naming US recipients — on both.
  test("hides the cross-border consent on a mainland instance", async ({
    page,
  }) => {
    await installApiMocks(page, {
      authenticated: false,
      registrationPolicy: {
        ...OPEN_OVERSEAS_POLICY,
        data_residency: "mainland",
        cross_border_consent_required: false,
      },
    });
    await page.goto("/");

    await page.getByRole("button", { name: REGISTER_TAB }).click();

    await expect(page.getByLabel(CONSENT_CHECKBOX)).toHaveCount(0);
  });

  test("closes the sign-up tab on an invite-only instance", async ({
    page,
  }) => {
    await installApiMocks(page, {
      authenticated: false,
      registrationPolicy: {
        ...OPEN_OVERSEAS_POLICY,
        registration_open: false,
      },
    });
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: REGISTER_TAB }),
    ).toBeDisabled();
    await expect(page.getByText("当前为邀请制")).toBeVisible();
  });

  // Fail-closed, but only for registration. Locking existing users out because
  // a policy read failed would turn a legal control into an outage.
  test("fails closed on registration but still allows login", async ({
    page,
  }) => {
    await installApiMocks(page, {
      authenticated: false,
      registrationPolicy: "unavailable",
    });
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: REGISTER_TAB }),
    ).toBeDisabled();
    await expect(page.getByText("注册暂不可用")).toBeVisible();

    await page.getByLabel("邮箱", { exact: true }).fill("demo@fitmind.ai");
    await page.getByLabel("密码", { exact: true }).fill("password123");
    await page.getByRole("button", { name: LOGIN_SUBMIT }).click();

    await expect(page.getByRole("button", { name: PROFILE_TAB })).toBeVisible();
  });
});

test.describe("consent catch-up for accounts predating the seam", () => {
  test("blocks the app until the outstanding consent is given", async ({
    page,
  }) => {
    const mocks = await installApiMocks(page, {
      authenticated: true,
      pendingConsents: [
        {
          consent_type: "cross_border_transfer",
          policy_version: MOCK_POLICY_VERSION,
        },
      ],
    });
    await page.goto("/");

    // Signed in, but the app is not reachable yet.
    await expect(page.getByText("需要你确认：数据存储在境外")).toBeVisible();
    await expect(page.getByRole("button", { name: PROFILE_TAB })).toHaveCount(
      0,
    );

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /同意并继续/ }).click();

    await expect(page.getByRole("button", { name: PROFILE_TAB })).toBeVisible();
    expect(mocks.getConsentBodies()).toEqual([
      {
        consent_type: "cross_border_transfer",
        accepted: true,
        policy_version: MOCK_POLICY_VERSION,
      },
    ]);
  });

  test("records nothing when the user declines and logs out", async ({
    page,
  }) => {
    const mocks = await installApiMocks(page, {
      authenticated: true,
      pendingConsents: [
        {
          consent_type: "cross_border_transfer",
          policy_version: MOCK_POLICY_VERSION,
        },
      ],
    });
    await page.goto("/");

    await page.getByRole("button", { name: /先退出登录/ }).click();

    await expect(
      page.getByRole("button", { name: LOGIN_SUBMIT }),
    ).toBeVisible();
    // The point of not backfilling: declining leaves no trace of agreement.
    expect(mocks.getConsentBodies()).toEqual([]);
  });

  // Logging out and deleting are different acts, and the screen has to offer
  // both rather than presenting the first as if it were the second.
  test("deletes the account only after a second confirmation", async ({
    page,
  }) => {
    const mocks = await installApiMocks(page, {
      authenticated: true,
      pendingConsents: [
        {
          consent_type: "cross_border_transfer",
          policy_version: MOCK_POLICY_VERSION,
        },
      ],
    });
    await page.goto("/");

    await page.getByRole("button", { name: /删除我的账号与全部数据/ }).click();

    // First click only reveals what will be destroyed.
    await expect(page.getByText(/活动数据库中删除/)).toBeVisible();
    expect(mocks.getDeleteAccountCalls()).toBe(0);

    // And the confirm button stays inert until the password is supplied — the
    // server re-checks it regardless, so a UI that fired without one would just
    // produce a confusing 400.
    await expect(page.getByRole("button", { name: "确认删除" })).toBeDisabled();

    await page.getByLabel(/请输入当前密码以确认/).fill("password123");
    await page.getByRole("button", { name: "确认删除" }).click();

    await expect(
      page.getByRole("button", { name: LOGIN_SUBMIT }),
    ).toBeVisible();
    expect(mocks.getDeleteAccountCalls()).toBe(1);
  });

  // The proportionate exit from a health-data consent. Health consent now
  // spans injury, menstrual and body data, so declining deletes that category
  // while keeping the account and training history.
  test("deletes all health data without deleting the account", async ({
    page,
  }) => {
    const mocks = await installApiMocks(page, {
      authenticated: true,
      pendingConsents: [
        {
          consent_type: "sensitive_health_data",
          policy_version: MOCK_POLICY_VERSION,
        },
      ],
    });
    let deleteAllHealthDataCalls = 0;
    await page.route("**/api/personal-health-data", (route) => {
      deleteAllHealthDataCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: { success: true } }),
      });
    });
    await page.goto("/");

    await expect(page.getByText("需要你单独确认：健康数据")).toBeVisible();

    await page.getByRole("button", { name: /删除全部健康数据/ }).click();

    // Back in the app, account intact.
    await expect(page.getByRole("button", { name: PROFILE_TAB })).toBeVisible();
    expect(deleteAllHealthDataCalls).toBe(1);
    expect(mocks.getWithdrawHealthCalls()).toBe(0);
    expect(mocks.getDeleteAccountCalls()).toBe(0);
    expect(mocks.getConsentBodies()).toEqual([]);
  });

  // The cross-border consent cannot be settled by deleting only health data:
  // the exported data is the whole account, so this option must not appear.
  test("does not offer health-only deletion for the cross-border consent", async ({
    page,
  }) => {
    await installApiMocks(page, {
      authenticated: true,
      pendingConsents: [
        {
          consent_type: "cross_border_transfer",
          policy_version: MOCK_POLICY_VERSION,
        },
      ],
    });
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: /删除全部健康数据/ }),
    ).toHaveCount(0);
  });

  test("says plainly that logging out does not stop storage", async ({
    page,
  }) => {
    await installApiMocks(page, {
      authenticated: true,
      pendingConsents: [
        {
          consent_type: "cross_border_transfer",
          policy_version: MOCK_POLICY_VERSION,
        },
      ],
    });
    await page.goto("/");

    await expect(page.getByText(/只退出登录不会停止存储/)).toBeVisible();
  });
});
