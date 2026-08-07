import { describe, expect, it } from "vitest";

import {
  resolveTestDatabaseUrl,
  TEST_DATABASE_URL_VAR,
} from "./test-database-url.js";

function env(value?: string): NodeJS.ProcessEnv {
  return (
    value === undefined ? {} : { [TEST_DATABASE_URL_VAR]: value }
  ) as NodeJS.ProcessEnv;
}

const VALID = "postgres://postgres:postgres@127.0.0.1:55432/fitmind_migtest";

describe("resolveTestDatabaseUrl", () => {
  it("accepts the registered local throwaway database", () => {
    expect(resolveTestDatabaseUrl(env(VALID))).toEqual({
      host: "127.0.0.1",
      port: 55432,
      database: "fitmind_migtest",
      user: "postgres",
      password: "postgres",
    });
  });

  it("accepts localhost as well as the loopback address", () => {
    const viaName = "postgres://u:p@localhost:55432/fitmind_migtest";

    expect(resolveTestDatabaseUrl(env(viaName)).host).toBe("localhost");
  });

  // The variable is deliberately not DATABASE_URL. The script writes to the
  // database it connects to, and DATABASE_URL is the one variable most likely
  // to be sitting in an operator's shell pointing at production.
  it("refuses to fall back to DATABASE_URL", () => {
    const withProductionUrl = {
      DATABASE_URL: "postgres://user:pw@prod.example.com/fitmind",
    } as NodeJS.ProcessEnv;

    expect(() => resolveTestDatabaseUrl(withProductionUrl)).toThrow(
      /is required/u,
    );
  });

  it("refuses an empty value", () => {
    expect(() => resolveTestDatabaseUrl(env(""))).toThrow(/is required/u);
  });

  it("refuses a remote host before connecting", () => {
    expect(() =>
      resolveTestDatabaseUrl(
        env("postgres://u:p@ep-cool-name.neon.tech/fitmind_migtest"),
      ),
    ).toThrow(/non-local host/u);
  });

  // A substring rule reads as strict and is not. Each of these contains "test"
  // and none of them is a database anyone would want emptied — which is why the
  // guard is an exact allowlist.
  it.each([
    "contest",
    "latest_backup",
    "fitmind_prod_test_copy",
    "testimonials",
  ])("refuses database %s despite containing 'test'", (database) => {
    expect(() =>
      resolveTestDatabaseUrl(env(`postgres://u:p@127.0.0.1:5432/${database}`)),
    ).toThrow(/Refusing to run against database/u);
  });

  it("refuses the real database name", () => {
    expect(() =>
      resolveTestDatabaseUrl(env("postgres://u:p@127.0.0.1:5432/fitmind_ai")),
    ).toThrow(/Refusing to run against database/u);
  });

  it("refuses a value that is not a URL", () => {
    expect(() => resolveTestDatabaseUrl(env("not-a-url"))).toThrow(
      /not a valid URL/u,
    );
  });
});

describe("resolveTestDatabaseUrl cannot be talked past with parameters", () => {
  // The bypass that made the earlier version's "refuses remote hosts" claim
  // false: `pg` honours a `host` query parameter, so validating `URL.hostname`
  // and then handing over the original string checked one destination and
  // connected to another.
  it("refuses a connection string that smuggles a host parameter", () => {
    expect(() =>
      resolveTestDatabaseUrl(
        env(
          "postgres://u:p@127.0.0.1:5432/fitmind_migtest?host=ep-prod.neon.tech",
        ),
      ),
    ).toThrow(/query parameters/u);
  });

  it("refuses any query parameters at all", () => {
    expect(() =>
      resolveTestDatabaseUrl(
        env("postgres://u:p@127.0.0.1:5432/fitmind_migtest?sslmode=require"),
      ),
    ).toThrow(/query parameters/u);
  });

  // The structural guarantee behind the one above: callers get validated parts,
  // so there is no original string left for anything to override.
  it("returns parts rather than the string it was given", () => {
    const config = resolveTestDatabaseUrl(env(VALID));

    expect(config).not.toHaveProperty("connectionString");
    expect(config.host).toBe("127.0.0.1");
    expect(config.database).toBe("fitmind_migtest");
  });
});
