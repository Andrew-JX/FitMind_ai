import { describe, expect, it, vi } from "vitest";

import {
  createUserWithConsents,
  recordUserConsent,
} from "./user-consent-repository.js";

const userRow = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "user@example.com",
  passwordHash: "stored-hash",
  displayName: "Andrew",
  createdAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",
};

const consent = {
  consentType: "cross_border_transfer" as const,
  policyVersion: "2026-08-04",
  source: "registration" as const,
};

/**
 * A pool that records the statements it is given, so the test can assert on
 * transaction control rather than on the repository's return value. `failOn`
 * makes one statement throw, standing in for a constraint violation.
 */
function createFakePool(options?: { failOn?: string }) {
  const statements: string[] = [];

  const client = {
    query: vi.fn(async (sql: string) => {
      statements.push(sql.trim().split(/\s+/).slice(0, 2).join(" "));

      if (options?.failOn !== undefined && sql.includes(options.failOn)) {
        throw new Error(`simulated failure on ${options.failOn}`);
      }

      return { rows: sql.includes("INSERT INTO users") ? [userRow] : [] };
    }),
    release: vi.fn(),
  };

  return {
    pool: {
      query: vi.fn(async () => ({ rows: [] })),
      connect: vi.fn(async () => client),
    },
    client,
    statements,
  };
}

describe("createUserWithConsents", () => {
  it("commits the user and consent together", async () => {
    const { pool, statements } = createFakePool();

    const created = await createUserWithConsents(
      {
        email: userRow.email,
        passwordHash: userRow.passwordHash,
        displayName: "Andrew",
        consents: [consent],
      },
      pool,
    );

    expect(created).toEqual(userRow);
    expect(statements).toEqual([
      "BEGIN",
      "INSERT INTO",
      "INSERT INTO",
      "COMMIT",
    ]);
  });

  // The failure this exists to prevent: the account row lands, the consent row
  // does not, and nothing looks wrong — the user is signed in and the app
  // behaves normally, while the only evidence that creating the account was
  // permitted is missing. It has to be all or nothing.
  it("rolls the user back when the consent write fails", async () => {
    const { pool, statements, client } = createFakePool({
      failOn: "INSERT INTO user_consents",
    });

    await expect(
      createUserWithConsents(
        {
          email: userRow.email,
          passwordHash: userRow.passwordHash,
          consents: [consent],
        },
        pool,
      ),
    ).rejects.toThrow("simulated failure");

    expect(statements).toEqual([
      "BEGIN",
      "INSERT INTO",
      "INSERT INTO",
      "ROLLBACK",
    ]);
    expect(statements).not.toContain("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  it("releases the connection after a successful commit", async () => {
    const { pool, client } = createFakePool();

    await createUserWithConsents(
      {
        email: userRow.email,
        passwordHash: userRow.passwordHash,
        consents: [consent],
      },
      pool,
    );

    expect(client.release).toHaveBeenCalledTimes(1);
  });

  // A queryable-only stub would run both inserts outside any transaction while
  // every assertion above still passed, which is precisely the silent
  // degradation this function exists to rule out.
  it("refuses a pool that cannot open a transaction", async () => {
    const nonTransactional = { query: vi.fn(async () => ({ rows: [] })) };

    await expect(
      createUserWithConsents(
        {
          email: userRow.email,
          passwordHash: userRow.passwordHash,
          consents: [consent],
        },
        nonTransactional,
      ),
    ).rejects.toThrow("transactional pool");

    expect(nonTransactional.query).not.toHaveBeenCalled();
  });
});

describe("recordUserConsent keeps consent history append-only", () => {
  async function capture() {
    const statements: string[] = [];
    const pool = {
      query: vi.fn(async (sql: string) => {
        statements.push(sql);
        return { rows: [{ id: "c1" }] };
      }),
    };

    await recordUserConsent(
      { userId: userRow.id, ...consent, source: "consent_catchup" },
      pool,
    );

    return statements.join("\n");
  }

  // Conflicts are resolved against the *partial* index over live rows. With a
  // full unique constraint, grant → revoke → grant had to reuse one row, so the
  // second grant overwrote when the first was given and erased the withdrawal
  // outright — leaving a table that cannot answer the only question it exists
  // for: was this processing permitted at time T.
  it("targets only live rows when resolving a conflict", async () => {
    expect(await capture()).toContain("WHERE revoked_at IS NULL");
  });

  // Re-submitting a live consent must not restamp it: that would overwrite when
  // they agreed with when they last loaded the page.
  it("never restamps accepted_at or reopens a revoked row", async () => {
    const sql = await capture();

    expect(sql).not.toContain("accepted_at = now()");
    expect(sql).not.toContain("revoked_at = NULL");
  });
});
