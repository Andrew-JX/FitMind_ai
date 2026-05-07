# FitMind AI Project Study Guide

## 1. One-Sentence Positioning

FitMind AI is an evidence-backed AI training analysis system that connects real workout logs, deterministic calculation tools, Tool Calling, SSE streaming, and a mobile-first React assistant UI.

## 2. Resume-Ready Project Title

**FitMind AI - Evidence-Backed Training Analysis Assistant**

## 3. What This Project Is / Is Not

### Is

- A workout logging system with authenticated user data.
- A deterministic calculation layer for training summary, exercise progress, and recommendation context.
- A bounded Tool Calling architecture with a backend tool executor and provider adapter boundary.
- An SSE-based assistant streaming flow with a frontend assistant state machine.
- A mobile-first Chinese React UI that presents evidence-backed analysis and assistant answers.

### Is not

- A generic chatbot.
- A RAG system.
- An MCP system.
- A multi-tool agent loop.
- A medical advice system.
- A production-grade fitness coaching system.

## 4. 3-Bullet Resume Version

- Built an evidence-backed AI training analysis system that combines workout logging, deterministic analytics, Tool Calling, SSE streaming, and a mobile-first React interface.
- Designed a backend calculation layer that computes training summary, exercise progress, and recommendation context with traceable evidence instead of relying on raw LLM reasoning.
- Implemented a bounded assistant architecture with tool validation, provider abstraction, and frontend streaming state management to reduce hallucination risk and improve explainability.

## 5. 4-Bullet Technical Resume Version

- Built a full-stack training analysis product with React, TypeScript, Vite, Node.js, Express, PostgreSQL, Zod, JWT, and SSE.
- Implemented deterministic backend services for training summary, exercise progress, and recommendation context, with evidence fields such as `workout_ids`, `set_ids`, and `calculation_rules`.
- Added a controlled Tool Calling path with Zod-validated tool inputs, server-owned auth context, tool execution logging, and a provider adapter that supports `mock` and Anthropic-path integration.
- Shipped an SSE-driven assistant experience with explicit lifecycle events, incremental answer rendering, session continuity, and a mobile-first Chinese UI for training, analysis, and assistant workflows.

## 6. Architecture Overview

The high-level chain is:

React client  
-> API client  
-> Express routes/controllers  
-> services  
-> repositories  
-> PostgreSQL  
-> deterministic tools  
-> assistant orchestrator / provider adapter  
-> SSE stream  
-> frontend assistant state machine

The important architectural point is that data access, deterministic calculation, tool execution, provider integration, and streaming UX are separated. They are not all mixed into one chat endpoint.

## 7. Core Data Flow

The core product flow is:

Workout logs  
-> stored workouts and sets  
-> deterministic summary / progress / recommendation context APIs  
-> internal tools wrapping those deterministic capabilities  
-> assistant stream that can call those tools  
-> frontend state machine and answer rendering

This means the AI layer is not reasoning directly over raw workout tables. It is working on structured backend outputs that are already bounded and traceable.

## 8. Key Modules

### Training Log Module

- Supports workout CRUD, including create, list, detail, and delete flows.
- Supports set rows with exercise selection, reps, weight, RPE, warm-up, and notes.
- Keeps `set_index` logic grouped by `exercise_id` before submit on the client side.
- Refreshes workout list, summary, recommendation context, and selected exercise progress after create/delete flows.
- Keeps auth tokens in frontend memory rather than `localStorage`, `sessionStorage`, or cookies.

### Deterministic Calculation Layer

This is the most important trust foundation in the project.

Current capabilities:

- `training summary`
- `exercise progress`
- `recommendation context`

Why it matters:

- Numeric results come from deterministic backend logic, not model inference.
- Responses include evidence fields such as `workout_ids`, `set_ids`, and `calculation_rules`.
- Date inputs use `YYYY-MM-DD`, with half-open interval filtering to avoid end-of-day off-by-one errors.
- `estimated_1rm_kg` uses the Epley formula as a training signal, not medical advice.

### Tool Executor

- Registers a controlled internal tool whitelist.
- Validates tool inputs with Zod before execution.
- Does not accept `user_id` in tool args.
- Always derives `userId` from authenticated backend context.
- Logs tool execution metadata without exposing secrets or raw provider payloads.

Current internal tools:

- `get_training_summary`
- `get_exercise_progress`
- `get_recommendation_context`

