/**
 * Databases the destructive verification script is allowed to touch.
 *
 * @remarks
 * An exact allowlist, not a pattern. A substring rule (`name.includes("test")`)
 * reads as strict and is not: `contest`, `latest_backup` and `fitmind_prod_test_copy`
 * all pass it. Adding a name here is a deliberate, reviewable act; that is the
 * whole point.
 */
export const ALLOWED_TEST_DATABASES = new Set(["fitmind_migtest"]);

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Env var the verification script reads. Deliberately not `DATABASE_URL`. */
export const TEST_DATABASE_URL_VAR = "CONSENT_SQL_TEST_DATABASE_URL";

/** Connection settings built from validated parts, never a raw string. */
export interface TestDatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

/**
 * Resolve the database for the consent verification script, refusing anything
 * that is not a known local throwaway.
 *
 * @param env - Environment to read from
 * @returns Connection settings assembled from the validated components
 * @throws When the variable is unset, unparseable, remote, carries query
 *   parameters, or names a database that is not on the allowlist
 *
 * @remarks
 * Three fail-closed guards, none of them decorative. The first version of that
 * script read `DATABASE_URL` — the same variable the production server uses —
 * and opened with an unconditional `DELETE FROM users`, while the docs told
 * people to run it by name. Any shell that happened to have the real connection
 * string exported would have cascaded away every account.
 *
 * A comment saying "throwaway database" is not a safeguard. These are:
 *
 * - a dedicated variable, so a stray `DATABASE_URL` cannot be picked up;
 * - a local-host allowlist, so a remote database is refused before connecting;
 * - an exact name allowlist, so even locally it has to be a database someone
 *   deliberately registered here.
 *
 * **It returns parts, not the original string.** An earlier version validated
 * `URL.hostname` and then handed the raw connection string to `pg`, which honours
 * a `host` query parameter — so
 * `postgres://u:p@127.0.0.1/fitmind_migtest?host=ep-prod.neon.tech` passed the
 * local-host check while `pg` resolved the host to `ep-prod.neon.tech`. What was
 * demonstrated is that the effective host could be redirected to a **remote
 * PostgreSQL server**; the database name still had to be on the allowlist, so
 * reaching a production database was not shown. That is enough: the checked
 * destination and the used destination were different, and a guard that can be
 * pointed somewhere else is not a guard. Returning the validated components is
 * the fix; query parameters are rejected outright as well, so nothing else can
 * smuggle an override in.
 *
 * Lives in `src/` rather than beside the script so it is covered by the normal
 * test run. A safety check with no test is a safety check that can be removed
 * without anything going red.
 */
export function resolveTestDatabaseUrl(
  env: NodeJS.ProcessEnv,
): TestDatabaseConfig {
  const raw = env[TEST_DATABASE_URL_VAR];

  if (raw === undefined || raw === "") {
    throw new Error(
      `${TEST_DATABASE_URL_VAR} is required. This script writes to the ` +
        "database it connects to, so it deliberately ignores DATABASE_URL.",
    );
  }

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${TEST_DATABASE_URL_VAR} is not a valid URL.`);
  }

  // Rejected before the host check, because a query parameter is precisely how
  // the host check was bypassed. None are needed for a local throwaway.
  if (url.search !== "") {
    throw new Error(
      `Refusing a connection string with query parameters (${url.search}). ` +
        "`pg` lets parameters such as `?host=` override the host this function " +
        "just validated, so they are not accepted here.",
    );
  }

  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(
      `Refusing to run against non-local host "${url.hostname}". This script ` +
        "is only for a local throwaway database.",
    );
  }

  const database = url.pathname.replace(/^\//u, "");

  if (!ALLOWED_TEST_DATABASES.has(database)) {
    throw new Error(
      `Refusing to run against database "${database}". Allowed: ` +
        `${[...ALLOWED_TEST_DATABASES].join(", ")}. Add a name to ` +
        "ALLOWED_TEST_DATABASES only if it is genuinely disposable.",
    );
  }

  return {
    host: url.hostname,
    port: url.port === "" ? 5432 : Number(url.port),
    database,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}
