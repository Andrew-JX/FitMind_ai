# Interview Notes

## Project Positioning
FitMind AI is positioned as a training log product plus a deterministic calculation layer, with room reserved for future explainable AI guidance.

The important framing is:
- it is not just a generic chat shell
- it starts from real first-party workout data
- every future recommendation should be traceable back to workout evidence and calculation rules

## Why The Project Does Not Start With AI Chat
The project intentionally does not start with AI chat because a chat-first product is weak if it cannot deterministically answer basic training questions.

Before any future model explanation, the system should already be able to answer:
- what the user trained
- how much total work was done
- which exercises contributed the most
- whether one exercise is progressing or stalling

That is why the project narrative is "deterministic first, generative later".

## Phase 1 Value: Workout Log CRUD
Phase 1 established the base product loop:
- register and login
- memory-only MVP auth
- search and choose exercises
- create workouts with sets
- browse workout list and detail
- delete workouts

The value of Phase 1 is not CRUD by itself. The value is that the product now owns real user training data with clear user boundaries.

## Phase 2 Value: Deterministic Calculation Layer
Phase 2 added deterministic readonly calculation APIs without changing workout CRUD contracts or database schema.

### `GET /api/training/summary`
This endpoint answers:
- how many workouts are in a range
- how many sets are in a range
- how many reps were accumulated
- how much total volume was accumulated
- which exercises contributed the most volume

### `GET /api/training/exercise-progress`
This endpoint answers:
- how many workouts included one exercise
- how many matching sets were included
- that exercise's total reps and total volume
- the max observed weight
- the approximate best estimated 1RM
- per-session rollups

## Evidence Design
One of the strongest interview points is the evidence model.

Current deterministic outputs include:
- `workout_ids`: which workouts contributed to the result
- `set_ids`: which sets contributed when relevant
- `calculation_rules`: plain-language rules describing how the values were calculated

This matters because future explanations should be auditable rather than black-box claims.

## Why The Date Filter Uses A Half-Open Interval
API input uses calendar dates like `start_date=YYYY-MM-DD` and `end_date=YYYY-MM-DD`, but internal filtering uses:
- `performed_at >= start_date::date`
- `performed_at < (end_date::date + interval '1 day')`

This avoids end-of-day off-by-one issues while preserving the user's calendar mental model.

## Why `estimated_1rm` Is Only An Approximation
The current progress signal uses the Epley formula:

`estimated_1rm_kg = weight_kg * (1 + reps / 30)`

In interviews, describe it as an approximate training signal, not a prescription and not a guaranteed true max.

## Why The Phase 2 Panels Are Readonly
The Phase 2 frontend panels are intentionally readonly. The focus is calculation correctness and stable display, not complex analytics UI.

That keeps responsibilities clear:
- backend owns calculation logic
- frontend owns readonly rendering and refresh behavior
- data mutation still happens through workout CRUD

## Refresh Behavior After Create/Delete
Current behavior is deliberately simple and explicit.

After workout create:
- workout list refreshes
- summary refreshes
- exercise progress refreshes when an exercise is selected
- recommendation context preview refreshes

After workout delete:
- workout list refreshes
- summary refreshes
- exercise progress refreshes when an exercise is selected
- recommendation context preview refreshes

## Recommendation Context Builder
Recommendation Context Builder is the key Phase 2.1 story. It is not an AI recommendation feature. It is a deterministic backend context package builder for future Tool Calling or LLM explanation.

A clean interview framing is:
- raw workout logs answer whether we have real data
- calculation endpoints answer whether we can deterministically compute the right numbers
- recommendation context answers whether we can assemble the right backend context before any AI explanation
- future LLM explanation should consume that context package instead of querying tables directly

## Why This Still Comes Before AI Chat
If recommendation context does not exist first, then a future LLM would need to decide which tables to read, what to aggregate, which workouts matter, and how to interpret the range boundaries.

That makes the system harder to test, harder to audit, and more likely to hallucinate. Phase 2.1 removes that ambiguity before any model layer is introduced.

## Raw Logs vs Calculation Endpoints vs Recommendation Context vs Future LLM
- raw logs: original `workouts` and `sets` facts
- calculation endpoints: deterministic answers to one focused question
- recommendation context: one structured package combining multiple deterministic outputs for future AI consumption
- future LLM explanation: language-layer interpretation on top of that package, not a replacement for the deterministic layer

## 30-Second Chinese Pitch For Phase 2.1
“Phase 2.1 我做的不是 AI 推荐生成，而是 Recommendation Context Builder。它新增了一个后端 API，把某个日期范围内的总训练量、重点动作进展、最近 workout 摘要、evidence 和 calculation rules 组装成一个结构化 context package。它是确定性的，不调 LLM，不生成建议，主要目的是为未来 Tool Calling 和 AI 解释提供一个已经整理好、可验证、可回溯的后端上下文。”

## Deep-Dive Q&A

### Why not let the LLM query all tables directly?
Because that mixes data access, aggregation logic, calculation rules, and language generation into one place. It becomes harder to test, harder to audit, and more likely to leak across user boundaries or hallucinate.

