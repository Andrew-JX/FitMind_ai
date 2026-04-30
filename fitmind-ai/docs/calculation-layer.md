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
