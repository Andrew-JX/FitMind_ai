import { randomBytes } from "node:crypto";

import { createUser, findUserByEmail } from "../src/db/repositories/index.js";
import { registerSchema } from "../src/schemas/auth-schemas.js";
import { hashPassword } from "../src/services/auth/password.js";

/**
 * Operator-side account provisioning for invite-only deployments.
 *
 * `POST /api/auth/register` is closed whenever `REGISTRATION_INVITE_ONLY` is
 * not explicitly disabled, so this script is the supported way to add the
 * handful of accounts an invite-only instance serves. It writes straight to
 * the database and deliberately bypasses the HTTP gate.
 *
 * The password is never taken from argv: shell history and the process list
 * are both readable. Supply `NEW_USER_PASSWORD` in the environment, or let the
 * script generate one and print it once.
 */

interface CreateUserOptions {
  help: boolean;
  email?: string | undefined;
  displayName?: string | undefined;
}

const GENERATED_PASSWORD_BYTES = 18;

/**
 * Parse supported CLI flags for the create-user script.
 *
 * @param args - Raw CLI arguments after the script path.
 * @returns Parsed create-user options.
 */
function parseCreateUserOptions(args: string[]): CreateUserOptions {
  const options: CreateUserOptions = {
    help: args.includes("--help") || args.includes("-h"),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--email") {
      options.email = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--display-name") {
      options.displayName = args[index + 1];
      index += 1;
    }
  }

  return options;
}

/**
 * Print usage information for the create-user script.
 *
 * @returns Nothing.
 */
function printHelp(): void {
  console.log(
    "Usage: tsx scripts/create-user.ts --email <address> [--display-name <name>]",
  );
  console.log("");
  console.log(
    "Creates one account directly in the database, bypassing the invite-only",
  );
  console.log("registration gate. Requires DATABASE_URL.");
  console.log("");
  console.log(
    "Set NEW_USER_PASSWORD to choose the password (min 8 characters);",
  );
  console.log("otherwise a random one is generated and printed once.");
}

/**
 * Generate a URL-safe random password for a provisioned account.
 *
 * @returns A freshly generated password.
 */
function generatePassword(): string {
  return randomBytes(GENERATED_PASSWORD_BYTES).toString("base64url");
}

/**
 * Create one user account from CLI input.
 *
 * @returns Nothing.
 */
async function main(): Promise<void> {
  const options = parseCreateUserOptions(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (
    typeof process.env.DATABASE_URL !== "string" ||
    process.env.DATABASE_URL.length === 0
  ) {
    throw new Error("DATABASE_URL is required to create a user.");
  }

  if (options.email === undefined) {
    printHelp();
    throw new Error("--email is required.");
  }

  const suppliedPassword = process.env.NEW_USER_PASSWORD;
  const isGenerated =
    typeof suppliedPassword !== "string" || suppliedPassword.length === 0;
  const password = isGenerated ? generatePassword() : suppliedPassword;

  // Reuse the HTTP register schema so provisioned accounts obey exactly the
  // same email normalization and password rules as self-service sign-up.
  const input = registerSchema.parse({
    email: options.email,
    password,
    display_name: options.displayName,
  });

  const existing = await findUserByEmail(input.email);

  if (existing !== null) {
    throw new Error(`An account already exists for ${input.email}.`);
  }

  const passwordHash = await hashPassword(input.password);
  const user = await createUser({
    email: input.email,
    passwordHash,
    displayName: input.display_name ?? null,
  });

  console.log(`Created user ${user.email} (${user.id}).`);

  if (isGenerated) {
    console.log("");
    console.log(`Generated password: ${password}`);
    console.log(
      "Printed once, and the app has no self-service password change yet, so",
    );
    console.log(
      "this stays the account password. Share it over a private channel.",
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
