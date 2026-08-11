import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const agentsPath = resolve(projectRoot, "AGENTS.md");
const smokeChecklistPath = resolve(
  projectRoot,
  "docs/production-smoke-checklist.md",
);

const architectureManifestPattern =
  /<!-- architecture-manifest:start -->([\s\S]*?)<!-- architecture-manifest:end -->/u;
const documentedDirectoryPattern = /`([^`]+\/)`/gu;
const productionSourcePattern = /\.(?:js|ts|tsx)$/u;
const nonProductionSourcePattern = /(?:\.d|\.test)\.tsx?$/u;

interface ResolvedArea {
  path: string;
  exists: boolean;
  productionFiles: string[];
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function extractDocumentedDirectories(source: string): string[] {
  const manifest = architectureManifestPattern.exec(source)?.[1];
  if (manifest === undefined) {
    throw new Error("AGENTS.md is missing the architecture manifest markers.");
  }

  return [...manifest.matchAll(documentedDirectoryPattern)].map(
    (match) => match[1] ?? "",
  );
}

async function findProductionFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = resolve(directory, entry.name);

      if (entry.isDirectory()) {
        return await findProductionFiles(absolutePath);
      }

      if (
        entry.isFile() &&
        productionSourcePattern.test(entry.name) &&
        !nonProductionSourcePattern.test(entry.name)
      ) {
        return [absolutePath];
      }

      return [];
    }),
  );

  return nested.flat();
}

async function resolveDocumentedArea(path: string): Promise<ResolvedArea> {
  const absolutePath = resolve(projectRoot, path);

  try {
    if (!(await stat(absolutePath)).isDirectory()) {
      return { path, exists: false, productionFiles: [] };
    }
  } catch {
    return { path, exists: false, productionFiles: [] };
  }

  return {
    path,
    exists: true,
    productionFiles: await findProductionFiles(absolutePath),
  };
}

function validateResolvedAreas(areas: ResolvedArea[]): string[] {
  return areas.flatMap((area) => {
    if (!area.exists) {
      return [`${area.path}: directory does not exist`];
    }

    if (area.productionFiles.length === 0) {
      return [`${area.path}: directory has no production source`];
    }

    return [];
  });
}

async function findTrainingAssistantImporters(): Promise<string[]> {
  const trainingRoot = resolve(projectRoot, "server/src/services/training");
  const files = await findProductionFiles(trainingRoot);
  const importPattern = /(?:from\s+|import\s*\(\s*)["']\.\.\/assistant\//u;
  const importers: string[] = [];

  for (const file of files) {
    if (importPattern.test(await readFile(file, "utf8"))) {
      importers.push(normalizePath(relative(projectRoot, file)));
    }
  }

  return importers.sort();
}

function findUnexpectedImporters(importers: string[]): string[] {
  return [...importers].sort();
}

describe("executable repository governance", () => {
  it("keeps every documented architecture area backed by production source", async () => {
    const agents = await readFile(agentsPath, "utf8");
    const directories = extractDocumentedDirectories(agents);
    const resolved = await Promise.all(
      directories.map(async (path) => await resolveDocumentedArea(path)),
    );

    expect(directories.length).toBeGreaterThan(0);
    expect(validateResolvedAreas(resolved)).toEqual([]);
  });

  it("rejects phantom and empty architecture entries in memory", async () => {
    const agents = await readFile(agentsPath, "utf8");
    const withPhantom = agents.replace(
      "<!-- architecture-manifest:end -->",
      "- `client/src/store/` — synthetic phantom\n\n<!-- architecture-manifest:end -->",
    );
    const phantom = await resolveDocumentedArea(
      extractDocumentedDirectories(withPhantom).at(-1) ?? "",
    );

    expect(validateResolvedAreas([phantom])).toEqual([
      "client/src/store/: directory does not exist",
    ]);
    expect(
      validateResolvedAreas([
        { path: "synthetic/empty/", exists: true, productionFiles: [] },
      ]),
    ).toEqual(["synthetic/empty/: directory has no production source"]);
  });

  it("does not retain the old phantom map or unenforced absolute rules", async () => {
    const agents = await readFile(agentsPath, "utf8");
    const staleClaims = [
      "client/src/store/",
      "client/src/hooks/",
      "client/src/types/",
      "client/src/utils/",
      "client/src/constants/",
      "server/src/services/analytics/",
      "controllers/` 必须薄（< 30 行）",
      "所有公开函数必须有 JSDoc",
      "一次改动不超过 5 个文件",
    ];

    for (const claim of staleClaims) {
      expect(agents).not.toContain(claim);
    }
  });

  it("rejects every production training-to-assistant import", async () => {
    const agents = await readFile(agentsPath, "utf8");
    const importers = await findTrainingAssistantImporters();

    expect(importers).toEqual([]);
    expect(findUnexpectedImporters(importers)).toEqual([]);
    expect(
      findUnexpectedImporters([
        "server/src/services/training/synthetic-third-importer.ts",
      ]),
    ).toEqual(["server/src/services/training/synthetic-third-importer.ts"]);

    expect(agents).toContain("server/src/services/ai/");
    expect(agents).toContain("production training 不得导入 `../assistant/`");
    expect(agents).not.toContain("training-assistant-allowlist");
    expect(agents).not.toContain(
      "server/src/services/training/workout-intake-llm-parser.ts",
    );
    expect(agents).not.toContain(
      "server/src/services/training/assistant-insights-service.ts",
    );
    expect(agents).not.toContain("结构债 4.2");
  });

  it("pins migration compatibility and destructive-release questions", async () => {
    const [agents, checklist] = await Promise.all([
      readFile(agentsPath, "utf8"),
      readFile(smokeChecklistPath, "utf8"),
    ]);

    expect(agents).toContain("<!-- migration-compatibility-rule -->");
    expect(agents).toContain("每个新 migration 必须与上一个应用版本向后兼容");
    expect(agents).toContain("已应用 migration 不重写");
    expect(checklist).toContain("<!-- destructive-migration-check:start -->");
    expect(checklist).toContain("本次发布是否包含破坏性 schema 变更");
    expect(checklist).toContain("旧镜像能否继续运行");
    expect(checklist).toContain("回滚或分阶段前滚方案");
  });
});
