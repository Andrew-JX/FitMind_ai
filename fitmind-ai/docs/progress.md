# 进度记录（progress.md）

> 逐批次回顾：记录"已经做了什么"。与 `roadmap.md`（前瞻）配成一对。
> 本文件只保留**当前季度**；更早的记录已按季度归档到 `archive/progress-<年>-Q<季>.md`。
> 文档总索引见 `INDEX.md`。

**归档索引**

- [2026-Q2](./archive/progress-2026-Q2.md) — 156 条批次记录

---

## 2026-07-01 Tier 1：ENV 级 OpenAI-compatible BYO 模型

新增 `openai_compatible` 文本 LLM provider，用共享 `OPENAI_COMPAT_BASE_URL` / `OPENAI_COMPAT_MODEL` / `OPENAI_COMPAT_API_KEY` 覆盖助手和训练录入解析两条文本 seam。默认仍是 `mock` / 既有 Groq 行为；语音 STT 仍是浏览器 Web Speech API，RAG embedding 和每用户密钥 UI/存储不做。

- **Batch 1（env/config）**：`ASSISTANT_PROVIDER` 与 `WORKOUT_INTAKE_LLM_PROVIDER` 接受 `openai_compatible`；BYO base URL 只接受 `https`，空/非法视为未配置，不让 env load 崩；`provider-config` 新增 Groq preset + BYO config。验证：env 单测、type-check、改动文件 eslint/Prettier。
- **Batch 2（通用助手 client/provider）**：`groq-chat-client` / `groq-assistant-provider` 重命名并泛化为 `openai-compatible-*`；Groq 变 preset，BYO 走同一 adapter path。工具选择、意图救场、summary phrasing 均走 configured OpenAI-compatible client；telemetry provider/model 取实际 result，未知 BYO 模型 cost 为 `null`。验证：client/provider/intent/adapter/observability 单测、type-check、eslint/Prettier。
- **Batch 3（录入解析）**：`createWorkoutIntakeLlmParser("openai_compatible")` 接共享 BYO endpoint；Groq intake 也复用通用 client，收掉重复 fetch/model default；缺 BYO 配置不发 fetch，hybrid/rule fallback 继续兜底。验证：intake parser + hybrid + intent router 单测、type-check、eslint/Prettier。
- **Batch 4（文档）**：`.env.example`、`local-run-guide`、`api-contract`、`roadmap`、`ai-decisions` 同步；D43 记录 v1 共享配置限制和 Tier 2 backlog 安全要求。

已知边界：助手和录入解析若都选 `openai_compatible`，v1 共享同一 endpoint/model/key；一个 seam 用 Groq、另一个用 BYO 仍可混用。每用户 BYO UI + 加密密钥存储等到真实多用户需求出现再做。
## 2026-07-01 - Slice 8 Tier 1 weekly report digests

- Added `weekly_report_digests` with idempotency on `(user_id, iso_year, iso_week)` and owner-scoped dismissal.
- Added deterministic weekly digest generation behind `WEEKLY_REPORT_DELIVERY_ENABLED=off` by default, using existing weekly report service output and no LLM.
- Added `POST /api/cron/weekly-reports` with bearer `WEEKLY_REPORT_CRON_SECRET` auth; responses are counts only.
- Added authenticated `GET /api/training/weekly-report-digest` and `PATCH /api/training/weekly-report-digests/:id` for in-app display and dismissal.
- Added Cloudflare Worker `scheduled()` cron bridge (`0 9 * * MON`) that reuses `VERCEL_API_ORIGIN` and calls the Vercel API directly.
- Added a compact Assistant workspace weekly digest banner; no Web Push, VAPID, PushManager, service-worker push handler, notification permissions, or per-user preference UI.
- Documented D44, API contract, DB schema, and Tier 2 backlog. v1 uses UTC ISO weeks because there is no user timezone setting.

## 2026-07-01 C2：RAG reranking seam + Voyage in-process reranker

