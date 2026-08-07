import { expect, test } from "@playwright/test";

import { installApiMocks, MOCK_POLICY_VERSION } from "./support/mock-api";

/**
 * fitmind-lmy: an account whose consents are settled must be able to take the
 * health-data consent back.
 *
 * @remarks
 * The withdrawal endpoint already existed and was already correct. What did not
 * exist was a way to reach it: its only entry point was the pending-consent
 * catch-up screen, which an account with nothing outstanding never sees. A
 * right the user cannot find is not a right they have, so the assertions here
 * are about the ordinary profile UI, not about the endpoint.
 */
const PROFILE_TAB = "个人";
const PROFILE_ENTRY = "训练档案";
const INJURY_PLACEHOLDER = "用逗号分隔，如：膝盖, 肩";
const WITHDRAW_TRIGGER = "撤回伤病信息";
const WITHDRAW_CONFIRM = "确认撤回";
const SAVE_PROFILE = "保存档案";
const HEALTH_CONSENT = /敏感个人信息/;

const STORED_PROFILE = {
  goal: "endurance",
  weeklyDays: 5,
  availableEquipment: ["barbell"],
  injuryConstraints: ["knee"],
};

async function openProfileSheet(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: PROFILE_TAB }).click();
  await page.getByRole("button", { name: new RegExp(PROFILE_ENTRY) }).click();
  await expect(page.getByPlaceholder(INJURY_PLACEHOLDER)).toBeVisible();
}