### Why build context before Tool Calling?
Because the first question is not “can the model call tools?” The first question is “what exact backend context should exist before the model says anything?” Recommendation Context Builder locks that down first.

### What does context include?
Right now it includes:
- summary
- focus_exercises
- recent_workouts
- evidence

### How does this reduce hallucination?
Because the future model receives a prepared deterministic package instead of messy raw tables. The numbers, evidence ids, and calculation rules are already assembled on the backend.

### What is still not implemented?
Still intentionally not implemented:
- AI chat
- Tool Calling
- SSE
- recommendation generation
- charts or reports
- RAG, MCP, or agent orchestration

## Phase 3.0 Tool Calling Skeleton
Phase 3.0 adds a Tool Calling Skeleton, but it is still a backend architecture step rather than a finished AI capability.

### How to explain the Tool Calling Skeleton
A clean interview framing is:
- first we built deterministic calculation endpoints
- then we built recommendation context as a deterministic context package
- then we wrapped those deterministic services as internal tools behind one provider-agnostic executor
- only after that would a future model layer be allowed to call those tools

The key point is that the current tool layer is internal backend infrastructure. It is not yet a real chat product, not a model integration, and not a user-facing Tool Calling experience.

### Why the provider-agnostic tool layer comes before real model integration
This order matters because it locks down the hard backend decisions first:
- tool names and input contracts become stable before any model SDK is introduced
- deterministic behavior can be tested without blaming model behavior
- user isolation and argument validation are solved before a model is allowed to request anything
- future provider swapping is easier because the executor already speaks in project-owned tool interfaces instead of provider-owned tool formats

### How tools reduce hallucination
The tool layer reduces hallucination because a future model would consume prepared deterministic outputs instead of:
- querying raw tables directly
- inventing its own aggregation rules
- guessing date filtering behavior
- mixing user identity with caller-provided input

In this design, the backend decides what the tool means and how the numbers are computed. The future model should only explain tool results, not manufacture the data pipeline.

### Calculation Endpoint vs Recommendation Context vs Tool Wrapper vs Future LLM Explanation
- calculation endpoint: a deterministic HTTP API that answers one focused question for an authenticated user
- recommendation context: a deterministic backend package that combines multiple calculation outputs into one explanation-ready context object
- tool wrapper: an internal callable backend capability that exposes an existing deterministic service through a validated tool interface
- future LLM explanation: a later language layer that may call those tools and turn their outputs into natural-language guidance, but is not implemented now

### 30-Second Chinese Pitch For Phase 3.0
“Phase 3.0 我做的不是把大模型真正接进来，而是先把 Tool Calling 的后端骨架搭好。现在后端已经有三个内部工具：训练总览、单动作进展、推荐上下文。它们本质上都是对现有确定性服务的包装，不调 LLM，不做聊天，也不生成建议。工具执行时的 user_id 来自认证上下文，不允许从参数里传，参数也会先校验。这样未来无论接哪个模型提供商，模型调用的都是一层已经稳定、可测试、可审计的内部工具接口，而不是直接碰数据库。”

## Phase 3.0 Deep-Dive Q&A

### Why not let the model call the database directly?
Because that would mix data access, permission boundaries, aggregation rules, and language generation into one place. It becomes harder to test, harder to audit, easier to leak across users, and more likely to hallucinate because the model would be deciding both what to query and how to interpret it.

### Why validate tool args?
Because model-generated or caller-provided tool input is not trustworthy by default. Validation makes sure the tool receives only the expected fields and formats, such as `YYYY-MM-DD` dates and a valid `exercise_id` where required. That protects both correctness and safety before any future provider integration.

### Why not include `user_id` in args?
Because ownership should come from authenticated backend context, not caller input. If `user_id` were allowed in args, a future model or client could accidentally or maliciously ask for another user's data. The current design keeps user isolation authoritative on the server side.

### What is logged in `tool_call_logs`?
At a high level, the backend can log execution metadata such as:
- authenticated `user_id`
- tool name
- sanitized input args
- execution status
- duration
- compact error or output metadata when supported

The important interview point is not the exact storage format. The important point is that tool execution can be observed and audited without relying on a model layer.

### What is still not implemented?
Still intentionally not implemented in Phase 3.0:
- no LLM or model provider integration
- no AI chat
- no SSE streaming tool loop
- no recommendation generation
- no model-facing user workflow for Tool Calling
- no RAG, MCP, or agent orchestration
- no frontend Tool Calling UI

The current phase is backend preparation only.

## Phase 3.1 Assistant Orchestration Skeleton
Phase 3.1 adds an Assistant Orchestration Skeleton, but it is still a deterministic backend step rather than real AI generation.

### How to explain deterministic assistant orchestration in interviews
A clean framing is:
- first we built deterministic calculation endpoints
- then we wrapped those capabilities as internal tools behind one executor
- then we added one assistant endpoint that can orchestrate those tools through a stable backend interface
- but the selection is still deterministic and mode-based, not model-driven