Added a swappable `KnowledgeReranker` seam to the RAG retriever and a first in-process Voyage rerank implementation behind `RAG_RERANKING_ENABLED=off` by default. Flag off preserves current retrieval behavior and does not call rerank.

Enabled pipeline: widened hybrid/keyword candidates (`max(limit * 4, 10)`) -> `filterRelevantKnowledgeChunks` lexical floor -> rerank -> final topK. Rerank only receives candidates that passed the lexical floor, and fail-safe fallback returns that same candidate order on missing key, timeout, API/schema failure, thrown error, or empty rerank output.

Observability is server-only: successful chunks use `retrieval_mode:"reranked"` and retrieval logs include safe rerank metadata (`status/model/candidate_count/total_tokens/estimated_cost_usd:null/fallback_reason`). Public answer sources stay unchanged and logs do not include raw query, raw documents, or `VOYAGE_API_KEY`.

RAG eval now reports top1/top3/MRR and per-case expected-source ranks. Reranked eval comparison uses an injected deterministic fixture reranker, not live Voyage, so regression gates remain offline, zero-cost, and reproducible. Live Voyage comparison remains manual opt-in only. Decision: ai-decisions D45; roadmap C2 marked complete.

## 2026-07-04 hardening-1 T0: Cloudflare config authority cleanup

Removed the stale root `test:integration` placeholder script and deleted `wrangler.json` so `wrangler.toml` is the only Cloudflare Wrangler config authority. The TOML file retains the weekly cron trigger (`0 9 * * MON`), while the removed JSON config had no `[triggers]` equivalent.

Verification note: the next Cloudflare deploy needs a visual check that the cron trigger remains registered after the config-file cleanup.

## 2026-07-04 hardening-1 T0.5: formatting debt cleanup

Cleared the historical Prettier debt in a formatting-only exception batch: ran `npx prettier --write .` under the existing `.prettierignore`, added `.gitattributes` with `* text=auto eol=lf`, and ran `git add --renormalize .` so line-ending normalization is paid down in one reviewable batch instead of leaking into later feature diffs.

Roadmap item E is now complete. From T1 onward, `pnpm format:check` is a normal hard gate for the whole repo because the historical formatting debt has been cleared.

## 2026-07-04 hardening-1 T1: 4xx user-input boundaries

Closed two user-input paths that could surface as server errors. Malformed auth cookies now behave like missing credentials, returning `401 UNAUTHORIZED` without attempting JWT verification. Malformed workout pagination cursors are prevalidated in the service layer via the repository cursor decoder and return `400 VALIDATION_ERROR` before any workout repository query runs.

API docs now state the workouts list cursor error contract. These are intentional boundary hardening changes: malformed cookie `500 -> 401`; malformed cursor repository-failure path `-> 400` before DB access.

## 2026-07-05 hardening-1 T2: OpenAI-compatible LLM timeout

Added a shared 20s timeout to the OpenAI-compatible chat client used by both Assistant provider calls and workout-intake LLM parsing. Timeout/abort failures now normalize to the existing provider failure shape (`attempted:true`, `ok:false`, `status:0`) with provider/model preserved and a sanitized timeout message; ordinary network errors keep their original messages.

Decision D46 records why chat completion uses 20s instead of the RAG rerank 2s timeout, how intake parser retries interact with timeout (`status:0` does not trigger the 429 retry; real 429 worst case is about 22s), and why `vercel.json` maxDuration is intentionally unchanged in this batch.

## 2026-07-05 hardening-1 T3: auth endpoint rate limiting

Added endpoint-specific in-memory rate limiting for `POST /api/auth/register` and `POST /api/auth/login` before their controllers run. Register is capped at 5 requests/min/IP; login is capped at 10 requests/min/IP. Both return the existing error envelope with `429 RATE_LIMITED` and `error.details.retry_after_seconds` when exceeded. Logout and `/api/auth/me` are intentionally unaffected.

