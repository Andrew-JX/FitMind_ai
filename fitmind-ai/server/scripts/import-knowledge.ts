import { access, readFile, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import {
  upsertKnowledgeChunk,
  upsertKnowledgeDocument,
  updateKnowledgeChunkEmbedding,
} from "../src/db/knowledge-repository.js";
import {
  buildKnowledgeSearchText,
  parseKnowledgeFixture,
  type KnowledgeFixtureDocument,
  type KnowledgeFixtureFormat,
} from "../src/services/rag/knowledge-ingestion.js";
import {
  createVoyageEmbeddingProvider,
  EMBEDDING_MODEL,
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

function resolveFormat(filePath: string): KnowledgeFixtureFormat | null {
  const extension = extname(filePath).toLowerCase();

  if (extension === ".json") {
    return "json";
  }

  if (extension === ".md" || extension === ".markdown") {
    return "markdown";
  }

  return null;
}

async function listFixtureFiles(inputPath: string): Promise<string[]> {
  const entries = await readdir(inputPath, { withFileTypes: true }).catch(
    () => null,
  );

  if (entries === null) {
    return [inputPath];
  }

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(inputPath, entry.name))
    .filter((filePath) => resolveFormat(filePath) !== null)
    .sort();
}

async function readDocuments(inputPath: string): Promise<KnowledgeFixtureDocument[]> {
  const files = await listFixtureFiles(inputPath);
  const documents: KnowledgeFixtureDocument[] = [];

  for (const filePath of files) {
    const format = resolveFormat(filePath);

    if (format === null) {
      continue;
    }

    documents.push(...parseKnowledgeFixture(await readFile(filePath, "utf8"), format));
  }

  return documents;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const envFileArg = args[0]?.includes(".env") === true ? args.shift() : undefined;
  const fixtureArg = args[0];

  assert(fixtureArg !== undefined, "Knowledge fixture file or directory is required.");

  if (envFileArg !== undefined) {
    await loadEnvFile(resolve(process.cwd(), envFileArg));
    console.log("Env file loaded: yes");
  }

  assert(
    process.env.DATABASE_URL !== undefined &&
      process.env.DATABASE_URL.trim().length > 0,
    "DATABASE_URL is required for knowledge import.",
  );

  const documents = await readDocuments(resolve(process.cwd(), fixtureArg));
  const voyageApiKey = process.env.VOYAGE_API_KEY?.trim();
  const embeddingProvider =
    voyageApiKey === undefined || voyageApiKey.length === 0
      ? null
      : createVoyageEmbeddingProvider(voyageApiKey);
  let chunkCount = 0;
  let embeddedCount = 0;

  for (const document of documents) {
    const row = await upsertKnowledgeDocument({
      slug: document.slug,
      title: document.title,
      category: document.category,
      sourceType: "imported",
    });

    for (const [chunkIndex, chunk] of document.chunks.entries()) {
      const searchText = buildKnowledgeSearchText({
        title: document.title,
        category: document.category,
        tags: document.tags,
        chunk,
      });

      const chunkRow = await upsertKnowledgeChunk({
        documentId: row.id,
        chunkIndex,
        chunkText: chunk,
        tags: document.tags,
        searchText,
      });
      chunkCount += 1;

      if (embeddingProvider !== null) {
        const [embedding] = await embeddingProvider.embedDocuments([searchText]);

        await updateKnowledgeChunkEmbedding({
          id: chunkRow.id,
          embedding: embedding ?? [],
          model: EMBEDDING_MODEL,
        });
        embeddedCount += 1;
      }
    }
  }

  console.log("Knowledge import completed.");
  console.log(`Documents imported: ${documents.length}`);
  console.log(`Chunks imported: ${chunkCount}`);
  console.log(`Chunks embedded: ${embeddedCount}`);
  console.log(
    embeddingProvider === null
      ? "Embedding mode: skipped"
      : "Embedding mode: voyage",
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`Knowledge import failed: ${message}`);
  process.exit(1);
});
