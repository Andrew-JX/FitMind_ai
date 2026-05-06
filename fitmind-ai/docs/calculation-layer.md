# Calculation Layer

## Purpose
FitMind AI's Phase 2.0 calculation layer exists to produce deterministic training signals before any future AI interpretation. The goal is to make every derived training number reproducible, inspectable, and tied to real user-owned workout evidence.

This means the app can answer foundational questions such as:
- How much did this user train in a date range?
- Which exercises contributed most volume?
- How has one exercise progressed across recent sessions?

These answers are intentionally computed without chat, tool-calling orchestration, retrieval, or model inference.

## Deterministic Before AI
The product direction still allows future AI assistance, but the calculation layer comes first because:
- deterministic totals are easier to test and debug
- evidence can be returned directly with each calculation
- user trust is higher when numbers can be traced to workouts and sets
- future AI summaries can reference stable inputs instead of inventing calculations at runtime

Phase 2.0 therefore focuses on deterministic APIs, not AI output generation.

## Current Endpoints
### `GET /api/training/summary`
Returns an authenticated user's readonly range summary.

Primary response groups:
- `range`
- `totals`
- `by_exercise`
- `evidence`

Evidence returned today:
- `evidence.workout_ids`
- `evidence.calculation_rules`

This endpoint answers:
- how many workouts were included
- how many sets were included
- how many reps were accumulated
- how much total volume was accumulated
- which exercises contributed the most volume within the requested range

### `GET /api/training/exercise-progress`
Returns an authenticated user's readonly progress view for one requested exercise.

Primary response groups:
- `range`
- `exercise`
- `totals`
- `sessions`
- `evidence`

Evidence returned today:
- `evidence.workout_ids`
- `evidence.set_ids`
- `evidence.calculation_rules`
- per-session `set_ids`

This endpoint answers:
- how many workouts included the requested exercise
- how many matching sets were included
- total reps and total volume for that exercise
- max observed weight for that exercise in range
- approximate best Epley-estimated 1RM in range
- per-workout rollups for recent session inspection

## Date Filtering Convention
API inputs use inclusive calendar dates:
- `start_date=YYYY-MM-DD`
- `end_date=YYYY-MM-DD`

Internally, timestamp filtering uses the safe half-open convention:
- `performed_at >= start_date::date`
- `performed_at < (end_date::date + interval '1 day')`

This avoids off-by-one errors near the end of the day while preserving the user's calendar mental model.

## Null-Safe Aggregation Convention
The calculation layer treats nullable numeric training fields defensively:
- nullable `reps` are treated as `0` during sums
- nullable `weight_kg` values are treated as `0` during sums
- empty aggregates return `0` for additive totals
- empty aggregates return `null` for max-style metrics such as `max_weight_kg` and `estimated_1rm_kg`

This keeps empty states explicit while preventing SQL null propagation from breaking totals.

## Epley 1RM Signal
Exercise progress currently uses the Epley estimate:

`estimated_1rm_kg = weight_kg * (1 + reps / 30)`

This is an approximate training signal, not a prescription, guarantee, or medical recommendation. It is meant to help compare logged effort across sets and sessions, not replace coaching judgment.

## User Isolation
User isolation comes only from the authenticated request context:
- the backend derives `user_id` from auth middleware
- clients do not pass a user id for calculation endpoints
- repository queries filter workouts by the authenticated user's id before aggregating

## Future AI Relevance
These deterministic endpoints are intended to be usable later by higher-level AI flows, including future tool-calling or explanation layers, but those features are intentionally out of scope for Phase 2.0.

Phase 2.0 does not add:
- AI chat
- model tool calling
- SSE streams
- RAG or MCP features
- agent orchestration
- automated reports or charts
- complex analytics beyond the documented deterministic aggregates

## Phase 2.0 Non-Goals
Explicit non-goals for this phase:
- changing database schema
- changing existing workout CRUD contracts
- introducing complex routing
- introducing a large UI library
- sharing these DTOs through broader cross-package type expansion when the file-cap constraint would be violated

## `GET /api/training/recommendation-context`
Returns an authenticated user's deterministic recommendation context package for one readonly date range.

Primary response groups:
- `range`
- `summary`
- `focus_exercises`
- `recent_workouts`
- `evidence`

Evidence returned today:
- `evidence.source`
- `evidence.workout_ids`
- `evidence.set_ids`
- `evidence.calculation_rules`

This endpoint aggregates:
- summary totals from the existing training summary calculation
- focus exercise progress from the existing exercise-progress calculation
- the latest recent workouts in range
- evidence ids and calculation rules that explain what was included

This endpoint is intentionally deterministic:
- it does not call an LLM
- it does not generate coaching recommendations
- it is designed as a future Tool Calling context package
- it keeps user isolation and date range filtering identical to the existing calculation endpoints
- `evidence.source` is always `deterministic_calculation_layer`