`createApp()` now sets `trust proxy` to `1` for the Vercel single-proxy deployment shape. The review-relevant tradeoff is documented in D47: this trusts the nearest Vercel proxy hop for client IP derivation without trusting arbitrary leftmost forwarded values, but Cloudflare Worker -> Vercel traffic may still share a Worker egress IP bucket. The limiter remains per-instance memory state; distributed DB/Redis-backed limiting is a future roadmap item.

Verification coverage added: middleware tests cover allow, reject, and one-minute window reset with an injected clock; app tests inject a wide limiter for existing characterization routes and a narrow limiter to prove login is blocked before controller validation.

## 2026-07-05 AR-0 closeout: provider-error deterministic fallback

AR-0a through AR-0d are complete. AR-0a characterized the four provider failure classes and the former error behavior; AR-0b added the deterministic fallback seam with sanitized telemetry; AR-0c wired provider errors through the real default-tool or missing-argument guidance path, with normal structured output and SSE `done` instead of `error`; AR-0d records the shipped contract in ai-decisions D48 and closes the stale implementation wording in the AR arc plan.

The completed fallback is observable through `provider_error_fallback`, `provider_error_code`, `provider_error_message_sanitized`, `fallback_provider`, and `fallback_reason`; normal traffic explicitly records `provider_error_fallback:false`. Public DTOs remain unchanged, and fallback turns skip optional LLM phrasing. This closeout is documentation-only; DeepSeek still requires local live validation before AR-2, and numeric `provider_error_status` structured pass-through remains a separately reviewed backlog item.

## 2026-07-11 AR-1a: per-instance budget policy

Added the pure AR-1 budget parser and an injected-clock, in-memory per-instance
counter. The call budget reuses the existing string-key AI limiter seam and
resets with the cost counter at UTC midnight. Defaults remain `500` real-provider
calls and `$1.00` known estimated cost per instance per day; missing or malformed
budget values keep those conservative limits enabled.

D49 pins the distinct fail-safe directions: an unset emergency kill-switch means
live eligibility, while explicit true or malformed values engage it; budget
configuration is fail-safe limited. Unknown/BYO model cost (`null`) does not
advance cost, but the call-count floor remains active. This slice does not yet
wire the provider guard or change runtime traffic; AR-1b through AR-1d remain
required before AR-2.

## 2026-07-11 AR-1b: provider budget guard seam

Added a transport-agnostic provider guard that maps one budget-counter consume
into an allow or deterministic-mock fallback decision with server telemetry.
The seam forwards known or null post-call cost to the AR-1a counter and has no
HTTP, SSE, controller, provider, or orchestrator dependency; runtime wiring
remains AR-1d.

The default guard and counter are created once at module load and shared for the
warm process lifetime, while a factory permits isolated counter injection in
tests. D49 records that policy environment values are also parsed once: changing
the kill-switch or budget thresholds requires a process restart (a Vercel
redeploy), rather than acting as a no-redeploy real-time stop.

## 2026-07-12 AR-1c: per-IP AI limiter seam

Added an unmounted, injectable HTTP middleware seam for real-provider-eligible
assistant requests. It reuses the process-level string-key limiter style with
`ai:ip:<ip>:assistant`, enforcing `10/min` and `30/UTC day`, and records an
allow or deterministic-mock fallback decision in response locals without
returning a public 429. Existing per-user and auth limiter response contracts
remain unchanged; route mounting and orchestration consumption stay in AR-1d.

The middleware reads provider eligibility through
`getConfiguredAssistantProvider()` and does not consume quota in mock mode. D49
records that 30/day becomes the effective daily ceiling for a single-IP user and
that users behind a shared NAT intentionally share the same conservative public
demo allowance.

## 2026-07-11 AR-1d: orchestration wiring and AR-1 closeout

Completed the runtime wiring for the AR-1 guardrail stack. Assistant turn routes
now run auth, the existing per-user limiter, and the per-IP limiter before their
controller; saved-insight routes remain outside the provider/IP budget path.
Both JSON and SSE controllers pass the request-scoped IP decision into the
orchestrator.

