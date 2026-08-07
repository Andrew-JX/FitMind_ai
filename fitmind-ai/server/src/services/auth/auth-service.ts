import { z } from "zod";

import {
  deleteUserById,
  findUserByEmail,
  findUserById,
} from "../../db/repositories/index.js";
import { createUserWithConsents } from "../../db/user-consent-repository.js";
import { HttpError } from "../../utils/http-error.js";
import type {
  ConsentDecisionInput,
  PendingConsent,
  RegistrationPolicyOverrides,
} from "./consent-service.js";
import {
  assertCrossBorderConsent,
  getPendingConsents,
  getRegistrationPolicy,
} from "./consent-service.js";
import { comparePassword, hashPassword } from "./password.js";
import { signJwt } from "./jwt.js";

const userRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  passwordHash: z.string().min(1),
  displayName: z.string().nullable(),
  createdAt: z.unknown(),
  updatedAt: z.unknown(),
});

const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string().nullable(),
});

export interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
}

export interface RegisterServiceInput {
  email: string;
  password: string;
  display_name?: string | undefined;
  cross_border_consent?: ConsentDecisionInput | undefined;
}

export interface LoginServiceInput {
  email: string;
  password: string;
}

export interface AuthSuccessResult {
  user: AuthUser;
  token: string;
  /**
   * Consents this account still owes, so the app can block on them from the
   * first render of the session instead of after a second round trip.
   */
  pending_consents: PendingConsent[];
}

export interface MeResult {
  user: AuthUser;
  pending_consents: PendingConsent[];
}

function mapUserRowToAuthUser(row: z.infer<typeof userRowSchema>): AuthUser {
  return authUserSchema.parse({
    id: row.id,
    email: row.email,
    display_name: row.displayName,
  });
}

function isUniqueViolationError(
  error: unknown,
): error is { code: string; constraint?: string | undefined } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  );
}

/**
 * Register a new user and issue a bearer token.
 *
 * @param input - Normalized registration input.
 * @param overrides - Optional explicit policy values, injected by tests.
 * @returns Registered user and bearer token.
 *
 * @remarks
 * Consent is enforced here rather than in the client, and the account plus its
 * consent row are written in one transaction. The previous version checked a
 * React state variable, which meant `POST /api/auth/register` created accounts
 * with no consent at all and left no record of the consent it did collect.
 */
export async function register(
  input: RegisterServiceInput,
  overrides?: RegistrationPolicyOverrides,
): Promise<AuthSuccessResult> {
  const policy = getRegistrationPolicy(overrides);

  // Before the password hash, which is deliberately slow: a request that can
  // never succeed should not buy the caller bcrypt work.
  assertCrossBorderConsent(input.cross_border_consent, policy);

  const existingUser = await findUserByEmail(input.email);

  if (existingUser !== null) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "An account with this email already exists.",
    );
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const createdUser = userRowSchema.parse(
      await createUserWithConsents({
        email: input.email,
        passwordHash,
        displayName: input.display_name,
        consents: policy.cross_border_consent_required
          ? [
              {
                consentType: "cross_border_transfer",
                policyVersion: policy.policy_version,
                source: "registration",
              },
            ]
          : [],
      }),
    );

    return {
      user: mapUserRowToAuthUser(createdUser),
      token: await signJwt(createdUser.id),
      // Empty by construction rather than by query: registration cannot get
      // this far without the consent this instance requires, and a brand-new
      // account has no profile and so no health data to consent to.
      pending_consents: [],
    };
  } catch (error) {
    if (isUniqueViolationError(error) && error.code === "23505") {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "An account with this email already exists.",
      );
    }

    throw error;
  }
}

/**
 * Authenticate a user and issue a bearer token.
 *
 * @param input - Normalized login input.
 * @param overrides - Optional explicit policy values, injected by tests.
 * @returns Authenticated user, bearer token, and any consents still owed.
 */
