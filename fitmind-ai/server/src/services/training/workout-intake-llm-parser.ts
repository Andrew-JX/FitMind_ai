import { z } from "zod";

import { loadServerEnv } from "../../env.js";

export type WorkoutIntakeLlmProviderMode =
  | "off"
  | "mock"
  | "anthropic"
  | "gemini";

export type WorkoutIntakeLlmRawParser = (input: {
  text: string;
}) => Promise<string>;

const llmWorkoutIntakeSetSchema = z
  .object({
    weight_kg: z.number().nonnegative(),
    reps: z.number().int().positive(),
  })
  .strict();

const llmWorkoutIntakeIncompleteSetSchema = z
  .object({
    group_count: z.number().int().positive().nullable(),
    weight_kg: z.number().positive().nullable(),
    reps: z.number().int().positive().nullable(),
    missing_fields: z.array(z.enum(["weight_kg", "reps"])).min(1),
  })
  .strict();

export const llmWorkoutIntakeOutputSchema = z
  .object({
    exercises: z.array(
      z
        .object({
          spoken_name: z.string().trim().min(1),
          sets: z.array(llmWorkoutIntakeSetSchema),
          incomplete_sets: z.array(llmWorkoutIntakeIncompleteSetSchema),
        })
        .strict(),
    ),
    warnings: z.array(z.string().min(1)),
  })
  .strict();

export type LlmWorkoutIntakeOutput = z.infer<
  typeof llmWorkoutIntakeOutputSchema
>;

const CHINESE_NUMERALS = new Map<string, number>([
  ["\u96f6", 0],
  ["\u4e00", 1],
  ["\u4e8c", 2],
  ["\u4e24", 2],
  ["\u4e09", 3],
  ["\u56db", 4],
  ["\u4e94", 5],
  ["\u516d", 6],
  ["\u4e03", 7],
  ["\u516b", 8],
  ["\u4e5d", 9],
  ["\u5341", 10],
]);

export function getConfiguredWorkoutIntakeLlmProvider(): WorkoutIntakeLlmProviderMode {
  return loadServerEnv().workoutIntakeLlmProvider;
}

export function createWorkoutIntakeLlmParser(
  provider: WorkoutIntakeLlmProviderMode,
): WorkoutIntakeLlmRawParser | null {
  if (provider === "off") {
    return null;
  }

  if (provider === "anthropic") {
    return parseWithAnthropicWorkoutIntakeLlm;
  }

  if (provider === "gemini") {
    return parseWithGeminiWorkoutIntakeLlm;
  }

  return parseWithMockWorkoutIntakeLlm;
}

export async function parseWithMockWorkoutIntakeLlm(input: {
  text: string;
}): Promise<string> {
  const text = normalizeMockText(input.text);
  const spokenName = findMockSpokenName(text);
  const groupCount = parsePositiveInteger(text, /(\d+)\s*\u7ec4/u);
  const weightKg = parsePositiveNumber(text, /(\d+(?:\.\d+)?)\s*(?:kg|\u516c\u65a4|\u5343\u514b)/iu);
  const reps = parseMockReps(text);

  if (spokenName === null) {
    return JSON.stringify({
      exercises: [],
      warnings: [
        "\u667a\u80fd\u89e3\u6790\u6ca1\u6709\u8bc6\u522b\u5230\u660e\u786e\u52a8\u4f5c\u3002",
      ],
    });
  }

  if (groupCount !== null && weightKg !== null && reps !== null) {
    return JSON.stringify({
      exercises: [
        {
          spoken_name: spokenName,
          sets: Array.from({ length: groupCount }, () => ({
            reps,
            weight_kg: weightKg,
          })),
          incomplete_sets: [],
        },
      ],
      warnings: [],
    });
  }

  const missingFields: Array<"weight_kg" | "reps"> = [];

  if (weightKg === null) {
    missingFields.push("weight_kg");
  }

  if (reps === null) {
    missingFields.push("reps");
  }

  return JSON.stringify({
    exercises: [
      {
        spoken_name: spokenName,
        sets: [],
        incomplete_sets:
          missingFields.length > 0
            ? [
                {
                  group_count: groupCount,
                  weight_kg: weightKg,
                  reps,
                  missing_fields: missingFields,
                },
              ]
            : [],
      },
    ],
    warnings:
      missingFields.length > 0
        ? [
            "\u6709\u7ec4\u6570\u4fe1\u606f\u4e0d\u5b8c\u6574\uff0c\u9700\u8981\u4f60\u786e\u8ba4\u6216\u8865\u5168\u3002",
          ]
        : [],
  });
}

