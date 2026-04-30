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

## Recommended Interview Summary
A concise version is:

“FitMind AI is being built as a training log system with a deterministic calculation layer underneath it, before any future AI explanation is added. Phase 1 established authenticated workout CRUD so the product owns real user training data. Phase 2 added deterministic summary and exercise-progress endpoints plus readonly UI. Phase 2.1 then added a Recommendation Context Builder endpoint that packages summary, focus exercise progress, recent workouts, and evidence into one structured deterministic backend context. The most important design point is that any future recommendation should sit on top of workout ids, set ids, and calculation rules, not on top of an untraceable chat experience.”
