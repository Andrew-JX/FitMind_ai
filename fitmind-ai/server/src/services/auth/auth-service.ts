import { z } from "zod";

import {
  createUser,
  findUserByEmail,
  findUserById,
} from "../../db/repositories/index.js";
import { HttpError } from "../../utils/http-error.js";
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
}

export interface LoginServiceInput {
  email: string;
  password: string;
}

export interface AuthSuccessResult {
  user: AuthUser;
  token: string;
}

export interface MeResult {
  user: AuthUser;
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
 * @returns Registered user and bearer token.
 */
export async function register(
  input: RegisterServiceInput,
): Promise<AuthSuccessResult> {
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
      await createUser({
        email: input.email,
        passwordHash,
        displayName: input.display_name,
      }),
    );

    return {
      user: mapUserRowToAuthUser(createdUser),
      token: await signJwt(createdUser.id),
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
 * @returns Authenticated user and bearer token.
 */
export async function login(
  input: LoginServiceInput,
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
  };
}

/**
 * Resolve the current authenticated user from a verified token subject.
 *
 * @param userId - Verified authenticated user id.
 * @returns Current user payload.
 */
export async function getCurrentUser(userId: string): Promise<MeResult> {
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
  };
}