test.describe("withdrawing injury data from the ordinary profile sheet", () => {
  test("the explicit control completes the withdrawal", async ({ page }) => {
    const mocks = await installApiMocks(page, {
      authenticated: true,
      pendingConsents: [],
      athleteProfile: STORED_PROFILE,
      healthConsentOnFile: true,
    });
    await page.goto("/");
    await openProfileSheet(page);

    // Loaded state: the sheet is showing stored injury data.
    await expect(page.getByPlaceholder(INJURY_PLACEHOLDER)).toHaveValue("knee");

    // Deliberate confirmation: the trigger alone must not withdraw anything.
    await page.getByRole("button", { name: WITHDRAW_TRIGGER }).click();
    expect(mocks.getWithdrawHealthCalls()).toBe(0);

    await page.getByRole("button", { name: WITHDRAW_CONFIRM }).click();

    await expect(page.getByPlaceholder(INJURY_PLACEHOLDER)).toHaveValue("");
    expect(mocks.getWithdrawHealthCalls()).toBe(1);

    // What the *mock backend* was left holding, not what the form is showing.
    // Naming that precisely matters: this is a fixture applying the contract
    // written down in `mock-api.ts`, so it proves the client drove the
    // withdrawal end to end — not that the real server did anything. The
    // server-side proof that the consent is actually closed lives in
    // `verify:consent-sql` §6 and the repository tests; if the two ever
    // disagree, this file is the one that is wrong.
    const state = mocks.getProfileState();
    expect(state.profile?.injuryConstraints).toEqual([]);
    expect(state.healthConsentOnFile).toBe(false);
  });

  test("withdrawing keeps the rest of the profile and asks again next time", async ({
    page,
  }) => {
    await installApiMocks(page, {
      authenticated: true,
      pendingConsents: [],
      athleteProfile: STORED_PROFILE,
      healthConsentOnFile: true,
    });
    await page.goto("/");
    await openProfileSheet(page);

    await page.getByRole("button", { name: WITHDRAW_TRIGGER }).click();
    await page.getByRole("button", { name: WITHDRAW_CONFIRM }).click();
    await expect(page.getByPlaceholder(INJURY_PLACEHOLDER)).toHaveValue("");

    // Withdrawing one category must not cost the user the settings they did
    // consent to. Goal and weekly days are still what was loaded.
    await expect(page.getByLabel("训练目标")).toHaveValue("endurance");
    await expect(page.getByLabel("每周训练天数")).toHaveValue("5");

    // The permission is genuinely gone: typing an injury again brings the
    // consent question back rather than silently reusing the old agreement.
    await page.getByPlaceholder(INJURY_PLACEHOLDER).fill("肩");
    await expect(page.getByLabel(HEALTH_CONSENT)).toBeVisible();
  });

  test("clearing the box by hand and saving is the same withdrawal", async ({
    page,
  }) => {
    const mocks = await installApiMocks(page, {
      authenticated: true,
      pendingConsents: [],
      athleteProfile: STORED_PROFILE,
      healthConsentOnFile: true,
    });
    await page.goto("/");
    await openProfileSheet(page);

    await page.getByPlaceholder(INJURY_PLACEHOLDER).fill("");
    await page.getByRole("button", { name: SAVE_PROFILE }).click();

    await expect(page.getByPlaceholder(INJURY_PLACEHOLDER)).toBeHidden();

    // What this proves and what it does not: the browser sends an empty list,
    // and the form ends up in the withdrawn state. It does *not* prove the
    // server revokes the consent — the mock mirrors that rule, and a mock
    // cannot be evidence for the thing it is imitating. The revocation itself
    // is proven against a real PostgreSQL in `verify:consent-sql` §6.
    expect(mocks.getProfilePutBodies().at(-1)).toMatchObject({
      injuryConstraints: [],
    });
    expect(mocks.getProfileState().healthConsentOnFile).toBe(false);
  });

  test("no withdrawal control when there is nothing to withdraw", async ({
    page,
  }) => {
    await installApiMocks(page, {
      authenticated: true,
      pendingConsents: [],
      athleteProfile: { ...STORED_PROFILE, injuryConstraints: [] },
      healthConsentOnFile: false,
    });
    await page.goto("/");
    await openProfileSheet(page);

    // Offering to withdraw something that was never stored is noise, and it
    // would teach users to ignore the control that matters.
    await expect(
      page.getByRole("button", { name: WITHDRAW_TRIGGER }),
    ).toBeHidden();
  });

  // The gap the previous round shipped: the control was driven by the
  // current-version flag, so a user holding only a superseded-version consent
  // — no injury data behind it — saw no way to take that permission back, and
  // the catch-up screen never asks them either (it only asks when injury data
  // is stored). Live permission, no route to it.
  test("offers withdrawal for a consent given under superseded wording", async ({
    page,
  }) => {
    const mocks = await installApiMocks(page, {
      authenticated: true,
      pendingConsents: [],
      athleteProfile: { ...STORED_PROFILE, injuryConstraints: [] },
      healthConsentOnFile: false,
      withdrawableHealthConsent: true,
    });
    await page.goto("/");
    await openProfileSheet(page);

    await page.getByRole("button", { name: WITHDRAW_TRIGGER }).click();
    await page.getByRole("button", { name: WITHDRAW_CONFIRM }).click();

    expect(mocks.getWithdrawHealthCalls()).toBe(1);
    expect(mocks.getProfileState().withdrawableHealthConsent).toBe(false);
    await expect(
      page.getByRole("button", { name: WITHDRAW_TRIGGER }),
    ).toBeHidden();
  });

  // A request that fails after the server committed is indistinguishable, from
  // here, from one that never arrived — so the old "your data was not changed"
  // was a guess presented as a fact, about the single thing the user most needs
  // to be true. The client now asks what actually happened.
  test("re-reads the truth when the withdrawal response is lost", async ({
    page,
  }) => {
    const mocks = await installApiMocks(page, {
      authenticated: true,
      pendingConsents: [],
      athleteProfile: STORED_PROFILE,
      healthConsentOnFile: true,
    });
    await page.goto("/");
    await openProfileSheet(page);

    // The write lands; only the response is lost. Driven from inside the mock,
    // because a spec-level `route.abort` registered over the top intercepts the
    // call *before* the mock sees it: nothing gets withdrawn, and the test then
    // asserts the opposite of its own name while looking green-adjacent. That
    // is what the first version of this test did, and it failed loudly only
    // because the field still held "knee".
    mocks.dropNextWithdrawalResponse();

    await page.getByRole("button", { name: WITHDRAW_TRIGGER }).click();
    await page.getByRole("button", { name: WITHDRAW_CONFIRM }).click();

    // The withdrawal really happened, so the user must be told it happened.
    await expect(page.getByPlaceholder(INJURY_PLACEHOLDER)).toHaveValue("");
    await expect(page.getByText("撤回尚未完成")).toBeHidden();
    await expect(page.getByText("无法确认")).toBeHidden();
    expect(mocks.getProfileState().profile?.injuryConstraints).toEqual([]);
    expect(mocks.getProfileState().healthConsentOnFile).toBe(false);
  });

  test("says the result is unknown when it cannot be confirmed", async ({
    page,
  }) => {
    await installApiMocks(page, {
      authenticated: true,
      pendingConsents: [],
      athleteProfile: STORED_PROFILE,
      healthConsentOnFile: true,
    });
    await page.goto("/");
    await openProfileSheet(page);

    // Both the withdrawal and the re-read fail. Nothing here can know whether
    // the transaction committed, so the only honest answer is that we do not
    // know — claiming either outcome would be inventing one.
    await page.route("**/api/athlete-profile/injury-constraints", (route) =>
      route.abort("connectionreset"),
    );
    await page.route("**/api/athlete-profile", (route) =>
      route.abort("connectionreset"),
    );

    await page.getByRole("button", { name: WITHDRAW_TRIGGER }).click();
    await page.getByRole("button", { name: WITHDRAW_CONFIRM }).click();

    await expect(page.getByText("撤回结果暂时无法确认")).toBeVisible();
    await expect(page.getByText("没有被改动")).toBeHidden();
  });

  // The refusal case, and the reason the wording changed. A successful re-read
  // is a snapshot of *now*: it shows the data is still there, which means the
  // withdrawal is not done. It cannot show that nothing ever moved — the
  // withdrawal may have committed and another session may have saved injury
  // data again in between. So the message describes the current state and
  // stops there.
  test("reports the current state, not a claim about history", async ({
    page,
  }) => {
    await installApiMocks(page, {
      authenticated: true,
      pendingConsents: [],
      athleteProfile: STORED_PROFILE,
      healthConsentOnFile: true,
    });
    await page.goto("/");
    await openProfileSheet(page);

    // The withdrawal is refused outright; the re-read then succeeds against the
    // mock, which still holds the injury data. Intercepting ahead of the mock
    // is correct *here* precisely because nothing should be withdrawn — the
    // opposite of the lost-response case above.
    await page.route("**/api/athlete-profile/injury-constraints", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: { code: "INTERNAL_ERROR", message: "boom" },
        }),
      }),
    );

    await page.getByRole("button", { name: WITHDRAW_TRIGGER }).click();
    await page.getByRole("button", { name: WITHDRAW_CONFIRM }).click();

    await expect(
      page.getByText("当前仍检测到伤病信息或相关同意，撤回尚未完成，请重试。"),
    ).toBeVisible();
    // The two things this must not say: a claim about the past, and a claim
    // that the outcome is unknown when the re-read plainly answered it.
    await expect(page.getByText("没有被改动")).toBeHidden();
    await expect(page.getByText("无法确认")).toBeHidden();
    // The message says "retry", so the retry has to be right there. The sheet
    // stays in the confirming state after a failure, which means the button to
    // press again is the confirm — not the trigger, which is what this assertion
    // originally looked for and correctly failed on.
    await expect(
      page.getByRole("button", { name: WITHDRAW_CONFIRM }),
    ).toBeVisible();
    // And the data the user is trying to remove is still on screen, consistent
    // with the message rather than contradicting it.
    await expect(page.getByPlaceholder(INJURY_PLACEHOLDER)).toHaveValue("knee");
  });

  test("consenting for the first time still works through the form", async ({
    page,
  }) => {
    const mocks = await installApiMocks(page, {
      authenticated: true,
      pendingConsents: [],
      athleteProfile: { ...STORED_PROFILE, injuryConstraints: [] },
      healthConsentOnFile: false,
    });
    await page.goto("/");
    await openProfileSheet(page);

    await page.getByPlaceholder(INJURY_PLACEHOLDER).fill("膝盖");
    await page.getByLabel(HEALTH_CONSENT).check();
    await page.getByRole("button", { name: SAVE_PROFILE }).click();

    await expect(page.getByPlaceholder(INJURY_PLACEHOLDER)).toBeHidden();
    expect(mocks.getProfilePutBodies().at(-1)).toMatchObject({
      injuryConstraints: ["膝盖"],
      sensitiveHealthConsent: {
        accepted: true,
        policy_version: MOCK_POLICY_VERSION,
      },
    });
    expect(mocks.getProfileState().healthConsentOnFile).toBe(true);
  });
});
