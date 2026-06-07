interface ApiSuccess<TData> {
  ok: true;
  data: TData;
}

interface ApiErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

type ApiResponse<TData> = ApiSuccess<TData> | ApiErrorResponse;

interface AuthSuccessData {
  user: {
    id: string;
    email: string;
  };
  token: string;
}

interface ExerciseSearchData {
  items: Array<{
    id: string;
    name_en: string;
  }>;
}

interface WorkoutDetailData {
  workout: {
    id: string;
  };
}

interface AssistantTurnData {
  intent: string;
  answer: {
    evidence: {
      workout_ids: string[];
    };
    sources: Array<{
      title: string;
      category: string;
      chunk_text: string;
    }>;
  };
}

const DEFAULT_BASE_URL = "https://fitmind-ai-psi.vercel.app";
const SMOKE_PASSWORD = "Passw0rd!";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function jsonBody(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

async function requestJson<TData>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: ApiResponse<TData> }> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = (await response.json()) as ApiResponse<TData>;

  return {
    status: response.status,
    body,
  };
}

function expectSuccess<TData>(
  response: { status: number; body: ApiResponse<TData> },
  expectedStatus: number,
  label: string,
): TData {
  assert(
    response.status === expectedStatus,
    `${label} expected HTTP ${expectedStatus}, got ${response.status}.`,
  );
  assert(response.body.ok, `${label} expected success response.`);

  return response.body.data;
}

function authHeaders(token: string): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json; charset=utf-8",
  };
}

async function createWorkout(
  baseUrl: string,
  token: string,
  exerciseId: string,
  performedAt: string,
  weightKg: number,
): Promise<string> {
  const result = expectSuccess(
    await requestJson<WorkoutDetailData>(baseUrl, "/api/workouts", {
      method: "POST",
      headers: authHeaders(token),
      body: jsonBody({
        performed_at: performedAt,
        duration_minutes: 45,
        notes: "Phase 4.9 production smoke",
        sets: [
          {
            exercise_id: exerciseId,
            set_index: 1,
            reps: 5,
            weight_kg: weightKg,
            rpe: 8,
            is_warmup: false,
            notes: "bench smoke set",
          },
        ],
      }),
    }),
    201,
    "POST /api/workouts",
  );

  return result.workout.id;
}

async function deleteWorkout(
  baseUrl: string,
  token: string,
  workoutId: string,
): Promise<void> {
  await fetch(`${baseUrl}/api/workouts/${workoutId}`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${token}`,
    },
  }).catch(() => undefined);
}

async function askAssistant(
  baseUrl: string,
  token: string,
  message: string,
  exerciseId?: string,
): Promise<AssistantTurnData> {
  return expectSuccess(
    await requestJson<AssistantTurnData>(baseUrl, "/api/assistant/mock-turn", {
      method: "POST",
      headers: authHeaders(token),
      body: jsonBody({
        mode: "auto",
        message,
        start_date: "2026-05-01",
        end_date: "2026-05-15",
        ...(exerciseId !== undefined ? { exercise_id: exerciseId } : {}),
      }),
    }),
    200,
    "POST /api/assistant/mock-turn",
  );
}

function logAssistantSummary(label: string, data: AssistantTurnData): void {
  console.log(
    `${label}: intent=${data.intent}, sources=${data.answer.sources.length}, evidence_workouts=${data.answer.evidence.workout_ids.length}`,
  );

  if (data.answer.sources.length > 0) {
    console.log(
      `${label} source titles: ${data.answer.sources
        .map((source) => source.title)
        .join(" | ")}`,
    );
  }
}

async function main(): Promise<void> {
  const baseUrl = process.argv[2] ?? DEFAULT_BASE_URL;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `phase-4-9-production-smoke-${suffix}@example.com`;
  const workoutIds: string[] = [];
  let token = "";

  try {
    const health = expectSuccess(
      await requestJson<{ status: string }>(baseUrl, "/api/health"),
      200,
      "GET /api/health",
    );
    assert(health.status === "ok", "Expected production health status ok.");

    const auth = expectSuccess(
      await requestJson<AuthSuccessData>(baseUrl, "/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
        body: jsonBody({
          email,
          password: SMOKE_PASSWORD,
          display_name: "Phase 4.9 Production Smoke",
        }),
      }),
      201,
      "POST /api/auth/register",
    );
    token = auth.token;

    const exercises = expectSuccess(
      await requestJson<ExerciseSearchData>(baseUrl, "/api/exercises?q=bench"),
      200,
      "GET /api/exercises?q=bench",
    );
    const bench = exercises.items[0];

    assert(bench !== undefined, "Expected a bench exercise.");

    workoutIds.push(
      await createWorkout(baseUrl, token, bench.id, "2026-05-01T09:00:00Z", 80),
    );
    workoutIds.push(
      await createWorkout(baseUrl, token, bench.id, "2026-05-08T09:00:00Z", 82.5),
    );

    const rpe = await askAssistant(baseUrl, token, "RPE 是什么？");
    logAssistantSummary("RPE", rpe);

    assert(rpe.intent === "knowledge", "RPE prompt should route to knowledge.");
    assert(rpe.answer.sources.length > 0, "RPE prompt should return Sources.");
    assert(
      rpe.answer.sources.some((source) => source.title.includes("RPE")),
      "RPE prompt should include an RPE source.",
    );
    assert(
      rpe.answer.evidence.workout_ids.length === 0,
      "RPE prompt should not return workout Evidence.",
    );

    const mixed = await askAssistant(
      baseUrl,
      token,
      "卧推没进步是不是训练量不够？",
      bench.id,
    );
    logAssistantSummary("Bench plateau", mixed);

    assert(
      mixed.intent === "mixed_tool_rag",
      "Bench plateau prompt should route to mixed_tool_rag.",
    );
    assert(
      mixed.answer.sources.length > 0,
      "Bench plateau prompt should return Sources.",
    );
    assert(
      mixed.answer.evidence.workout_ids.length > 0,
      "Bench plateau prompt should return workout Evidence.",
    );

    const unsupported = await askAssistant(baseUrl, token, "给我讲个笑话");
    logAssistantSummary("Unsupported", unsupported);

    assert(
      unsupported.intent === "unsupported",
      "Joke prompt should route to unsupported.",
    );
    assert(
      unsupported.answer.sources.length === 0,
      "Unsupported prompt should not return Sources.",
    );
    assert(
      unsupported.answer.evidence.workout_ids.length === 0,
      "Unsupported prompt should not return Evidence.",
    );

    console.log("Production assistant RAG smoke passed.");
    console.log(`Base URL: ${baseUrl}`);
    console.log("Prompts: knowledge, mixed_tool_rag, unsupported");
  } finally {
    await Promise.all(
      workoutIds.map((workoutId) => deleteWorkout(baseUrl, token, workoutId)),
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`Production assistant RAG smoke failed: ${message}`);
  process.exit(1);
});