The current assembly rules are:
- `summary` reuses the existing summary output and reshapes it into the context package
- `focus_exercises` uses the top 3 rows from `summary.by_exercise` based on the current summary ordering by `total_volume DESC`
- each focus exercise reuses the existing exercise-progress totals, max weight, and estimated 1RM
- `recent_workouts` returns the latest 5 workouts in range ordered by `performed_at DESC, workout_id DESC`
- `evidence.workout_ids` and `evidence.set_ids` are unions of the included deterministic evidence
- empty ranges still return a valid zero/empty context package rather than an error

## Phase 3.0 Tool Calling Skeleton
Phase 3.0 adds a backend-only Tool Calling Skeleton on top of the deterministic calculation layer.

Current internal tools:
- `get_training_summary`
- `get_exercise_progress`
- `get_recommendation_context`

These tools wrap existing deterministic backend services rather than duplicating calculation logic:
- `get_training_summary` wraps the training summary service
- `get_exercise_progress` wraps the exercise progress service
- `get_recommendation_context` wraps the recommendation context service

The current tool layer is intentionally still not a real model integration:
- it does not call any LLM or model provider
- it does not add AI chat
- it does not add SSE
- it does not generate coaching recommendations

User isolation stays aligned with the rest of the backend:
- authenticated `user_id` comes from tool execution context
- tool argument schemas never accept `user_id`
- the wrapped deterministic services still enforce user-scoped data access on the backend

The executor is provider-agnostic:
- it looks up tools by name
- it validates tool args before execution
- it runs internal backend capabilities without depending on a specific model SDK or provider protocol

This means the current tool layer is a preparation step for future Tool Calling, not a finished AI feature.

If tool call logging is implemented, `tool_call_logs` records execution metadata for internal tool runs. The architectural point is that the backend can persist which internal tool ran, whether it succeeded, and compact execution details without exposing a model-facing Tool Calling product flow yet.

## Phase 3.1 Assistant Orchestration Skeleton
Phase 3.1 adds a deterministic assistant orchestration layer on top of the existing internal tool executor.

Current assistant endpoint:
- `POST /api/assistant/mock-turn`

This endpoint is intentionally still not a real AI assistant:
- responses are labeled `assistant_type: deterministic_mock`
- answers are template-based, not AI-generated
- it does not call any model provider
- it does not stream
- it does not generate coaching recommendations

The current orchestration pattern is mode-based:
- `training_overview` invokes `get_training_summary`
- `exercise_progress` requires `exercise_id` and invokes `get_exercise_progress`
- `recommendation_context` invokes `get_recommendation_context`

This means the current assistant layer is not deciding with a model which tool to use. The backend chooses one deterministic path based on validated request input, executes the existing tool through the executor, and then formats a template response from the returned structured data.

The current response shape proves several future-chat building blocks without introducing real AI behavior:
- authenticated user scoping still comes from backend auth context
- one assistant endpoint can orchestrate multiple internal deterministic tools
- tool execution metadata can be surfaced in `tool_calls`
- answer `summary`, `bullets`, and `evidence` can be assembled from tool results instead of raw table reads

If chat persistence is enabled, the assistant layer also stores the turn in the existing chat tables:
- when `session_id` is omitted, a new `chat_session` is created for the authenticated user
- when `session_id` is provided, ownership is verified before appending messages
- one `user` message is stored with compact text-block content and minimal request metadata
- one `assistant` message is stored with deterministic summary/bullets content plus structured deterministic output
- `chat_sessions.last_message_at` advances as messages are inserted

The current persistence is still intentionally limited:
- persisted messages contain deterministic app-owned data only
- no JWT, headers, raw auth payloads, or env vars are stored as message content or metadata
- `tool_call_logs.message_id` remains `null` because the current executor persists logs internally and is not yet wired to the persisted assistant message row

## Phase 3.2 Provider Adapter Path
Phase 3.2 adds a provider adapter layer between the assistant orchestrator and any real model provider.

The current architecture is:
- assistant orchestrator
- provider adapter
- normalized provider response
- optional internal tool execution
- final non-streaming assistant response

This phase is intentionally still limited:
- no SSE
- no frontend chat UI
- no multi-step tool loop
- no second provider call after tool execution
- no coaching recommendation generation

### Why the provider adapter exists
The provider adapter exists so the backend speaks in project-owned request and response shapes instead of provider-owned SDK payloads.

That gives the system:
- one stable assistant contract even if providers change later
- testable mock-provider behavior before real provider wiring
- a clean separation between provider selection and backend business flow

### What the provider is allowed to do
The provider layer may return exactly one of:
- a plain-text `message`
- one `tool_call`
- an `error`

The provider does not:
- access the database directly
- bypass auth-scoped backend services
- execute tools itself
- own message persistence

### What the orchestrator still owns
The assistant orchestrator remains the owner of business flow:
- request validation
- auth-scoped session resolution
- provider request construction
- tool execution through the internal executor
- final response shaping
- chat message persistence