async function parseWithAnthropicWorkoutIntakeLlm(input: {
  text: string;
}): Promise<string> {
  const env = loadServerEnv();

  if (env.anthropicApiKey === undefined) {
    throw new Error("ANTHROPIC_API_KEY is required for workout intake LLM parsing.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": env.anthropicApiKey,
    },
    body: JSON.stringify({
      max_tokens: 1000,
      model: "claude-sonnet-4-20250514",
      system: buildWorkoutIntakeSystemPrompt(),
      messages: [
        {
          role: "user",
          content: input.text,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Workout intake LLM request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = payload.content
    ?.filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text?.trim() ?? "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Workout intake LLM returned no text output.");
  }

  return text;
}

async function parseWithGeminiWorkoutIntakeLlm(input: {
  text: string;
}): Promise<string> {
  const env = loadServerEnv();

  if (env.geminiApiKey === undefined) {
    throw new Error("GEMINI_API_KEY is required for workout intake LLM parsing.");
  }

  const model = "gemini-2.0-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": env.geminiApiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: buildWorkoutIntakeSystemPrompt() }],
        },
        contents: [{ role: "user", parts: [{ text: input.text }] }],
        generationConfig: {
          maxOutputTokens: 1000,
          responseMimeType: "application/json",
          temperature: 0,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Workout intake LLM request failed with HTTP ${response.status}.`,
    );
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text?.trim() ?? "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Workout intake LLM returned no text output.");
  }

  return text;
}

function buildWorkoutIntakeSystemPrompt(): string {
  return [
    "You parse workout logging text into strict JSON only.",
    "Return no markdown and no prose outside JSON.",
    "Schema: {\"exercises\":[{\"spoken_name\":\"string\",\"sets\":[{\"weight_kg\":number,\"reps\":number}],\"incomplete_sets\":[{\"group_count\":number|null,\"weight_kg\":number|null,\"reps\":number|null,\"missing_fields\":[\"weight_kg\"|\"reps\"]}]}],\"warnings\":[\"string\"]}.",
    "Parse every exercise mentioned, even when the speaker lists exercises first and then describes each one's sets later; merge those into one entry per exercise.",
    "Preserve user-provided numbers exactly, including decimals like 27.5.",
    "Convert Chinese numerals such as \u4e09\u7ec4 and \u5341\u7ec4.",
    "Convert pounds (\u78c5 or lbs) to kilograms using 1 lb = 0.4536 kg.",
    "Expand repeated sets when group count, weight, and reps are all known.",
    "If weight or reps is missing, do not guess; put it in incomplete_sets.",
    "Do not output exercise_id or any database identifiers.",
    "Do not provide medical, rehab, or coaching advice.",
  ].join("\n");
}

function normalizeMockText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(
      /[\u96f6\u4e00\u4e8c\u4e24\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+(?=\s*(?:\u7ec4|\u4e2a|\u6b21|\u516c\u65a4|\u5343\u514b))/gu,
      (match) => String(parseChineseNumber(match)),
    );
}

function findMockSpokenName(text: string): string | null {
  for (const spokenName of [
    "\u4e0a\u659c\u54d1\u94c3\u5367\u63a8",
    "\u6760\u94c3\u5367\u63a8",
    "\u54d1\u94c3\u63a8\u80a9",
    "\u5750\u59ff\u54d1\u94c3\u63a8\u80a9",
    "\u5f15\u4f53\u5411\u4e0a",
    "\u54d1\u94c3\u4fa7\u5e73\u4e3e",
    "\u9ad8\u4f4d\u4e0b\u62c9",
  ]) {
    if (text.includes(spokenName)) {
      return spokenName;
    }
  }

  return null;
}

function parsePositiveNumber(value: string, pattern: RegExp): number | null {
  const match = pattern.exec(value);
  pattern.lastIndex = 0;
  const parsed = Number(match?.[1] ?? "");

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveInteger(value: string, pattern: RegExp): number | null {
  const match = pattern.exec(value);
  pattern.lastIndex = 0;
  const parsed = Number(match?.[1] ?? match?.[2] ?? "");

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseMockReps(value: string): number | null {
  for (const pattern of [
    /\u6bcf\u7ec4(?:\u7684)?\u6b21\u6570(?:\u662f|\u4e3a)?\s*(\d+)/iu,
    /\u6bcf\u7ec4\s*(?:\u505a\u4e86?|\u505a\u7684\u662f|\u505a)\s*(\d+)\s*(?:\u6b21|\u4e2a|reps)/iu,
    /\u6bcf\u7ec4[^\d]{0,8}(\d+)\s*(?:\u6b21|\u4e2a|reps)/iu,
    /\u505a\u4e86?\s*(\d+)\s*(?:\u6b21|\u4e2a|reps)/iu,
  ]) {
    const parsed = parsePositiveInteger(value, pattern);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function parseChineseNumber(value: string): number {
  if (value === "\u5341") {
    return 10;
  }

  const tenIndex = value.indexOf("\u5341");

  if (tenIndex >= 0) {
    const beforeTen = value.slice(0, tenIndex);
    const afterTen = value.slice(tenIndex + 1);
    const tens = beforeTen === "" ? 1 : (CHINESE_NUMERALS.get(beforeTen) ?? 0);
    const ones = afterTen === "" ? 0 : (CHINESE_NUMERALS.get(afterTen) ?? 0);

    return tens * 10 + ones;
  }

  return CHINESE_NUMERALS.get(value) ?? 0;
}
