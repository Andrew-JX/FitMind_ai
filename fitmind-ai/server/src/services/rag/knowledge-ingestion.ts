export interface KnowledgeFixtureDocument {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  chunks: string[];
}

export type KnowledgeFixtureFormat = "json" | "markdown";

interface RawKnowledgeFixtureDocument {
  slug?: unknown;
  title?: unknown;
  category?: unknown;
  tags?: unknown;
  chunks?: unknown;
  chunk_text?: unknown;
}

function ensureString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Knowledge fixture ${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  return [];
}

function normalizeChunks(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((chunk): chunk is string => typeof chunk === "string")
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }

  return [];
}

function parseJsonFixture(source: string): KnowledgeFixtureDocument[] {
  const parsed = JSON.parse(source) as
    | RawKnowledgeFixtureDocument[]
    | { documents?: RawKnowledgeFixtureDocument[] };
  const documents = Array.isArray(parsed) ? parsed : parsed.documents;

  if (!Array.isArray(documents)) {
    throw new Error("JSON knowledge fixture must contain documents.");
  }

  return documents.map((document) => {
    const chunks = normalizeChunks(document.chunks ?? document.chunk_text);

    if (chunks.length === 0) {
      throw new Error("Knowledge fixture chunks must not be empty.");
    }

    return {
      slug: ensureString(document.slug, "slug"),
      title: ensureString(document.title, "title"),
      category: ensureString(document.category, "category"),
      tags: normalizeTags(document.tags),
      chunks,
    };
  });
}

function parseFrontmatter(source: string): {
  metadata: Record<string, string>;
  body: string;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(source);

  if (match === null) {
    throw new Error("Markdown knowledge fixture requires frontmatter.");
  }

  const frontmatter = match[1];
  const body = match[2];

  if (frontmatter === undefined || body === undefined) {
    throw new Error("Markdown knowledge fixture requires frontmatter.");
  }

  const metadata: Record<string, string> = {};

  for (const rawLine of frontmatter.split(/\r?\n/u)) {
    const separatorIndex = rawLine.indexOf(":");

    if (separatorIndex <= 0) {
      continue;
    }

    metadata[rawLine.slice(0, separatorIndex).trim()] = rawLine
      .slice(separatorIndex + 1)
      .trim();
  }

  return {
    metadata,
    body,
  };
}

function parseMarkdownFixture(source: string): KnowledgeFixtureDocument[] {
  const { metadata, body } = parseFrontmatter(source);
  const chunks = body
    .split("<!-- chunk -->")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  if (chunks.length === 0) {
    throw new Error("Markdown knowledge fixture body must not be empty.");
  }

  return [
    {
      slug: ensureString(metadata.slug, "slug"),
      title: ensureString(metadata.title, "title"),
      category: ensureString(metadata.category, "category"),
      tags: normalizeTags(metadata.tags),
      chunks,
    },
  ];
}

export function parseKnowledgeFixture(
  source: string,
  format: KnowledgeFixtureFormat,
): KnowledgeFixtureDocument[] {
  return format === "json"
    ? parseJsonFixture(source)
    : parseMarkdownFixture(source);
}

export function buildKnowledgeSearchText(input: {
  title: string;
  category: string;
  chunk: string;
  tags: string[];
}): string {
  return [input.title, input.category, input.chunk, ...input.tags]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" ");
}
