import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  listKnowledgeChunksMissingEmbeddings,
  updateKnowledgeChunkEmbedding,
  type KnowledgeChunkRow,
} from "../src/db/knowledge-repository.js";
import { loadServerEnv } from "../src/env.js";
import {
  EMBEDDING_MODEL,
  createVoyageEmbeddingProvider,
} from "../src/services/rag/voyage-embedding-client.js";

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

  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}

function buildEmbeddingDocument(chunk: KnowledgeChunkRow): string {
  return [chunk.title, chunk.category, chunk.chunk_text, ...chunk.tags].join(
    " ",
  );
}

async function main(): Promise<void> {
  const envFileArg = process.argv[2];

  if (envFileArg !== undefined) {
    await loadEnvFile(resolve(process.cwd(), envFileArg));
    console.log("Env file loaded: yes");
  }

  const env = loadServerEnv();

  assert(
    env.databaseUrl !== undefined && env.databaseUrl.trim().length > 0,
    "DATABASE_URL is required for knowledge embedding backfill.",
  );
  assert(
    env.voyageApiKey !== undefined && env.voyageApiKey.trim().length > 0,
    "VOYAGE_API_KEY is required for knowledge embedding backfill.",
  );

  const chunks = await listKnowledgeChunksMissingEmbeddings({
    model: EMBEDDING_MODEL,
  });

  if (chunks.length === 0) {
    console.log("Knowledge chunk embeddings already up to date.");
    return;
  }

  const provider = createVoyageEmbeddingProvider(env.voyageApiKey);
  const embeddings = await provider.embedDocuments(
    chunks.map(buildEmbeddingDocument),
  );

  for (const [index, chunk] of chunks.entries()) {
    const embedding = embeddings[index];

    assert(embedding !== undefined, `Missing embedding for chunk ${chunk.id}.`);

    await updateKnowledgeChunkEmbedding({
      id: chunk.id,
      embedding,
      model: EMBEDDING_MODEL,
    });
  }

  console.log(`Knowledge chunk embeddings updated: ${chunks.length}`);
  console.log(`Embedding model: ${EMBEDDING_MODEL}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`Knowledge embedding backfill failed: ${message}`);
  process.exit(1);
});