The turn-scoped IP decision locks all real-provider calls when denied. After an
IP allow, routing, tool-selection, and optional phrasing each pass the shared
per-instance guard immediately before calling the provider. A first denial
locks the remaining turn without repeated guard consumption or duplicate
fallback. Both budget scopes reuse AR-0's deterministic default-tool or
missing-argument guidance path and complete normally with structured output and
SSE `done`.

Each returned provider call now records known estimated cost or `null` through
the AR-1b `recordCost` seam. Turn logs flatten independent instance/IP budget
scope and counter fields while preserving the separate
`provider_error_fallback` markers. Normal traffic records
`budget_fallback:false`; provider-error and budget telemetry cannot overwrite
one another.

Per-IP accounting deliberately consumes once at entry for every
real-provider-eligible turn, including turns that ultimately finish through a
purely deterministic, safety, or early-return path. Consequently
`budget_scope:"ip"` fallback telemetry means that the IP was already over its
turn allowance at entry, not that the system proved it prevented a paid call.
Mock mode consumes neither IP nor instance budget, so the shipped default keeps
zero runtime behavior change. AR-1 is now sealed and the AR-2 engineering
prerequisites are ready; D49 records the accepted semantics and serverless
per-instance limitations.

## 2026-07-16 AR-2 plan batch: flip checklist ready, awaiting user execution

Added the operator-owned AR-2 checklist for local DeepSeek live validation and
the later manual Vercel flip. The disposable verifier is documented inline and
must be materialized only as an untracked `.tmp.ts` file, then deleted. Its
database gate fails closed for remote `DATABASE_URL` values unless the operator
explicitly selects a scratch target or accepts possible Neon residue. The live
flow creates a disposable user, workouts, chat rows, and tool logs; cleanup is
best-effort, and the real live/budget-call scenarios incur small paid DeepSeek
calls.

The checklist pins provider-error fallback (`done`, not `error`), instance and
injected-IP budget fallback telemetry, kill-switch behavior, placeholder-only
Vercel secrets, post-flip log evidence, and both redeploy-based rollback paths.
No application code, `.env`, Vercel setting, or online environment changed.
This deployment runbook adds no new architecture decision, so it does not take
D50; D48 and D49 remain the governing contracts.

## 2026-07-16 weekly-report range-label trust fix

Fixed the ready-data weekly-report template so its summary, frequency label,
and main-exercise label describe the exact `result.range` instead of claiming
that every client-supplied range is “this week.” The regression test was first
used to characterize the former hard-coded wording, then intentionally flipped
to require the exact 2026-05-19 to 2026-06-17 fixture range. Faithfulness eval
goldens and the production-smoke assertion now enforce the same honest label.

This independent bug-fix batch does not change the client's default 30-day
range or add assistant-side date parsing. Interpreting an explicit “this week”
request as a natural-week query is recorded separately in the roadmap for
timezone and precedence design. No AR status or D-number is consumed.

## 2026-07-16 missing tool-argument 400 regression

Fixed the live-provider regression where “这个动作最近有进步吗” without an
`exercise_id` could reach `get_exercise_progress`, fail tool Zod validation,
and expose the English `Tool argument validation failed.` message through HTTP
400 / SSE `error`.

After execution-mode resolution, the orchestrator now checks the default
tool's request-supplied required arguments. Missing values reuse the AR-0
Chinese guidance path before provider selection, so the paid provider and tool
executor both receive zero calls and the turn persists normally with
`structured_output` + `done`. A successful provider that still returns a
missing/invalid tool call is caught at the `AiToolValidationError` boundary and
degrades to the same guidance without leaking provider/Zod text.

