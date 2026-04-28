import { SignJWT, jwtVerify } from "jose";

import { requireJwtSecret } from "../../env.js";
import { HttpError } from "../../utils/http-error.js";

const JWT_ALGORITHM = "HS256";
const JWT_EXPIRES_IN = "7d";
const JWT_AUDIENCE = "fitmind-api";
const JWT_ISSUER = "fitmind-auth";

export interface AuthTokenPayload {
  userId: string;
}

function getJwtSecretKey(): Uint8Array {
  return new TextEncoder().encode(requireJwtSecret());
}

/**
 * Sign a bearer token for the provided user id.
 *
 * @param userId - Authenticated user id.
 * @returns Signed JWT string.
 */
export async function signJwt(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(userId)
    .setAudience(JWT_AUDIENCE)
    .setIssuer(JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(getJwtSecretKey());
}

/**
 * Verify a bearer token and extract the authenticated user id.
 *
 * @param token - Raw bearer token string.
 * @returns Verified token payload.
 */
export async function verifyJwt(token: string): Promise<AuthTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), {
      algorithms: [JWT_ALGORITHM],
      audience: JWT_AUDIENCE,
      issuer: JWT_ISSUER,
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new HttpError(401, "UNAUTHORIZED", "Invalid authentication token.");
    }

    return {
      userId: payload.sub,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, "UNAUTHORIZED", "Invalid authentication token.");
  }
}
