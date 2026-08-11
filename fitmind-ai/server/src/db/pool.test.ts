import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

const pgMock = vi.hoisted(() => {
  const end = vi.fn(async () => undefined);
  const query = vi.fn(async () => ({ rows: [] }));
  const connect = vi.fn(async () => ({ query, release: vi.fn() }));
  const on = vi.fn();
  const Pool = vi.fn(function MockPool() {
    return { end, query, connect, on };
  });

  return { Pool, connect, end, on, query };
});

vi.mock("node:module", () => ({
  createRequire: () => (specifier: string) => {
    if (specifier !== "pg") {
      throw new Error(`Unexpected test require: ${specifier}`);
    }

    return { Pool: pgMock.Pool };
  },
}));

vi.mock("../env.js", () => ({
  loadServerEnv: () => ({ databaseUrl: "postgresql://test.invalid/fitmind" }),
}));

import { closeDbPool, createDbPool, createDbPoolIdleErrorLog } from "./pool.js";

afterEach(async () => {
  await closeDbPool();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("process database pool", () => {
  it("constructs one bounded pool and returns one stable facade", () => {
    const first = createDbPool();
    const second = createDbPool();

    expect(first).toBe(second);
    expect(pgMock.Pool).toHaveBeenCalledTimes(1);
    expect(pgMock.Pool).toHaveBeenCalledWith({
      connectionString: "postgresql://test.invalid/fitmind",
      max: 10,
      allowExitOnIdle: true,
    });
    expect(pgMock.on).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("keeps repository end as a no-op and reserves draining for closeDbPool", async () => {
    const facade = createDbPool();

    await facade.end();
    expect(pgMock.end).not.toHaveBeenCalled();

    await closeDbPool();
    await closeDbPool();
    expect(pgMock.end).toHaveBeenCalledTimes(1);

    const rebuilt = createDbPool();
    expect(rebuilt).toBe(facade);
    expect(pgMock.Pool).toHaveBeenCalledTimes(2);
  });

  it("logs an idle error without message, stack, connection string, or SQL", () => {
    const secret = "postgresql://secret:password@example.invalid/db";
    const error = Object.assign(new Error(`${secret} SELECT * FROM users`), {
      code: "ECONNRESET",
      name: "DatabaseError",
      stack: `STACK ${secret}`,
    });
    const payload = createDbPoolIdleErrorLog(error);
    const serialized = JSON.stringify(payload);
    const errorLogger = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    createDbPool();
    const idleErrorListener = pgMock.on.mock.calls[0]?.[1] as
      | ((caught: unknown) => void)
      | undefined;
    idleErrorListener?.(error);

    expect(payload).toEqual({
      event: "db_pool_idle_error",
      errorType: "ERROR",
      errorCode: "ECONNRESET",
    });
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("SELECT");
    expect(serialized).not.toContain("message");
    expect(serialized).not.toContain("stack");
    expect(idleErrorListener).toBeTypeOf("function");
    expect(errorLogger).toHaveBeenCalledWith(serialized);
  });
});

function listProductionDbSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return listProductionDbSources(path);
    }

    return /\.(?:ts|js)$/.test(entry.name) && !entry.name.includes(".test.")
      ? [path]
      : [];
  });
}

describe("database pool source inventory", () => {
  it("rejects duplicate pg constructors and repository-local pool helpers", () => {
    const dbDirectory = dirname(fileURLToPath(import.meta.url));
    const sources = listProductionDbSources(dbDirectory).map((path) => ({
      path,
      source: readFileSync(path, "utf8"),
    }));
    const constructorOwners = sources
      .filter(({ source }) => /\bnew\s+Pool\s*\(/.test(source))
      .map(({ path }) =>
        path.slice(dbDirectory.length + 1).replaceAll("\\", "/"),
      );
    const pgRequireOwners = sources
      .filter(({ source }) => /require\(["']pg["']\)/.test(source))
      .map(({ path }) =>
        path.slice(dbDirectory.length + 1).replaceAll("\\", "/"),
      );
    const sharedFactoryConsumers = sources
      .filter(
        ({ path, source }) =>
          !path.endsWith("pool.ts") && source.includes("createDbPool()"),
      )
      .map(({ path }) =>
        path.slice(dbDirectory.length + 1).replaceAll("\\", "/"),
      )
      .sort();

    expect(constructorOwners).toEqual(["pool.ts"]);
    expect(pgRequireOwners).toEqual(["pool.ts"]);
    expect(sharedFactoryConsumers).toEqual([
      "assistant-saved-insights-repository.ts",
      "athlete-profile-repository.ts",
      "chat-repository.ts",
      "exercise-progress-repository.ts",
      "knowledge-repository.ts",
      "muscle-load-repository.ts",
      "personal-tools-repository.ts",
      "planned-workout-repository.ts",
      "product-feedback-repository.ts",
      "recommendation-context-repository.ts",
      "repositories/exercises-repository.ts",
      "repositories/muscle-groups-repository.ts",
      "repositories/users-repository.ts",
      "repositories/workouts-repository.ts",
      "tool-call-log-repository.ts",
      "training-summary-repository.ts",
      "user-consent-repository.ts",
      "user-health-data-repository.ts",
      "weekly-report-digest-repository.ts",
    ]);
    expect(
      sources.some(({ source }) => source.includes("createRepositoryPool")),
    ).toBe(false);
  });
});