Server-only `assistant_turn` telemetry now distinguishes
`missing_required_request_args` from `tool_validation_error` under the
`tool_argument_fallback*` fields. Public DTOs and SSE event types are unchanged;
top-level request-schema validation remains a normal 400 boundary. Regression
coverage pins provider zero-call preflight, successful-provider invalid tool
calls, Chinese-only guidance, one `done`, no `error`, and unchanged normal
requests with `exercise_id` through the existing suite.

Verification: targeted assistant tests 38/38, full unit suite 463/463, lint,
and workspace type-check all passed before final `pnpm verify`.

## 2026-07-17 ER assistant entity-resolution arc: docs-only kickoff

Approved the ER arc plan from `origin/main@e4bd2fb` without changing application
code. ER is ordered by usability return: ER-1 reuses the existing deterministic
exercise matcher so free-text assistant turns can resolve `exercise_id`; ER-2
moves default-range semantics to the server and resolves supported relative date
terms in the device timezone with Sunday as the week start; ER-3 separates
out-of-scope, unrecognized, and actionable entity clarification copy.

The plan fixes the precedence contracts: current explicit exercise choice beats
message parsing, explicit dates beat message time terms, and parsed entities beat
clarification/defaults. Ambiguous or multiple exercises and conflicting supported
time terms are never guessed. The assistant exposes optional candidate buttons
while allowing a direct full-name reply; only the immediately preceding assistant
clarification can resume, and clarification messages cannot be saved as insights.
Pending state uses existing message JSON metadata, so no migration is planned.

The provider-cost boundary was reviewed explicitly. Entity parsing itself is
zero-LLM and runs before provider calls. Clarification triggers neither
tool-selection nor phrasing calls, but a deterministic intent-router miss may
still have invoked the existing guarded and billed intent rescue. Future tests
must assert those phases separately rather than claiming every clarification is
zero-provider.

ER-2 v1 intentionally does not understand arbitrary duration language such as
“最近三个月”. It falls back to the exact default 30-day range, and answer prose
must report the tool's actual `result.range` instead of echoing an unsupported
three-month claim. Eval goldens will assert exact resolved dates and tool
arguments, never merely the presence of a “本周” label.

The implementation is divided into nine reviewable batches, each capped at five
code files. ER-1, ER-2, and ER-3 remain independent checkpoints with targeted
tests plus `pnpm verify` and `pnpm eval`; no migration, dependency, real provider
call, environment change, or deployment belongs to this kickoff batch. The full
approved contract and rollback sequence are recorded in `docs/er-arc-plan.md`.

## 2026-07-17 ER-1A: deterministic whole-message exercise extraction

Implemented the ER-1A pure-function seam in exactly five code files, with no
orchestrator or client wiring. `matchExerciseMentions` derives possible spans
only from the existing dictionary keys and `exercise-aliases`, selects longest
non-overlapping spans, and sends each phrase through `matchExercise` before
conservatively aggregating candidates. Exact single actions resolve; broad or
multiple actions remain ambiguous; unknown text never receives a guessed ID.

Broad “卧推” now includes available flat and incline barbell/dumbbell variants,
still capped at five candidates. The shared workout-intake regression was
updated to expect its available incline candidate too, keeping voice intake and
assistant extraction on one matcher contract rather than creating a second
assistant-only alias table.

Added the pure `resolveAssistantExerciseEntity` seam. It distinguishes a missing
exercise (`absent`) from a remaining unknown phrase (`unresolved`) while
delegating every actual match to the training matcher. Tests cover exact
“杠铃卧推”, no action, “卧推” candidates, two actions, longest
“上斜杠铃卧推”, unknown “火星推举”, and the five-candidate ceiling.

No API, request DTO, provider, persistence, SSE, or production behavior is wired
in this batch; that work remains ER-1B. Targeted matcher/intake tests pass 43/43.
Full `pnpm verify` passes 74 files / 473 tests, and offline `pnpm eval` remains
100% across intent routing, refusal, faithfulness, and safety.

## 2026-07-17 ER-1B: assistant server wiring and pending clarification