export async function login(
  input: LoginServiceInput,
  overrides?: RegistrationPolicyOverrides,
): Promise<AuthSuccessResult> {
  const foundUser = await findUserByEmail(input.email);

  if (foundUser === null) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid email or password.");
  }

  const userRow = userRowSchema.parse(foundUser);
  const passwordMatches = await comparePassword(
    input.password,
    userRow.passwordHash,
  );

  if (!passwordMatches) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid email or password.");
  }

  return {
    user: mapUserRowToAuthUser(userRow),
    token: await signJwt(userRow.id),
    pending_consents: await getPendingConsents(userRow.id, overrides),
  };
}

/**
 * Resolve the current authenticated user from a verified token subject.
 *
 * @param userId - Verified authenticated user id.
 * @param overrides - Optional explicit policy values, injected by tests.
 * @returns Current user payload and any consents still owed.
 *
 * @remarks
 * `pending_consents` is how accounts created before this seam are brought into
 * compliance: they are asked in the app rather than backfilled. It is empty for
 * every account registered afterwards, since registration cannot complete
 * without the consent it requires.
 */
export async function getCurrentUser(
  userId: string,
  overrides?: RegistrationPolicyOverrides,
): Promise<MeResult> {
  const userRow = await findUserById(userId);

  if (userRow === null) {
    throw new HttpError(
      401,
      "UNAUTHORIZED",
      "Authenticated user was not found.",
    );
  }

  return {
    user: mapUserRowToAuthUser(userRowSchema.parse(userRow)),
    pending_consents: await getPendingConsents(userId, overrides),
  };
}

/**
 * Delete the authenticated user's account and every row that references it.
 *
 * @param userId - Verified authenticated user id.
 * @param password - Current password, re-checked before destroying anything.
 * @returns Resolves once the account is gone.
 * @throws HttpError 401 UNAUTHORIZED when the password does not match.
 *
 * @remarks
 * This is the "stop processing" the catch-up screen offers when someone
 * declines. Logging them out was not that: declining left the account, the
 * training data and the injury constraints exactly where they were, in an
 * overseas database, under a consent the user had just refused to give. The
 * screen said processing would stop and it did not.
 *
 * Reachable while a consent is still outstanding, deliberately — an account
 * that owes a consent is exactly the account most likely to want this, and
 * gating it would leave the user unable to either agree or leave.
 *
 * The password is re-checked here rather than trusted from the session. Tokens
 * are valid for seven days, so without this a leaked cookie would be enough to
 * destroy an account permanently — the one action in this API with no undo and
 * no trace left to inspect afterwards. A confirmation step in the UI does not
 * help, because the UI is not what an attacker would be using.
 *
 * A second request for an account that is already gone returns `401`, not
 * success: the lookup that precedes the password check finds nothing, so there
 * is no one to re-authenticate. This is not idempotent, and an earlier version
 * of this comment claimed it was — backed by a test that kept the user row
 * present and only made the delete report zero rows, which is a concurrent
 * delete, not a repeat request.
 */
export async function deleteAccount(
  userId: string,
  password: string,
): Promise<void> {
  const userRow = await findUserById(userId);

  if (userRow === null) {
    throw new HttpError(
      401,
      "UNAUTHORIZED",
      "Authenticated user was not found.",
    );
  }

  const parsedUser = userRowSchema.parse(userRow);
  const passwordMatches = await comparePassword(
    password,
    parsedUser.passwordHash,
  );

  if (!passwordMatches) {
    throw new HttpError(
      401,
      "UNAUTHORIZED",
      "The password does not match, so nothing was deleted.",
    );
  }

  await deleteUserById(userId);

  // Observability only. This is NOT a deletion ledger, and the privacy policy
  // deliberately does not promise one.
  //
  // Two reasons it cannot be. It is written after the commit, so a process that
  // dies in between loses the record while the deletion stands. And the
  // platform's runtime log retention is far shorter than the database's
  // point-in-time window — hours or days against up to thirty days — so a
  // restore targeting anything but the very recent past would find no event to
  // replay. A durable, acknowledged, externally retained store is what that
  // promise would require; see `china-launch-plan.md` §5.1.
  //
  // User id only. The email is exactly the kind of thing that should not
  // outlive the account in a log.
  console.info(
    JSON.stringify({
      event: "account_deleted",
      user_id: userId,
      deleted_at: new Date().toISOString(),
    }),
  );
}
