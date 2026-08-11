import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverRoot = resolve(projectRoot, "server");
const scriptsConfigPath = resolve(serverRoot, "tsconfig.scripts.json");

interface PackageJson {
  scripts?: Record<string, string>;
}

function normalizePath(path: string): string {
  return resolve(path).replaceAll("\\", "/").toLowerCase();
}

async function readPackageJson(path: string): Promise<PackageJson> {
  return JSON.parse(await readFile(path, "utf8")) as PackageJson;
}

function parseScriptsConfig(): ts.ParsedCommandLine {
  const readResult = ts.readConfigFile(scriptsConfigPath, ts.sys.readFile);

  if (readResult.error !== undefined) {
    throw new Error(
      ts.formatDiagnostic(readResult.error, {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => serverRoot,
        getNewLine: () => "\n",
      }),
    );
  }

  const parsed = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    serverRoot,
    undefined,
    scriptsConfigPath,
  );

  if (parsed.errors.length > 0) {
    throw new Error(
      ts.formatDiagnostics(parsed.errors, {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => serverRoot,
        getNewLine: () => "\n",
      }),
    );
  }

  return parsed;
}

describe("server scripts TypeScript gate", () => {
  it("connects the scripts check to the server and root type-check commands", async () => {
    const [rootPackage, serverPackage] = await Promise.all([
      readPackageJson(resolve(projectRoot, "package.json")),
      readPackageJson(resolve(serverRoot, "package.json")),
    ]);

    expect(rootPackage.scripts?.["type-check"]).toBe(
      "pnpm --recursive --if-present run type-check",
    );
    expect(serverPackage.scripts?.["type-check"]).toBe(
      "pnpm run type-check:src && pnpm run type-check:scripts",
    );
    expect(serverPackage.scripts?.["type-check:src"]).toBe(
      "tsc -p tsconfig.json --noEmit",
    );
    expect(serverPackage.scripts?.["type-check:scripts"]).toBe(
      "tsc -p tsconfig.scripts.json",
    );
  });

  it("includes every TypeScript script and its imported source closure", async () => {
    const scriptPaths = (
      await readdir(resolve(serverRoot, "scripts"), { withFileTypes: true })
    )
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => normalizePath(resolve(serverRoot, "scripts", entry.name)))
      .sort();
    const parsed = parseScriptsConfig();
    const program = ts.createProgram({
      rootNames: parsed.fileNames,
      options: parsed.options,
    });
    const programPaths = new Set(
      program
        .getSourceFiles()
        .map((sourceFile) => normalizePath(sourceFile.fileName)),
    );

    expect(scriptPaths).not.toHaveLength(0);
    expect(scriptPaths.filter((path) => !programPaths.has(path))).toEqual([]);
    expect(
      programPaths.has(normalizePath(resolve(serverRoot, "src/db/pool.ts"))),
    ).toBe(true);
  });

  it("inherits strict no-emit settings without changing the production graph", async () => {
    const parsed = parseScriptsConfig();
    const productionConfig = JSON.parse(
      await readFile(resolve(serverRoot, "tsconfig.json"), "utf8"),
    ) as {
      compilerOptions?: Record<string, unknown>;
      include?: string[];
    };
    const serverPackage = await readPackageJson(
      resolve(serverRoot, "package.json"),
    );

    expect(parsed.options.noEmit).toBe(true);
    expect(parsed.options.strict).toBe(true);
    expect(parsed.options.noUncheckedIndexedAccess).toBe(true);
    expect(productionConfig.compilerOptions?.rootDir).toBe("src");
    expect(productionConfig.compilerOptions?.outDir).toBe("dist");
    expect(productionConfig.include).toEqual(["src/**/*.ts"]);
    expect(serverPackage.scripts?.build).toBe(
      "tsc -p tsconfig.json --noEmit false && node scripts/copy-runtime-js.mjs",
    );
  });
});
