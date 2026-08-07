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

/** Policy version the mocks agree on; matches `shared/src/consent.ts`. */
export const MOCK_POLICY_VERSION = "2026-08-04";

export interface PendingConsentMock {
  consent_type: "cross_border_transfer" | "sensitive_health_data";
  policy_version: string;
}

export interface RegistrationPolicyMock {
  registration_open: boolean;
  policy_version: string;
  data_residency: "overseas" | "mainland";
  cross_border_consent_required: boolean;
}

/** An overseas instance with sign-up open: the demo deployment's shape. */
export const OPEN_OVERSEAS_POLICY: RegistrationPolicyMock = {
  registration_open: true,
  policy_version: MOCK_POLICY_VERSION,
  data_residency: "overseas",
  cross_border_consent_required: true,
};

export interface AthleteProfileMock {
  goal: string;
  weeklyDays: number;
  availableEquipment: string[];
  injuryConstraints: string[];
}

export interface ApiMockOptions {
  /** Whether the simulated HttpOnly session cookie is already valid on load. */
  authenticated: boolean;
  /** Profile the athlete-profile endpoints start with, or null for none. */
  athleteProfile?: AthleteProfileMock | null | undefined;
  /** Whether a live `sensitive_health_data` consent is already on file. */
  healthConsentOnFile?: boolean | undefined;
  /**
   * Whether a live health consent exists at *any* policy version.
   *
   * Defaults to `healthConsentOnFile`, which is the ordinary case. Set it
   * independently to model the state that used to hide the withdrawal control:
   * a consent given under superseded wording, which does not let the form skip
   * asking but is still a permission the user may take back.
   */
  withdrawableHealthConsent?: boolean | undefined;
  /**
   * What `GET /api/auth/registration-policy` answers. `"unavailable"` makes it
   * fail, which the client must treat as fail-closed for registration while
   * leaving login working.
   */
  registrationPolicy?: RegistrationPolicyMock | "unavailable" | undefined;
  /** Consents the simulated account still owes, surfaced by `/me` and login. */
  pendingConsents?: PendingConsentMock[] | undefined;
}