That makes Phase 3.1 a bridge between raw tool infrastructure and future provider-backed chat. The backend can now accept one assistant-style request, choose the correct internal tool path, execute it safely, and return an assistant-shaped response without introducing LLM behavior yet.

### Why this comes before provider integration
This order matters because it proves the product-owned orchestration contract first:
- what the assistant endpoint looks like
- how user-scoped input is validated
- how one request maps to one internal capability
- how deterministic evidence is returned
- how optional chat persistence works

If provider integration came first, model behavior would be mixed together with unfinished backend orchestration decisions. That would make the system harder to test, harder to explain, and easier to over-attribute to the model.

### Tool Executor vs Assistant Orchestrator vs Model Provider vs Future Streaming Chat
- tool executor: low-level internal backend layer that validates tool args and runs one named deterministic tool
- assistant orchestrator: higher-level backend layer that accepts one assistant-style request, chooses the tool path by mode, formats a deterministic answer, and optionally persists chat messages
- model provider: future external LLM dependency that would decide or help decide which tools to call and how to generate final language
- future streaming chat: future user-facing interaction model that would add token/chunk streaming, intermediate state transitions, and multi-step tool/model loops

### 30-Second Chinese Pitch For Phase 3.1
鈥淧hase 3.1 鎴戝仛鐨勬槸 Assistant Orchestration Skeleton銆傚悗绔幇鍦ㄦ湁涓€涓?`POST /api/assistant/mock-turn` 锛屼絾瀹冧笉鏄湡姝ｇ殑 AI 瀵硅瘽锛屼篃涓嶈皟澶фā鍨嬨€傚畠鏄竴涓‘瀹氭€х殑 assistant 灞傦細鍏堟牴鎹?mode 閫夋嫨瑕佽皟鐨勫唴閮?tool锛屾瘮濡傝缁冩€昏銆佸崟鍔ㄤ綔杩涘睍銆佹帹鑽愪笂涓嬫枃锛岀劧鍚庡啀鐢ㄦā鏉垮寲鏂瑰紡鎶婂伐鍏风粨鏋勭粍瑁呮垚 assistant 鍥炲簲銆傚鏋滄彁渚?session_id锛岃繕浼氭妸 user message 鍜?assistant message 瀛樺埌 `chat_sessions` 鍜?`messages` 琛ㄩ噷銆傝繖涓樁娈电殑鐩爣涓嶆槸鐢熸垚 AI 鍥炵瓟锛岃€屾槸鍏堟妸 assistant 鐨勫悗绔紪鎺掋€佽瘉鎹繑鍥炪€佷細璇濇寔涔呭寲杩欎簺鍩虹鑳藉姏鍋氱ǔ銆傗€?

## Phase 3.1 Deep-Dive Q&A

### Why use deterministic mock before a real LLM?
Because the first question is not whether the model can speak naturally. The first question is whether the backend assistant workflow is correct:
- is the request validated correctly
- is the right internal tool path chosen
- is user isolation preserved
- is evidence carried into the response
- can the turn be persisted safely

Deterministic mock behavior lets the team verify those decisions without blaming or depending on model behavior.

### How does mode-based orchestration help?
Mode-based orchestration narrows the problem on purpose. Instead of asking a model to decide what to do, the backend exposes a small set of explicit request intents and binds each one to one deterministic tool path. That gives:
- stable API behavior
- simpler testing
- easier auditability
- lower hallucination risk during the skeleton phase

### What does this prove?
Phase 3.1 proves that the backend can already support an assistant-shaped product workflow:
- one authenticated assistant endpoint exists
- internal tools can be orchestrated behind that endpoint
- tool results can be turned into assistant-style summaries and evidence
- optional chat session/message persistence can capture the turn history

This is meaningful because it shows the assistant architecture is becoming a product surface, not just an internal tool library.

### What is still not implemented?
Still intentionally not implemented in Phase 3.1:
- no LLM or model provider calls
- no streaming chat
- no SSE
- no multi-step model/tool loop
- no coaching recommendation generation
- no frontend assistant UI
- no `tool_call_logs.message_id` linkage to persisted assistant messages

### How will real model integration replace the mock selection later?
Later, the deterministic mode switch can be replaced by a provider-backed orchestration path:
- the request still enters through a product-owned assistant interface
- authenticated context and validation rules still remain on the backend
- the future model layer can decide which internal tool to call
- the same executor can still run those tools safely
- the final model response can replace today’s template response while keeping evidence and persistence expectations intact

The key architectural point is that real model integration should replace only the selection and language layer, not the deterministic data, validation, or ownership boundaries.

## Recommended Interview Summary
A concise version is:

“FitMind AI is being built as a training log system with a deterministic calculation layer underneath it, before any future AI explanation is added. Phase 1 established authenticated workout CRUD so the product owns real user training data. Phase 2 added deterministic summary and exercise-progress endpoints plus readonly UI. Phase 2.1 then added a Recommendation Context Builder endpoint that packages summary, focus exercise progress, recent workouts, and evidence into one structured deterministic backend context. The most important design point is that any future recommendation should sit on top of workout ids, set ids, and calculation rules, not on top of an untraceable chat experience.”
