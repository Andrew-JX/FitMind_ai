import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { loadServerEnv } from "../src/env.js";
import { classifyAssistantIntent } from "../src/services/assistant/assistant-intent-router.js";
import {
  retrieveKnowledgeChunks,
  type KnowledgeReranker,
  type RetrievedKnowledgeChunk,
} from "../src/services/rag/knowledge-retriever.js";
import {
  evaluateRagCases,
  type RagEvalCase,
  type RagEvalResult,
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

    if (
      /^[A-Za-z_][A-Za-z0-9_]*$/u.test(key) &&
      process.env[key] === undefined
    ) {
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

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function printRagEvalResult(label: string, result: RagEvalResult): void {
  console.log(`RAG eval ${label} cases: ${result.total}`);
  console.log(
    `RAG eval ${label} metrics: top1=${formatPercent(
      result.metrics.top1HitRate,
    )}, top3=${formatPercent(result.metrics.top3HitRate)}, mrr=${result.metrics.mrr.toFixed(3)}`,
  );

  for (const rank of result.metrics.caseRanks) {
    console.log(
      `RAG eval ${label} rank: ${rank.id}=${rank.expectedRank ?? "missing"}`,
    );
  }
}

function createFixtureReranker(testCase: RagEvalCase): KnowledgeReranker {
  return {
    rerankKnowledgeChunks: async (input) => {
      const expected = testCase.expectedSourceIncludes?.toLowerCase();
      const scored = input.candidates.map((candidate, index) => ({
        candidate,
        index,
        score:
          expected !== undefined &&
          candidate.title.toLowerCase().includes(expected)
            ? 1
            : 0,
      }));
      const chunks = scored
        .sort((left, right) => {
          if (right.score !== left.score) {
            return right.score - left.score;
          }

          if (right.candidate.score !== left.candidate.score) {
            return right.candidate.score - left.candidate.score;
          }

          return left.index - right.index;
        })
        .slice(0, input.limit)
        .map(
          (item): RetrievedKnowledgeChunk => ({
            ...item.candidate,
            score: item.score,
          }),
        );

      return {
        chunks,
        model: "fixture-reranker",
        totalTokens: null,
      };
    },
  };
}

async function retrieveForEval(
  question: string,
  testCase: RagEvalCase,
  rerankingEnabled: boolean,
): Promise<RetrievedKnowledgeChunk[]> {
  const intent = classifyAssistantIntent(question).intent;

  if (intent === "unsupported") {
    return [];
  }

  return retrieveKnowledgeChunks(question, {
    rerankingEnabled,
    reranker: rerankingEnabled ? createFixtureReranker(testCase) : null,
  });
}

function assertRerankedDoesNotRegress(input: {
  baseline: RagEvalResult;
  reranked: RagEvalResult;
}): string[] {
  const failures: string[] = [];

  if (input.reranked.metrics.top3HitRate < input.baseline.metrics.top3HitRate) {
    failures.push("reranked top3 hit rate regressed");
  }

  if (input.reranked.metrics.mrr < input.baseline.metrics.mrr) {
    failures.push("reranked MRR regressed");
  }

  return failures;
}

async function main(): Promise<void> {
  const envFileArg = process.argv[2];

  if (envFileArg !== undefined) {
    await loadEnvFile(resolve(process.cwd(), envFileArg));
    console.log("Env file loaded: yes");
  }

  const result = await evaluateRagCases(ragEvalCases, (question, testCase) =>
    retrieveForEval(question, testCase, false),
  );

  printRagEvalResult("baseline", result);

  if (!result.passed) {
    for (const failure of result.failures) {
      console.error(`RAG eval failure: ${failure}`);
    }

    process.exit(1);
  }

  if (loadServerEnv().ragRerankingEnabled) {
    const rerankedResult = await evaluateRagCases(
      ragEvalCases,
      (question, testCase) => retrieveForEval(question, testCase, true),
    );
    const regressionFailures = assertRerankedDoesNotRegress({
      baseline: result,
      reranked: rerankedResult,
    });

    printRagEvalResult("fixture-reranked", rerankedResult);

    if (!rerankedResult.passed || regressionFailures.length > 0) {
      for (const failure of [
        ...rerankedResult.failures,
        ...regressionFailures,
      ]) {
        console.error(`RAG eval reranked failure: ${failure}`);
      }

      process.exit(1);
    }
  }

  console.log("RAG eval passed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`RAG eval failed: ${message}`);
  process.exit(1);
});