### Provider Adapter

The provider adapter does not give the model direct system ownership. It places the provider behind a controlled boundary.

Current state:

- Supports `mock` provider.
- Supports an Anthropic provider adapter path.
- Uses `ASSISTANT_PROVIDER` for switching.
- Keeps provider SDK details out of controllers.
- The real provider path is still a non-streaming provider call.

Provider output stays normalized to:

- `message`
- `tool_call`
- `error`

The provider does not query the database directly, bypass the tool executor, or decide user ownership.

### SSE Assistant Stream

Current SSE event sequence includes:

- `state`
- `provider_selected`
- `tool_call_started`
- `tool_call_finished`
- `answer_delta`
- `session`
- `done`
- `error`

Why SSE matters:

- The user can see that a request has been accepted.
- The UI can show whether the system is thinking, calling a tool, or answering.
- The frontend can render `answer_delta` incrementally.
- The flow is easier to demo and easier to explain in interviews.

### Frontend Assistant State Machine

Current frontend assistant states:

- `idle`
- `thinking`
- `tool_calling`
- `answering`
- `done`
- `error`

Frontend responsibilities:

- Incrementally render the answer from `answer_delta`.
- Show the active tool call based on SSE lifecycle events.
- Display the selected provider.
- Reuse the backend `sessionId`.
- Support retry, stop, and clear conversation behavior.

## 9. UI Design

The current UI can be explained as three Chinese product tabs:

- `训练`: workout logging, workout history, and base stats.
- `分析`: deterministic analysis and evidence preview.
- `AI 助手`: tool-backed assistant explanation with SSE streaming.

Design characteristics:

- Chinese UI.
- Mobile-first workspace design.
- Productized cards, pills, and status surfaces instead of debug-only UI.

## 10. Security and Boundary Design

This section is important in interviews because it explains how the project limits hallucination and data leakage risk.

Current boundaries:

- Auth middleware owns authentication.
- Frontend tokens stay in memory.
- `user_id` is not accepted from the frontend or the model.
- Zod validation constrains tool args.
- A tool whitelist limits what can execute.
- The UI does not expose secrets or raw provider payloads.
- The model is treated as a constrained language layer, not a system owner.

## 11. Current Limitations

These boundaries should be stated honestly:

- No RAG.
- No MCP.
- No multi-tool agent loop.
- No real Anthropic token streaming.
- No second provider call after tool execution.
- No completed browser E2E test.
- Recommendation context is a deterministic preview, not medical advice.

The current system is an AI application chain, but it is still a bounded, single-turn, single-tool-priority assistant rather than a full agent system.

## 12. 30-Second Chinese Pitch

FitMind AI 不是一个通用聊天机器人，而是一个围绕真实训练日志构建的 AI 训练分析系统。它先通过 workout CRUD 把用户训练数据结构化存下来，再由后端 deterministic calculation layer 计算训练总览、动作进展和 recommendation context，并附带 evidence。然后这些能力被包装成内部 tools，由 tool executor 和 provider adapter 控制调用边界，最后通过 SSE 把 assistant 状态和回答流式推给前端。这个项目的重点不是让模型自由发挥，而是让 AI 回答建立在可验证、可追溯的训练数据之上。

## 13. 60-Second Chinese Pitch

FitMind AI 的核心不是“做一个聊天框”，而是先把训练分析这件事拆成可信的工程链路。底层先有 workout CRUD，把用户真实训练记录写入数据库；然后 deterministic calculation layer 负责训练总览、单动作进展和 recommendation context，这些结果都带 evidence，比如 `workout_ids`、`set_ids` 和 `calculation_rules`。接着这些确定性能力被封装成内部 tools，由 tool executor 做参数校验和安全执行，`user_id` 只能来自认证上下文，不能从前端或模型注入。模型层被放在 provider adapter 后面，目前支持 mock provider 和 Anthropic path，但真实 provider 仍然不能直接查数据库。最后后端通过 SSE 把 `thinking`、`tool_calling`、`answering`、`done` 这些状态流式推给前端，前端再用状态机和增量渲染把整个 AI 回答过程展示出来。所以这个项目强调的是 deterministic data、tool boundary 和 streaming UX，而不是一个无边界的 AI agent。

## 14. 2-Minute Technical Deep Dive

如果从技术链路讲，两分钟可以这样说：