Wired D51's deterministic resolver into the assistant runtime in exactly five
code files. The semantic path is now safety → canonical dictionary/entity
resolution → intent routing/rescue → entity sufficiency → existing provider and
tool flow. A unique free-text action such as “杠铃卧推最近有没有进步” supplies
the existing `get_exercise_progress` path with its dictionary ID. An explicit
caller `exercise_id` remains authoritative over conflicting message text.

Missing, unknown, and broad actions now return a validated top-level exercise
`clarification` before tool-selection and phrasing. The response is actionable:
users can reply with a complete exercise name and do not need to visit the
analysis page. The original request/mode/intent, parsed entity state, and allowed
options live in the assistant message's existing metadata. Only the latest
assistant message in the owned session can resume; an allowed direct reply
consumes it, while any unrelated question routes normally and replaces it. No
migration or dependency was added.

Provider accounting tests distinguish all phases: deterministic-route misses may
perform one guarded, cost-recorded intent rescue; clarification performs zero
tool-selection and zero phrasing calls. Safety tests additionally pin that the
dictionary resolver and every provider phase remain untouched on a safety hit.
Clarification structured outputs are rejected by the server saved-insight path,
including otherwise eligible plateau intents.

Targeted assistant regressions pass 42/42. Full `pnpm verify` passes 74 files /
480 tests, and offline `pnpm eval` remains 100% across intent routing, refusal,
faithfulness, and safety. Client normalization, save affordance, and candidate
buttons remain ER-1C/ER-1D.

## 2026-07-19 Assistant 1RM and metric-weight presentation precision

Changed the assistant's shared kg presenter to deterministic nearest-0.5 kg
display. Raw Epley values such as `88.667` now render as `88.5 kg`; integer and
half-step output stays compact, and large training-volume values retain stable
thousands grouping. Training overview, weekly report, exercise progress, and
plateau evidence now use the same presentation contract. Tool/analytics output
objects are not mutated.

The central risk was verified rather than assumed: faithfulness parses the
rounded number from answer prose, while its acceptable-number set comes from the
raw tool result. Existing absolute 0.5 / relative 1% tolerance accepts the
presentation rounding. End-to-end tests pin fractional 1RM/max weight and
fractional overview/weekly volumes as rounded text with unchanged raw values and
`faithfulness.status:"verified"`.

Recorded a separate ER-1C backlog item for the reported free-text Evidence card
with four empty bullets. That client structured-output mapping issue is not
changed in this independent server presentation batch.

Targeted formatter/faithfulness regressions pass 42/42. Full `pnpm verify`
passes 74 files / 483 tests, and offline `pnpm eval` remains 100%.

## 2026-07-27 PL-1: truthful planned-workout mutation outcomes

Implemented the first batch of `assistant-usability-plan.md` without guessing at
the production PATCH failure. `useCurrentPlan.abandon` now returns
`Promise<boolean>`, and the assistant card waits for that result before showing
one success or failure toast. A failed request cannot emit 「已放弃本周计划」.
Both header actions are disabled while a mutation is in flight.

The refresh, accept, and abandon paths now preserve an `HttpClientError`'s HTTP
status and server message in `actionError`; only non-HTTP failures use the
Chinese fallback. This makes the user's single production retry actionable for
PL-2 while leaving the server and planned-workout API contract unchanged.

The Playwright regression drives a 500 response followed by a successful retry.
It pins the exact HTTP 500 message, absence of a false success, one settled
success toast, and the card's refresh to empty state. `pnpm verify` passes 74
files / 491 tests. The complete browser suite reports all 10 cases `ok`,
including the new regression; in this Windows sandbox the Playwright command
then hangs while reclaiming its self-started Vite process and is terminated by
the outer timeout after all results have printed.

## 2026-07-27 PL-3: expired plan lifecycle and archive action

Implemented client-side plan expiry without adding a UTC server lifecycle. A
pure date-only classifier compares the plan's `endDate` with the device-local
calendar date; yesterday is expired, today remains active, and month/year
boundaries require no millisecond or DST arithmetic.

