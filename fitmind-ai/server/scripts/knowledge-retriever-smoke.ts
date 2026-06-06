import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { retrieveKnowledgeChunks } from "../src/services/rag/knowledge-retriever.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadEnvFile(filePath: string): Promise<void> {
  await access(filePath);

  const source = await readFile(filePath, "utf8");

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
      continue;
    }

    if (process.env[key] === undefined) {
      process.env[key] = unquoteEnvValue(value);
    }
  }
}

function unquoteEnvValue(value: string): string {
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];

  if (
    (first === '"' && last === '"') ||
    (first === "'" && last === "'")
  ) {
    return value.slice(1, -1);
  }

  return value;
}

async function main(): Promise<void> {
  const envFileArg = process.argv[2];

  if (envFileArg !== undefined) {
    await loadEnvFile(resolve(process.cwd(), envFileArg));
    console.log("Env file loaded: yes");
  }

  assert(
    process.env.DATABASE_URL !== undefined &&
      process.env.DATABASE_URL.trim().length > 0,
    "DATABASE_URL is required for DB-backed knowledge retriever smoke.",
  );

  const sources = await retrieveKnowledgeChunks("RPE 是什么？");

  assert(sources.length > 0, "Expected at least one RPE knowledge source.");
  assert(
    sources[0]?.title !== undefined && sources[0].title.length > 0,
    "Expected first source title.",
  );
  assert(
    sources[0]?.category !== undefined && sources[0].category.length > 0,
    "Expected first source category.",
  );
  assert(
    sources[0]?.chunk_text !== undefined && sources[0].chunk_text.length > 0,
    "Expected first source chunk text.",
  );

  console.log("DB-backed knowledge retriever smoke passed.");
  console.log(`Sources returned: ${sources.length}`);
  console.log(`Top source: ${sources[0].title}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`DB-backed knowledge retriever smoke failed: ${message}`);
  process.exit(1);
});