export interface ApiMocks {
  /** Body of the last `POST /api/auth/register`, or null if never called. */
  getRegisterBody: () => Record<string, unknown> | null;
  /** Bodies of every `POST /api/auth/consents` in call order. */
  getConsentBodies: () => Record<string, unknown>[];
  /** How many times `DELETE /api/auth/account` was called. */
  getDeleteAccountCalls: () => number;
  /** How many times the injury-constraints withdrawal was called. */
  getWithdrawHealthCalls: () => number;
  /** Stored profile and health-consent state, as the mocked server holds it. */
  getProfileState: () => {
    profile: AthleteProfileMock | null;
    healthConsentOnFile: boolean;
    withdrawableHealthConsent: boolean;
  };
  /** Bodies of every `PUT /api/athlete-profile`, in call order. */
  getProfilePutBodies: () => Record<string, unknown>[];
  /**
   * Make the next withdrawal commit and then lose its response.
   *
   * @remarks
   * Models the case the client cannot distinguish from the outside: the
   * transaction went through, the reply never arrived. It has to live here
   * rather than in a spec-level `route.abort`, because intercepting the call
   * ahead of this mock means the withdrawal never reaches it — the write does
   * not happen, and the spec ends up proving the opposite of what it claims.
   */
  dropNextWithdrawalResponse: () => void;
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
): Promise<ApiMocks> {
  let authenticated = options.authenticated;
  let pendingConsents = options.pendingConsents ?? [];
  let registerBody: Record<string, unknown> | null = null;
  const consentBodies: Record<string, unknown>[] = [];
  let deleteAccountCalls = 0;
  let withdrawHealthCalls = 0;
  let athleteProfile = options.athleteProfile ?? null;
  let healthConsentOnFile = options.healthConsentOnFile ?? false;
  let withdrawableHealthConsent =
    options.withdrawableHealthConsent ?? healthConsentOnFile;
  const profilePutBodies: Record<string, unknown>[] = [];
  let dropWithdrawalResponse = false;
  const registrationPolicy = options.registrationPolicy ?? OPEN_OVERSEAS_POLICY;

  await page.route("**/api/**", (route) =>
    respondJson(route, 500, {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Not mocked in this E2E." },
    }),
  );

  await page.route("**/api/auth/registration-policy", (route) => {
    if (registrationPolicy === "unavailable") {
      return respondJson(route, 500, {
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "Policy unavailable." },
      });
    }

    return respondJson(route, 200, { ok: true, data: registrationPolicy });
  });

  await page.route("**/api/auth/me", (route) => {
    if (authenticated) {
      return respondJson(route, 200, {
        ok: true,
        data: { user: MOCK_USER, pending_consents: pendingConsents },
      });
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
      data: {
        user: MOCK_USER,
        token: "e2e-token",
        pending_consents: pendingConsents,
      },
    });
  });

  // Records what the client actually sent. The point of these tests is that the
  // consent leaves the browser, not that a checkbox rendered — the bug this
  // replaced was a checkbox that gated nothing beyond React state.
  await page.route("**/api/auth/register", (route) => {
    registerBody = route.request().postDataJSON() as Record<string, unknown>;
    authenticated = true;

    return respondJson(route, 201, {
      ok: true,
      data: { user: MOCK_USER, token: "e2e-token", pending_consents: [] },
    });
  });

  await page.route("**/api/auth/consents", (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    consentBodies.push(body);
    pendingConsents = pendingConsents.filter(
      (pending) => pending.consent_type !== body["consent_type"],
    );

    return respondJson(route, 201, { ok: true, data: { consent: body } });
  });

  await page.route("**/api/athlete-profile/injury-constraints", (route) => {
    withdrawHealthCalls += 1;
    pendingConsents = pendingConsents.filter(
      (pending) => pending.consent_type !== "sensitive_health_data",
    );
    // The endpoint clears the data *and* closes the consent. A mock that only
    // did the first would let a spec "prove" a withdrawal the server never
    // performs — the failure mode this whole consent batch keeps hitting.
    if (athleteProfile !== null) {
      athleteProfile = { ...athleteProfile, injuryConstraints: [] };
    }
    healthConsentOnFile = false;
    withdrawableHealthConsent = false;

    // Committed, then the response is lost. The state above has already
    // changed, which is exactly what makes this different from a refusal.
    if (dropWithdrawalResponse) {
      dropWithdrawalResponse = false;
      return route.abort("connectionreset");
    }

    return respondJson(route, 200, { ok: true, data: { success: true } });
  });

  // Mirrors the server contract this batch pinned, including fitmind-lmy's rule
  // that an empty injury list *is* a withdrawal. Deliberately not a permissive
  // stub: a mock that always answers 200 would hide exactly the regressions
  // these specs exist to catch.
  await page.route("**/api/athlete-profile", (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      profilePutBodies.push(body);

      const injuries = (body["injuryConstraints"] ?? []) as string[];
      const decision = body["sensitiveHealthConsent"] as
        | { accepted?: boolean; policy_version?: string }
        | undefined;

      if (injuries.length > 0 && !healthConsentOnFile) {
        if (decision?.accepted !== true) {
          return respondJson(route, 422, {
            ok: false,
            error: {
              code: "CONSENT_REQUIRED",
              message: "Storing injury constraints requires separate consent.",
              details: { consent_type: "sensitive_health_data" },
            },
          });
        }

        healthConsentOnFile = true;
        withdrawableHealthConsent = true;
      }

      if (injuries.length === 0) {
        healthConsentOnFile = false;
        withdrawableHealthConsent = false;
      }

      athleteProfile = {
        goal: (body["goal"] ?? "strength") as string,
        weeklyDays: (body["weeklyDays"] ?? 3) as number,
        availableEquipment: (body["availableEquipment"] ?? []) as string[],
        injuryConstraints: injuries,
      };
    }

    return respondJson(route, 200, {
      ok: true,
      data: {
        profile:
          athleteProfile === null
            ? null
            : { ...athleteProfile, updatedAt: "2026-08-06T00:00:00.000Z" },
        health_consent_on_file: healthConsentOnFile,
        withdrawable_health_consent: withdrawableHealthConsent,
      },
    });
  });

  await page.route("**/api/auth/account", (route) => {
    if (route.request().method() !== "DELETE") {
      return respondJson(route, 405, {
        ok: false,
        error: { code: "NOT_FOUND", message: "Method not allowed." },
      });
    }

    // Mirrors the server's re-authentication: a request with no password must
    // not delete anything, so a test that forgets it fails here too.
    const body = route.request().postDataJSON() as { password?: string } | null;

    if (body?.password === undefined || body.password.length === 0) {
      return respondJson(route, 400, {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Password required." },
      });
    }

    deleteAccountCalls += 1;
    authenticated = false;
    pendingConsents = [];

    return respondJson(route, 200, { ok: true, data: { success: true } });
  });

  await page.route("**/api/auth/logout", (route) => {
    authenticated = false;
    pendingConsents = [];

    return respondJson(route, 200, { ok: true, data: { success: true } });
  });

  return {
    getRegisterBody: () => registerBody,
    getConsentBodies: () => consentBodies,
    getDeleteAccountCalls: () => deleteAccountCalls,
    getWithdrawHealthCalls: () => withdrawHealthCalls,
    getProfileState: () => ({
      profile: athleteProfile,
      healthConsentOnFile,
      withdrawableHealthConsent,
    }),
    getProfilePutBodies: () => profilePutBodies,
    dropNextWithdrawalResponse: () => {
      dropWithdrawalResponse = true;
    },
  };
}