This means even a real provider does not become the owner of data access or orchestration policy. It is only one pluggable decision and language layer inside a backend-controlled workflow.

### Current provider modes
The adapter currently supports:
- `ASSISTANT_PROVIDER=mock`
- `ASSISTANT_PROVIDER=anthropic`

`mock` remains the default so local behavior is stable when no provider flag is set.

The Anthropic path is still intentionally narrow:
- one non-streaming Messages API call
- at most one provider-requested tool call
- normalized response mapping back into the existing assistant flow

### Current smoke coverage
Phase 3.2 smoke now covers:
- stable mock-provider runs for normal tool-backed, plain-text, and provider-error paths
- env-gated real-provider verification when `ANTHROPIC_API_KEY` is available
- persistence and user isolation checks for successful runs

If `ANTHROPIC_API_KEY` is absent, the real-provider smoke is skipped rather than treated as a product failure.

## Phase 3.3-3.4 Assistant SSE and Frontend State Machine
Phases 3.3 and 3.4 turn the earlier deterministic assistant architecture into a demoable AI application flow without giving up backend control.

The current end-to-end path is:
- user message
- frontend assistant chat state machine
- `POST /api/assistant/stream-turn`
- assistant orchestrator
- provider adapter
- optional internal tool execution
- deterministic evidence assembly
- SSE answer stream back to the frontend

This is the current system story:
- FitMind AI is not just a chat box
- real workout logs remain the source of truth
- deterministic calculations remain the source of numeric facts
- the model stays inside a controlled decision boundary
- the frontend exposes the tool-backed reasoning flow through explicit stream states

### Current assistant chain
The current assistant chain can be described as:
- real training logs
- deterministic calculation layer
- tool registry and executor
- provider adapter
- SSE assistant stream
- frontend chat state machine

That ordering matters because the model is not trusted to:
- read raw workout tables directly
- invent aggregation rules
- choose cross-user data scope
- generate evidence on its own

Instead, the backend owns:
- request validation
- authenticated user scoping
- session ownership checks
- tool name and arg validation
- deterministic evidence generation
- final streamed event policy

### Why the provider does not query the database directly
The provider does not query the database directly because data access and language generation are intentionally separated.

If the provider could query raw tables directly, the system would become:
- harder to test
- harder to audit
- harder to reason about during interviews
- more vulnerable to cross-user leakage or accidental over-fetching

The current boundary is:
- the provider may return `message`, `tool_call`, or `error`
- if a tool is requested, the backend executor validates the tool name and args schema
- the executor runs deterministic backend services using authenticated backend context
- the tool returns evidence-backed structured data

### Why `user_id` always comes from auth context
`user_id` always comes from auth middleware because ownership must remain authoritative on the server.

Current rules:
- the frontend never sends `user_id`
- the provider never chooses `user_id`
- tool schemas never accept `user_id`
- the orchestrator and tool executor receive authenticated user context from the backend only

This protects against:
- cross-user data leakage
- prompt-level attempts to impersonate another user
- model-generated tool args that try to override ownership

### Evidence stays deterministic
The assistant layer still depends on deterministic evidence rather than provider-generated explanation alone.

Current evidence fields include:
- `workout_ids`
- `set_ids` where relevant
- `calculation_rules`
- tool execution metadata such as tool name, status, and duration

This means the assistant can explain what it used instead of asking the user to trust an opaque answer.

### Current SSE UX contract
The backend SSE layer emits project-owned events rather than raw provider stream payloads.

Current event families include:
- `state`
- `session`
- `provider_selected`
- `tool_call_started`
- `tool_call_finished`
- `answer_delta`
- `done`
- `error`

The frontend state machine currently exposes:
- `thinking`
- `tool_calling`
- `answering`
- `done`
- `error`

This improves UX over one blocking response because the user can see:
- that the request was accepted
- whether the backend is still deciding or actually running a tool
- when the answer begins streaming
- whether the turn completed or failed

That makes the AI behavior feel inspectable rather than magical.

### Session continuity
The streaming assistant path is now session-aware.

Current behavior:
- the orchestrator resolves or creates a chat session early
- the backend emits a `session` SSE event as soon as the session id is known
- `done` includes `session_id` again as a frontend fallback
- the frontend stores `sessionId` and sends it on later turns

This keeps multi-turn continuity in the streaming path without changing the public non-streaming `mock-turn` contract.

### Current limits
The current architecture is intentionally narrower than a full agentic assistant.

Still intentionally limited:
- the real Anthropic provider path is still non-streaming at the provider layer
- at most one tool call is allowed per assistant turn
- no second provider call is made after tool execution
- no repeated model/tool loop
- no RAG
- no MCP
- no autonomous agent behavior
- no coaching recommendation generation beyond deterministic, evidence-backed explanation

The important architecture point is that the current system already demonstrates:
- deterministic backend tools
- provider isolation
- tool validation
- auth-scoped execution
- SSE event streaming
- frontend streaming state handling

without claiming that it is already a full autonomous AI coaching product.
