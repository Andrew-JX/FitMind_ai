import { describe, expect, it, vi } from "vitest";

import {
  saveProfileWithHealthConsent,
  withdrawSensitiveHealthData,
} from "./user-health-data-repository.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const POLICY = "2026-08-07";

const profileRow = {
  user_id: USER_ID,
  goal: "strength",
  weekly_days: 3,
  available_equipment: [],
  injury_constraints: ["knee"],
  created_at: "2026-08-04T00:00:00.000Z",
  updated_at: "2026-08-04T00:00:00.000Z",
};

interface FakePoolOptions {
  /** Rows the `FOR UPDATE` lock query returns; empty means no such user. */
  lockRows?: unknown[];
  /** Rows the live-consent probe returns; empty means no live consent. */
  liveConsentRows?: unknown[];
  failOn?: string;
}

/**
 * Records the statements issued on the transaction's client, so the tests can
 * assert on the protocol — lock first, everything on one client — rather than
 * on return values.
 */
function createFakePool(options?: FakePoolOptions) {
  const statements: string[] = [];

  const client = {
    query: vi.fn(async (sql: string) => {
      const trimmed = sql.trim();
      statements.push(trimmed.split(/\s+/).slice(0, 2).join(" "));

      if (options?.failOn !== undefined && sql.includes(options.failOn)) {
        throw new Error(`simulated failure on ${options.failOn}`);
      }

      if (sql.includes("FOR UPDATE")) {
        return { rows: options?.lockRows ?? [{ id: USER_ID }] };
      }

      if (sql.includes("SELECT 1 FROM user_consents")) {
        return { rows: options?.liveConsentRows ?? [] };
      }

      if (sql.includes("INSERT INTO athlete_profiles")) {
        return { rows: [profileRow] };
      }

      return { rows: [] };
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

function saveInput(overrides?: Record<string, unknown>) {
  return {
    userId: USER_ID,
    goal: "strength",
    weeklyDays: 3,
    availableEquipment: [],
    injuryConstraints: ["knee"],
    policyVersion: POLICY,
    consentDecision: { accepted: true, policy_version: POLICY },
    ...overrides,
  };
}

describe("the shared per-user lock", () => {
  // The whole point of fitmind-9yz. Both mutations take the same lock, first,
  // and hold it across the consent decision and the write. A transaction alone
  // does not help: under READ COMMITTED a save can read "consent is live", a
  // withdrawal can commit in the gap, and the save then writes injury data back
  // — both transactions atomic, the combined result invalid.
  it("is taken before a profile save reads consent", async () => {
    const { pool, statements } = createFakePool();

    await saveProfileWithHealthConsent(saveInput(), pool);

    expect(statements[0]).toBe("BEGIN");
    expect(statements[1]).toBe("SELECT id");
    expect(statements.at(-1)).toBe("COMMIT");
  });

  it("is taken before a withdrawal touches anything", async () => {
    const { pool, statements } = createFakePool();

    await withdrawSensitiveHealthData(USER_ID, pool);

    expect(statements).toEqual([
      "BEGIN",
      "SELECT id",
      "UPDATE athlete_profiles",
      "UPDATE user_consents",
      "COMMIT",
    ]);
  });

  it("uses one client for every statement in a save", async () => {
    const { pool, client } = createFakePool();

    await saveProfileWithHealthConsent(saveInput(), pool);

    // Nothing went out through the pool directly, which would have been a
    // second connection outside the transaction.
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls.length).toBeGreaterThan(3);
  });

  // `FOR UPDATE` matching zero rows locks nothing. Continuing would silently
  // run the whole mutation unserialized — exactly the bug being fixed.
  it("fails rather than proceeding when there is no user row to lock", async () => {
    const { pool, statements } = createFakePool({ lockRows: [] });

    await expect(
      saveProfileWithHealthConsent(saveInput(), pool),
    ).rejects.toThrow(/nothing to lock/u);

    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
  });

  it("refuses a pool that cannot open a transaction", async () => {
    const nonTransactional = { query: vi.fn(async () => ({ rows: [] })) };

    await expect(
      saveProfileWithHealthConsent(saveInput(), nonTransactional),
    ).rejects.toThrow(/transactional pool/u);

    expect(nonTransactional.query).not.toHaveBeenCalled();
  });
});

describe("saveProfileWithHealthConsent", () => {
  // The recheck that makes a save started before a withdrawal still see it:
  // consent is read inside the lock, not trusted from earlier in the request.
  it("reads consent inside the lock, after acquiring it", async () => {
    const { pool, statements } = createFakePool();

    await saveProfileWithHealthConsent(saveInput(), pool);

    const lockIndex = statements.indexOf("SELECT id");
    const consentIndex = statements.indexOf("SELECT 1");

    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(consentIndex).toBeGreaterThan(lockIndex);
  });

  it("records the consent and the profile in the same transaction", async () => {
    const { pool, statements } = createFakePool();

    await saveProfileWithHealthConsent(saveInput(), pool);

    expect(statements).toContain("INSERT INTO");
    expect(statements.at(-1)).toBe("COMMIT");
  });

  it("does not re-record a consent that is already live", async () => {
    const { pool, client } = createFakePool({
      liveConsentRows: [{ "?column?": 1 }],
    });

    await saveProfileWithHealthConsent(saveInput(), pool);

    const consentInsert = client.query.mock.calls
      .map(([sql]) => sql)
      .find((sql) => sql.includes("INSERT INTO user_consents"));

    expect(consentInsert).toBeUndefined();
  });

  it("refuses without writing when no consent is on file or supplied", async () => {
    const { pool, client } = createFakePool();

    const result = await saveProfileWithHealthConsent(
      saveInput({ consentDecision: undefined }),
      pool,
    );

    expect(result.status).toBe("consent_missing");

    const profileWrite = client.query.mock.calls
      .map(([sql]) => sql)
      .find((sql) => sql.includes("INSERT INTO athlete_profiles"));

    expect(profileWrite).toBeUndefined();
  });

  it("refuses a consent given for a superseded policy version", async () => {
    const { pool } = createFakePool();

    const result = await saveProfileWithHealthConsent(
      saveInput({
        consentDecision: { accepted: true, policy_version: "2026-01-01" },
      }),
      pool,
    );

    expect(result.status).toBe("consent_stale");
  });

  // Nothing sensitive is being stored, so there is nothing to *ask* about.
  // Demanding consent here would be asking about something not happening.
  it("asks for no consent when no injuries are stored", async () => {
    const { pool, client } = createFakePool();

    const result = await saveProfileWithHealthConsent(
      saveInput({ injuryConstraints: [], consentDecision: undefined }),
      pool,
    );

    expect(result.status).toBe("saved");

    const consentRead = client.query.mock.calls
      .map(([sql]) => sql)
      .find((sql) => sql.includes("SELECT 1 FROM user_consents"));

    expect(consentRead).toBeUndefined();
  });
});

// fitmind-lmy. Clearing the field and pressing Save is what a user reads as
// "stop keeping this". Treating it as an ordinary upsert left the consent live,
// so the next injury they typed was stored without asking — a withdrawal that
// undid itself. The two entry points now mean the same thing.
describe("clearing the injury list through a profile save", () => {
  function emptySave(overrides?: Record<string, unknown>) {
    return saveInput({
      injuryConstraints: [],
      consentDecision: undefined,
      ...overrides,
    });
  }

  function consentUpdatesFrom(client: {
    query: { mock: { calls: unknown[][] } };
  }) {
    return client.query.mock.calls
      .map(([sql]) => sql as string)
      .filter((sql) => sql.includes("UPDATE user_consents"));
  }

  it("revokes the live health consent in the same transaction", async () => {
    const { pool, statements, client } = createFakePool({
      liveConsentRows: [{ id: "consent-1" }],
    });

    const result = await saveProfileWithHealthConsent(emptySave(), pool);

    expect(result.status).toBe("saved");
    expect(statements).toEqual([
      "BEGIN",
      "SELECT id",
      "INSERT INTO",
      "UPDATE user_consents",
      "COMMIT",
    ]);
    expect(consentUpdatesFrom(client)).toHaveLength(1);
  });

  // The user is withdrawing the category, not one wording of it. A live row
  // under a superseded version would be found by the next save's recheck and
  // would let injury data be stored without asking again.
  it("revokes every live health consent regardless of policy version", async () => {
    const { pool, client } = createFakePool();

    await saveProfileWithHealthConsent(emptySave(), pool);

    const [revocation] = consentUpdatesFrom(client);

    expect(revocation).toContain("revoked_at IS NULL");
    expect(revocation).not.toMatch(/policy_version/u);
  });

  // Scope check: withdrawing health data must not cancel the consent that lets
  // the account exist at all.
  it("leaves other consent types alone", async () => {
    const { pool, client } = createFakePool();

    await saveProfileWithHealthConsent(emptySave(), pool);

    const [revocation] = consentUpdatesFrom(client);

    expect(revocation).toContain("consent_type = 'sensitive_health_data'");
    expect(revocation).not.toMatch(/cross_border_transfer/u);
  });

  // Idempotent, and specifically not re-stamping: `revoked_at IS NULL` means a
  // second empty save cannot rewrite *when* the withdrawal happened, which is
  // the fact the row exists to record.
  it("records nothing new when the profile is already empty", async () => {
    const { pool, client } = createFakePool();

    const result = await saveProfileWithHealthConsent(emptySave(), pool);

    expect(result.status).toBe("saved");

    const consentInsert = client.query.mock.calls
      .map(([sql]) => sql)
      .find((sql) => sql.includes("INSERT INTO user_consents"));

    expect(consentInsert).toBeUndefined();
    expect(consentUpdatesFrom(client)[0]).toContain("revoked_at IS NULL");
  });

  // The other side of the same transaction. Asserted separately because the two
  // failures leave different halves half-done if the boundary is wrong: this
  // one must not revoke a consent for data that is still stored.
  it("revokes nothing when the profile write fails", async () => {
    const { pool, statements, client } = createFakePool({
      failOn: "INSERT INTO athlete_profiles",
    });

    await expect(
      saveProfileWithHealthConsent(emptySave(), pool),
    ).rejects.toThrow(/simulated failure/u);

    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
    expect(consentUpdatesFrom(client)).toHaveLength(0);
  });

  it("rolls the cleared profile back when the revocation fails", async () => {
    const { pool, statements, client } = createFakePool({
      failOn: "UPDATE user_consents",
    });

    await expect(
      saveProfileWithHealthConsent(emptySave(), pool),
    ).rejects.toThrow(/simulated failure/u);

    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  // Acceptance 5, pinned as a fact rather than as a promise in a comment: the
  // explicit endpoint and the empty save must issue the *same* statement. Two
  // implementations that merely agree today are two implementations that can
  // stop agreeing.
  it("issues the identical revocation the explicit withdrawal issues", async () => {
    const viaSave = createFakePool();
    const viaDelete = createFakePool();

    await saveProfileWithHealthConsent(emptySave(), viaSave.pool);
    await withdrawSensitiveHealthData(USER_ID, viaDelete.pool);

    expect(consentUpdatesFrom(viaSave.client)[0]).toBe(
      consentUpdatesFrom(viaDelete.client)[0],
    );
  });

  it("stays on the locked client, opening no second connection", async () => {
    const { pool, client } = createFakePool();

    await saveProfileWithHealthConsent(emptySave(), pool);

    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("rolls back the new consent when the profile write fails", async () => {
    const { pool, statements, client } = createFakePool({
      failOn: "INSERT INTO athlete_profiles",
    });

    await expect(
      saveProfileWithHealthConsent(saveInput(), pool),
    ).rejects.toThrow(/simulated failure/u);

    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });
});

describe("withdrawSensitiveHealthData", () => {
  it("rolls back both tables when closing the consent fails", async () => {
    const { pool, statements, client } = createFakePool({
      failOn: "UPDATE user_consents",
    });

    await expect(withdrawSensitiveHealthData(USER_ID, pool)).rejects.toThrow(
      /simulated failure/u,
    );

    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  it("only closes consents that are still live", async () => {
    const { pool, client } = createFakePool();

    await withdrawSensitiveHealthData(USER_ID, pool);

    const consentUpdate = client.query.mock.calls
      .map(([sql]) => sql)
      .find((sql) => sql.includes("UPDATE user_consents"));

    expect(consentUpdate).toContain("revoked_at IS NULL");
    expect(consentUpdate).toContain("'sensitive_health_data'");
  });

  it("refuses a pool that cannot open a transaction", async () => {
    const nonTransactional = { query: vi.fn(async () => ({ rows: [] })) };

    await expect(
      withdrawSensitiveHealthData(USER_ID, nonTransactional),
    ).rejects.toThrow(/transactional pool/u);

    expect(nonTransactional.query).not.toHaveBeenCalled();
  });
});
