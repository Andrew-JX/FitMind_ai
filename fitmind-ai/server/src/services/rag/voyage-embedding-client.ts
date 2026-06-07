export const EMBEDDING_PROVIDER = "voyage";
export const EMBEDDING_MODEL = "voyage-4-lite";
export const EMBEDDING_DIMENSION = 1024;

const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";

export type VoyageInputType = "query" | "document";

export interface EmbedTextsWithVoyageInput {
  apiKey: string;
  texts: string[];
  inputType: VoyageInputType;
  fetchImpl?: typeof fetch | undefined;
}

interface VoyageEmbeddingSuccess {
  data?: Array<{
    embedding?: unknown;
  }>;
}

interface VoyageEmbeddingError {
  error?: {
    message?: string;
  };
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
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
    const message =
      (body as VoyageEmbeddingError).error?.message ?? response.statusText;
    throw new Error(
      `Voyage embedding request failed with ${response.status}: ${message}`,
    );
  }

  const embeddings = (body as VoyageEmbeddingSuccess).data?.map((item) => {
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
