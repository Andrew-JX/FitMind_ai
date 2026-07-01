// Historical name: this module now owns the in-process Voyage RAG client surface
// for both embeddings and reranking so callers still depend on one provider seam.
export const EMBEDDING_PROVIDER = "voyage";
export const EMBEDDING_MODEL = "voyage-4-lite";
export const EMBEDDING_DIMENSION = 1024;
export const RERANK_MODEL = "rerank-2.5-lite";

const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_RERANK_URL = "https://api.voyageai.com/v1/rerank";

export type VoyageInputType = "query" | "document";

export interface EmbedTextsWithVoyageInput {
  apiKey: string;
  texts: string[];
  inputType: VoyageInputType;
  fetchImpl?: typeof fetch | undefined;
}

export interface RerankWithVoyageInput {
  apiKey: string;
  query: string;
  documents: string[];
  topK: number;
  fetchImpl?: typeof fetch | undefined;
  signal?: AbortSignal | undefined;
}

export interface VoyageRerankResult {
  index: number;
  relevanceScore: number;
}

export interface VoyageRerankResponse {
  results: VoyageRerankResult[];
  totalTokens: number | null;
}

interface VoyageEmbeddingSuccess {
  data?: Array<{
    embedding?: unknown;
  }>;
}

interface VoyageRerankSuccess {
  data?: Array<{
    index?: unknown;
    relevance_score?: unknown;
  }>;
  usage?: {
    total_tokens?: unknown;
  };
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVoyageEmbeddingSuccess(
  value: unknown,
): value is VoyageEmbeddingSuccess {
  return isRecord(value);
}

function isVoyageRerankSuccess(value: unknown): value is VoyageRerankSuccess {
  return isRecord(value);
}

function readVoyageErrorMessage(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const error = value.error;

  if (!isRecord(error)) {
    return null;
  }

  return typeof error.message === "string" ? error.message : null;
}

function assertEmbeddingDimension(embedding: number[]): void {
  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Expected Voyage embedding dimension ${EMBEDDING_DIMENSION}, received ${embedding.length}.`,
    );
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.trim().length === 0) {
    return {};
  }

  return JSON.parse(text) as unknown;
}

export async function embedTextsWithVoyage(
  input: EmbedTextsWithVoyageInput,
): Promise<number[][]> {
  if (input.texts.length === 0) {
    return [];
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(VOYAGE_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: input.texts,
      model: EMBEDDING_MODEL,
      input_type: input.inputType,
      output_dimension: EMBEDDING_DIMENSION,
      output_dtype: "float",
    }),
  });
  const body = await readResponseBody(response);

  if (!response.ok) {
    const message = readVoyageErrorMessage(body) ?? response.statusText;
    throw new Error(
      `Voyage embedding request failed with ${response.status}: ${message}`,
    );
  }

  if (!isVoyageEmbeddingSuccess(body)) {
    throw new Error("Voyage embedding response did not contain vectors.");
  }

  const embeddings = body.data?.map((item) => {
    if (!isNumberArray(item.embedding)) {
      throw new Error("Voyage embedding response did not contain vectors.");
    }

    assertEmbeddingDimension(item.embedding);
    return item.embedding;
  });

  if (embeddings === undefined || embeddings.length !== input.texts.length) {
    throw new Error("Voyage embedding response did not contain vectors.");
  }

  return embeddings;
}

/**
 * Rerank documents with Voyage's rerank endpoint.
 *
 * @param input - API key, query, candidate documents, top-k, and optional fetch controls.
 * @returns Reranked document indexes with relevance scores and usage tokens when present.
 */
export async function rerankWithVoyage(
  input: RerankWithVoyageInput,
): Promise<VoyageRerankResponse> {
  if (input.documents.length === 0) {
    return {
      results: [],
      totalTokens: null,
    };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(VOYAGE_RERANK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: input.query,
      documents: input.documents,
      model: RERANK_MODEL,
      top_k: input.topK,
      return_documents: false,
      truncation: true,
    }),
    signal: input.signal,
  });
  const body = await readResponseBody(response);

  if (!response.ok) {
    const message = readVoyageErrorMessage(body) ?? response.statusText;
    throw new Error(
      `Voyage rerank request failed with ${response.status}: ${message}`,
    );
  }

  if (!isVoyageRerankSuccess(body) || !Array.isArray(body.data)) {
    throw new Error("Voyage rerank response did not contain rankings.");
  }

  const results: VoyageRerankResult[] = body.data.map((item) => {
    if (
      typeof item.index !== "number" ||
      !Number.isInteger(item.index) ||
      typeof item.relevance_score !== "number" ||
      !Number.isFinite(item.relevance_score)
    ) {
      throw new Error("Voyage rerank response did not contain rankings.");
    }

    return {
      index: item.index,
      relevanceScore: item.relevance_score,
    };
  });
  const totalTokens = isRecord(body.usage)
    ? body.usage.total_tokens
    : undefined;

  return {
    results,
    totalTokens:
      typeof totalTokens === "number" && Number.isFinite(totalTokens)
        ? totalTokens
        : null,
  };
}

export function createVoyageEmbeddingProvider(apiKey: string): {
  embedQuery: (query: string) => Promise<number[]>;
  embedDocuments: (documents: string[]) => Promise<number[][]>;
} {
  return {
    embedQuery: async (query) =>
      (
        await embedTextsWithVoyage({
          apiKey,
          texts: [query],
          inputType: "query",
        })
      )[0] ?? [],
    embedDocuments: async (documents) =>
      embedTextsWithVoyage({
        apiKey,
        texts: documents,
        inputType: "document",
      }),
  };
}
