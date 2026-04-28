import { compare, hash } from "bcryptjs";

const PASSWORD_SALT_ROUNDS = 10;

/**
 * Hash a plaintext password for storage.
 *
 * @param password - Plaintext password.
 * @returns Promise resolving to a bcrypt password hash.
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, PASSWORD_SALT_ROUNDS);
}

/**
 * Compare a plaintext password against a stored hash.
 *
 * @param password - Plaintext password.
 * @param passwordHash - Stored password hash.
 * @returns Promise resolving to true when the password matches the hash.
 */
export async function comparePassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return compare(password, passwordHash);
}
