import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { classifyAssistantIntent } from "../src/services/assistant/assistant-intent-router.js";
import { retrieveKnowledgeChunks } from "../src/services/rag/knowledge-retriever.js";
import {
  evaluateRagCases,
  ragEvalCases,
} from "../src/services/rag/rag-eval.js";

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

    if (/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key) && process.env[key] === undefined) {
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

  return (first === `"` && last === `"`) || (first === "'" && last === "'")
    ? value.slice(1, -1)
    : value;
}

async function main(): Promise<void> {
  const envFileArg = process.argv[2];

  if (envFileArg !== undefined) {
    await loadEnvFile(resolve(process.cwd(), envFileArg));
    console.log("Env file loaded: yes");
  }

  const result = await evaluateRagCases(ragEvalCases, async (question) => {
    const intent = classifyAssistantIntent(question).intent;

    if (intent === "unsupported") {
      return [];
    }

    return retrieveKnowledgeChunks(question);
  });

  console.log(`RAG eval cases: ${result.total}`);

  if (!result.passed) {
    for (const failure of result.failures) {
      console.error(`RAG eval failure: ${failure}`);
    }

    process.exit(1);
  }

  console.log("RAG eval passed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`RAG eval failed: ${message}`);
  process.exit(1);
});