FitMind AI 先从真实训练日志出发，而不是从 LLM prompt 出发。第一层是训练记录系统，包含认证、workout CRUD、动作搜索和 set 编辑，保证数据源是真实用户训练行为。第二层是 deterministic calculation layer，它把训练总览、动作进展和 recommendation context 做成独立后端能力，所有关键数字都来自后端计算而不是模型推断，同时返回 evidence 字段，方便追溯结果来自哪些 workout、哪些 set、用了什么 calculation rules。

第三层是 Tool Calling 架构。我们没有让模型直接访问数据库，而是先把这些确定性能力包装成受控 tools，再通过 tool executor 做 Zod 参数校验、工具白名单控制和执行日志记录。这里一个很关键的边界是 `user_id` 永远来自认证上下文，工具参数本身不允许带 `user_id`，这样可以避免跨用户数据泄露风险。

第四层是 provider adapter 和 assistant orchestration。assistant 请求进入后，后端先决定 provider 路径，再由 provider 返回规范化的 `message`、`tool_call` 或 `error`。当前已经有 mock provider，也有 Anthropic adapter path，但还没有 real token-by-token streaming，也没有 tool 执行后的第二次 provider call。第五层是 SSE streaming UX，后端会发 `state`、`provider_selected`、`tool_call_started`、`tool_call_finished`、`answer_delta`、`session`、`done`、`error` 这些事件，前端用状态机和增量渲染把 assistant 过程展示出来。

所以这个项目真正证明的不是“我接了一个模型 API”，而是我把训练数据、确定性计算、工具边界、provider abstraction 和前端流式交互串成了一条可解释、可验证、可演示的 AI application chain。

## 15. Interview Q&A

### 1. Why not put raw workout data directly into the prompt?

Raw workout tables are not the best abstraction for a model. If you dump raw workouts and sets into the prompt, the model has to decide how to aggregate them, how to filter dates, and which exercises matter. That wastes tokens and increases hallucination risk. A better design is to let the backend produce deterministic summary, progress, and context first, then let the model explain those stable results.

### 2. Why deterministic calculation layer?

Core training metrics should be reproducible, testable, and traceable without depending on model behavior. That gives users higher trust and makes the system easier to debug. In this design, the model is an explanation layer rather than the source of truth.

### 3. Why Tool Calling?

Tool Calling constrains the model to request controlled backend capabilities instead of querying the database directly or inventing its own aggregation logic. That keeps boundaries clear and makes the system easier to extend to other providers later.

### 4. Why must `user_id` come from auth context?

User ownership must stay authoritative on the server. If `user_id` were allowed from the frontend or the model, the system would risk cross-user data leakage. In the current design, `user_id` always comes from auth middleware, and tool schemas do not accept it as input.

### 5. Why SSE?

A single blocking HTTP response makes AI UX feel opaque. SSE lets the frontend show `thinking`, `tool_calling`, `answering`, and `done`, which improves user understanding and makes the assistant chain much easier to demo.

### 6. Why provider adapter?

Provider SDK details belong in infrastructure, not controllers or core product flow. The adapter lets the system define its own request and response contract first, then insert different providers behind that boundary.

### 7. How does the frontend state machine work?

The frontend sends `POST /api/assistant/stream-turn`, consumes SSE events, updates state from `state`, updates the active tool card from `tool_call_started` and `tool_call_finished`, appends assistant text from `answer_delta`, and keeps session continuity from `session` and `done`. `error` transitions the UI into a failure state.

### 8. How do you reduce hallucination risk?

The project does not claim to eliminate hallucination completely. It compresses risk by using deterministic calculations, a whitelist of tools, validated tool args, server-owned user identity, and evidence-backed structured outputs instead of raw prompt improvisation.

### 9. What is evidence in this project?

Evidence is the traceable backing for a result or answer, such as `workout_ids`, `set_ids`, `calculation_rules`, and tool-call metadata. It turns an answer from “a statement” into “a statement that can be traced back to workouts and calculation rules.”

### 10. What would you improve next?

The most reasonable next steps are:

- Add a real provider streaming path.
- Add the second provider call after tool execution.
- Add a bounded multi-step tool loop inside the same controlled architecture.
- Improve chat history and session browsing.

I would only evaluate larger additions like RAG, MCP, or more agent-like workflows after those core boundaries are stable.
