import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const routesDir = dirname(fileURLToPath(import.meta.url));
const contractPath = join(routesDir, "../../../docs/api-contract.md");

/** Health check; infrastructure rather than part of the product contract. */
const UNDOCUMENTED_BY_DESIGN = new Set(["GET /"]);

/**
 * Reads every route the Express routers actually register.
 *
 * @returns Canonical `METHOD /path` strings, with the mount prefix applied
 */
function readRegisteredRoutes(): string[] {
  const routes = new Set<string>();

  for (const file of readdirSync(routesDir)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) {
      continue;
    }

    const source = readFileSync(join(routesDir, file), "utf8");
    // Named routers register absolute paths. auth.ts builds a bare `router`
    // that app.ts mounts under /api/auth, so its paths need that prefix.
    const namedRouter =
      /(\w+Router)\.(get|post|patch|put|delete)\(\s*"([^"]+)"/g;
    const authRouter = /\brouter\.(get|post|patch|put|delete)\(\s*"([^"]+)"/g;
    let match: RegExpExecArray | null;

    while ((match = namedRouter.exec(source)) !== null) {
      routes.add(`${match[2]!.toUpperCase()} ${match[3]!}`);
    }

    while ((match = authRouter.exec(source)) !== null) {
      routes.add(`${match[1]!.toUpperCase()} /auth${match[2]!}`);
    }
  }

  return [...routes].filter((route) => !UNDOCUMENTED_BY_DESIGN.has(route));
}

/**
 * Reads the endpoints `api-contract.md` claims to describe.
 *
 * @returns Canonical `METHOD /path` strings, `{id}` normalized to `:id`
 */
function readDocumentedRoutes(): Set<string> {
  const contract = readFileSync(contractPath, "utf8");
  const documented = new Set<string>();
  const pattern =
    /\b(GET|POST|PATCH|PUT|DELETE)\s+(?:\/api)?(\/[A-Za-z0-9_\-/:{}]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(contract)) !== null) {
    const path = match[2]!.replace(/\{(\w+)\}/g, ":$1").replace(/\/$/, "");
    documented.add(`${match[1]!} ${path}`);
  }

  return documented;
}

describe("api-contract.md stays in sync with the routers", () => {
  const registered = readRegisteredRoutes();
  const documented = readDocumentedRoutes();

  it("finds the routers and the document", () => {
    expect(registered.length).toBeGreaterThan(30);
    expect(documented.size).toBeGreaterThan(30);
  });

  it("documents every registered route", () => {
    const missing = registered.filter((route) => !documented.has(route));

    expect(
      missing,
      `missing from docs/api-contract.md: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("describes no endpoint the server does not serve", () => {
    // A contract that advertises routes nobody implements sends readers at
    // 404s; this is the failure mode that let /api/chat and /api/analytics/*
    // survive in the document long after they were superseded.
    const registeredSet = new Set(registered);
    const ghosts = [...documented].filter((route) => !registeredSet.has(route));

    expect(
      ghosts,
      `documented but not registered: ${ghosts.join(", ")}`,
    ).toEqual([]);
  });
});