Expired cards now read 「计划回顾」, carry an 「已过期」 status chip, preserve the
plan's real date window and final adherence, and make 「归档」 the primary action
while retaining 「放弃计划」. Archive writes `completed`, so the closed plan stays
eligible for future D42 adherence context; the existing `/current` refresh then
returns the established empty state.

PL-1 review findings R1/R2 are included. Missing token/plan early returns now
write a visible `actionError`. Accept, abandon, and archive only return a success
signal after both their mutation and follow-up refresh complete, so a refresh
failure leaves the card in place and cannot emit a success toast.

Classifier unit tests pin yesterday/today/tomorrow, cross-month, cross-year, and
timezone-independent string comparison. Playwright pins expired copy, the
`completed` PATCH body, archive rejection without optimistic clearing, and the
PATCH-success/refresh-failure path. `pnpm verify` passes 75 files / 497 tests;
the focused `ui-finishers` suite passes 7/7 with a green exit. The full browser
suite reports all 13 cases `ok`; as in PL-1, the parallel Windows run then hangs
while reclaiming its self-started Vite process and is terminated after all
results print.

## 2026-07-27 — 色值 token 收口 + 前端现状文档重写

**Token 收口（`1812dba` + `442fee9`，计划见 `color-token-consolidation-plan.md`）**

`UI_SPEC §1.1` 写着"组件内部禁止硬编码色值"，实际 `client/src` 里散着 32 处品牌色字面量，且每轮 UI 批次都在增加。外部锐评点出了这个数字（准确），但把成因判成"知道有 token 却偷懒"，并建议全部改用 `theme.colors.ac` —— 照做会砸掉浅色主题：`ac` 浅色是 `#5c7404`，而设计交接文档把品牌按钮 / FAB / Logo / Toast 列为两主题相同。

真正缺的是**一个主题不变的品牌 token**。逐处分类后：21 处品牌不变色 → `BRAND_NEON` / `brandAlpha()`（零渲染变化，实测 computed style 与迁移前一致，并用临时 Playwright 探针确认切浅色后 FAB / Toast 描边 / 发送按钮仍是霓虹）；8 处双主题都刷霓虹的色底 → `accentAlpha()`（浅色可见变化，已截图）；3 处本来就主题感知、只是写成字面量 → `accentAlpha()`，顺带消灭一个 tokens 里不存在的第三种绿 `#4a8c00`。

T-3 加了 ESLint `no-restricted-syntax`，字符串与模板块内的品牌字面量一律报错，仅豁免 `tokens.ts` 与钉值测试；**演示**过它有效（塞回一处 → lint 从 0 错变 1 错）。至此 §1.1 从一句话变成门禁。

**前端现状文档重写（roadmap §8.2 E1）**

`frontend-current-state.md` 542 行里 505 行是 2026-05-07 快照。它不只是过时 —— §10 是**有害**的：`UI_SPEC §8` 引用它当"重构不可破坏"的权威清单，而其中写着"不改 token 的内存保存逻辑、不把 token 写入 cookie"，与 D19 的 HttpOnly cookie 会话直接冲突；另有三条在保护已删除的东西（`TrainingSummaryPanel`、分析页的 `RecommendationContextPanel`、点选动作驱动 quick prompt 的旧联动）。

重写为 82 行：现状速览（只记变化慢的结构性事实）+ 仍成立的约束（含从 D 系列提炼的诚实性条款）+ 保留的增量决策记录。明确声明**不再镜像代码** —— 上一版正是因为镜像代码才烂掉。同步修正 `UI_SPEC` 两处"第 10 节"引用与 `roadmap` 的 E1 状态和 Last updated 时间戳。

顺带发现 `AthleteProfileButton.tsx` 已无人引用（档案入口随设计稿改版移进了个人 Tab 的 `ProfileView`），与 `AssistantStatusRail.tsx`、`AssistantToolCallCard.tsx` 一并记为待清理死代码。

