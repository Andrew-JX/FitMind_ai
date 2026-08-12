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

## 2026-08-03 — 同意接缝：从「界面上问过」到「系统能证明」

**返工，不是新批次。** `legal/deployment-accurate` 被审查退回第四次，九条 finding 我逐条
复现，**全部属实**。其中只有两条我有措辞级修正（39 条那条 commit message 里并没有出现
「完整告知」四个字；重复提交那条只存在于会话叙述里、仓库 grep 不到），实质都成立。

**核心问题一句话**：`c518b0a` 的标题写着 "require cross-border consent before creating an
account"，而同意只活在 `AuthScreen` 的提交函数里 —— `RegisterRequest` 和服务端 zod schema
里根本没有同意字段，`curl` 直接打 `POST /api/auth/register` 照样建号，数据库里也没有任何
记录能证明谁在什么时候同意了哪一版。它改善的是**用户看到了什么**，没有改善**系统能证明
什么**，而提交标题把后者说成了前者。

落地七条规格（`china-launch-plan.md` §6.2a 有对照表）：只读注册政策端点、API 强制同意、
与用户行同事务写入、UI 依服务端状态如实关闭注册入口、客户端发送勾选结果、绕过与回滚测试、
老账号真实补签。

**两个「哪种错法更贵」的决定**：`DATA_RESIDENCY` 失败即境外（未配置的境内实例多一个勾选框
= 打扰；未配置的境外实例无同意出境 = 违法）；敏感信息同意与档案写入**刻意不同事务、且
同意在先**（同意落了档案没落 = 授权了一件没发生的处理，惰性；反过来 = 存了敏感数据却没
授权，就是违法本身）。

**没有回填迁移，而且不会有。** 老账号通过 `/me` 的 `pending_consents` 浮出来，在
`ConsentCatchupScreen` 被阻断式问一次。回填一行同意等于替用户签字 —— 作者线下通知过他们，
但**被通知不等于同意过**。

**顺带查出四处「文档描述 ≠ 系统实际」**，都不在原 finding 里：

1. 隐私政策声称收集「身高、体重、训练年限」——**这三项从来没有对应的列**；同时漏写了
   真正在收的伤病约束、可用器械、反馈的 `user_agent`。已按迁移逐字段核对重写。
2. `db-schema.md` 写着「用户可以通过 `DELETE /api/me` 触发账号注销」——**这个端点不存在**，
   全仓 `router.delete` 一个都搜不到。
3. 同一节「训练记录里不存敏感个人指标」把「不存身高体重」错误推广成了「不存敏感信息」，
   而 `injury_constraints` 恰好是本项目唯一一类敏感个人信息。
4. `neon.com/privacy-policy` 现在 **308 跳转到 `databricks.com`** —— Neon 已被收购，隐私
   政策里的接收方主体与链接可能都失效了。**接收方变更是 39 条要重新告知的事项。** 我拿不到
   权威页面（域名被网络策略挡住），所以**没有编一个联系方式填进法律页**，而是如实披露正在
   核实、并给出代为行权的渠道。Vercel 一侧已核实并填入。

**门禁**：`pnpm verify` 89 文件 / 652 单测（原 87/616）、`pnpm eval` 15·14·3·20、
`pnpm test:e2e` 22/22（新增 7 条注册与补签用例）。全部新门禁都做了回退演示 —— 拆掉
`assertCrossBorderConsent` 有 4 条红，把 `ROLLBACK` 改成 `COMMIT` 有 1 条红，把密钥塞回
trim 白名单有 1 条红。

顺带撤销了 `0b0c58c` 的全量 secret trim：它遍历所有 schema key，会改动 `JWT_SECRET` 的
字节 —— 现网密钥若以空白结尾，部署后旧 cookie 全部失效，且日志里什么都看不到。改成显式
白名单（枚举 + 模型标识符），新加的密钥默认落在安全的一侧。

**关于 e2e 耗时的记录，我报错了一次。** 我写过「22 条 14.7 秒干净退出」并据此说审查提的
「超 120 秒不退出」没复现。重跑后实测 `elapsed=201s`，Playwright 自己打印 `22 passed (3.3m)`。
一次快的观测不构成「稳定 14.7 秒」这个事实，我却把它当事实写进文档还用来反驳审查——
和本文档反复在犯的错是同一个：**把一次观测当成一个性质**。e2e 耗时目前不稳定，原因未定位，
记为待查。

## 2026-08-03（第二轮）— 审查退回：闸门只存在于客户端

第二轮审查退回，**九条里我认全部**。最重的一条我要单独记：

**我在 `use-auth.ts` 的注释里写了「真正拦截的 gate 在服务端」，而当时服务端根本没有这个
gate。** `authMiddleware` 只验 JWT，之后没有任何欠同意拦截；老账号拿 cookie 或 Bearer token
直接打训练、助手、反馈、档案任一端点，畅通无阻。所谓「阻断」只在 `App.tsx` 里——那是渲染
决策，不是控制。更糟的是我用这个不存在的 gate 当理由，把客户端缺字段时的默认值做成了
fail-open。

**这是本弧线第五次犯同一个错的第二个变种**：第一次是把想做的写成做了（`c518b0a` 的标题），
这次是把想做的写进注释、再拿注释当依据做设计决定。前者骗读者，后者连自己一起骗。

修法：闸门做进 `authMiddleware` 并**默认开启**，`/me` 与 `/consents` 显式用
`authMiddlewareAllowingPendingConsents` 豁免（不豁免会死锁：用户既看不到欠什么也没法签）。
选这个形状而不是「给每个业务路由加一行」，是因为后者依赖以后没人忘记。两个变体各自带
可区分的函数名，路由接线测试因此从「挂了某个 auth」升级成「挂的是带闸门那一版」。

**第二个洞：`POST /api/auth/consents` 能凭空写健康同意。** 任何已鉴权用户都能先提交一条
`sensitive_health_data`，再回头保存伤病数据——`ensureSensitiveHealthConsent` 看到库里已有
记录就直接放行。于是「填写那一刻单独问」退化成「想什么时候问就什么时候问」，同意与它授权
的处理脱钩。修法：该端点只结清**数据库认定当前确实欠着**的同意，新数据的健康同意只能随
PUT 档案取得。

**测试方法论也被驳回了，驳得对。** 上一轮我说「测试必须绕过客户端直接打 API」已完成，实际
交付的是 service 单测 + Playwright 里一个会伪造注册成功的 mock，两者都不经过 Express、注册
闸门、zod controller 和真实 service 接线——而那正是 `curl` 走的路。新增 `consent-http.test.ts`
用 `createApp()` + `listen(0)` + `fetch` 说真 HTTP，只把仓储替换掉：无同意注册 422、欠同意账号
打 `/api/workouts` 403、补签后放行、无伤病数据不能预写健康同意。把闸门默认值翻成 false，
这些用例会红。

**Neon 主体查到了**：`Neon, LLC`（Databricks, Inc. 关联公司），`privacy@neon.tech`，取自其
现行官方服务条款与 Trust Center。上一轮我说「拿不到权威信息所以写核实中」——**那是放弃得
太早**，不是无法获得。隐私政策已按 39 条补齐名称与联系方式，并把第五节开头从「账号、训练
记录、助手对话」三类扩到第一节的全部类别。

**版本号对照那句话也被我写成了空头支票**：政策页说用户可以把版本号和应用内显示的对照，但
只有补签页显示版本号。注册页与档案页现已补上。

顺带修了三处「把目标写成事实」：PUT 档案实际只返回 `{ profile }`（契约文档写了两个字段，
现已让 controller 真的返回两个）；契约说档案表单用 `/api/auth/consents`（实际内嵌在 PUT）；
政策第九节说「没有应用内变更提示机制」，而版本号提升本就会触发补签页阻断询问。

**补充（同一轮，用户拍板后）：拒绝要有真实出口。**

审查第 3 条指出「暂不同意并退出登录」并没有停止无同意处理——数据照留在境外库里，页面却
暗示处理会停。用户选择了「提供当场删除账号」。于是：

- 新增 `DELETE /api/auth/account`，级联删除 9 张表（含 `user_consents` 自己）。
- **它用 `authMiddlewareAllowingPendingConsents`，欠同意时也能调用。** 拒绝同意的人正是最
  需要这个出口的人；把删除挡在同意闸门后面，等于让人既不能同意也不能离开。
- 补签页把两个出口**分开摆、分开写**：退出登录只结束会话，删除才停止存储。脚注从「不同意
  不会删除你已有的数据」改成明说「**只退出登录不会停止存储**」。二次确认后才发请求，失败
  时明说「你的数据没有被改动」——删除失败最怕用户以为删掉了。

顺带把 `db-schema.md` §6 又改了一次。它的历史是这样的：最早写「用户可以通过 `DELETE
/api/me` 注销」（端点不存在），上一轮我改成「注销是人工流程」（属实），这一轮改成自助
接口（因为实现补上了）。**三次里只有这一次是实现追上文档，前两次都是文档在替实现说话。**

关于公开注册开关：审查建议核实 Neon 签约主体前先关闭，用户选择保持开放。主体与联系方式
已按 Neon 现行官方服务条款与 Trust Center 填为 `Neon, LLC` / `privacy@neon.tech`；仍未核实
的是**本项目具体签约主体与数据库实际区域**，需要用户从账单/控制台确认。这一条记为未决，
不因为选择了保持开放就当它消失。

## 2026-08-04 — 第三轮退回：把「接口被拦住」说成了「处理已停止」

又是同一个形状，只是换了层皮。上一轮我修好了 HTTP 闸门，然后**把这个成果的适用范围说大了**：

- **「立即永久删除、无法恢复」**——实现只有一句 `DELETE FROM users`。它清的是活动库，
  完全没有涉及托管商的时间点恢复历史（Neon 的 history 窗口最长可到 30 天）。这句话是我
  自己写进法律页和 UI 的，**代码从来证明不了它**。改成「从活动数据库删除并立即停止一切
  业务处理；备份与历史副本仅用于灾难恢复、不用于业务处理，在保留期届满后清除」。
- **闸门只管 HTTP。** 周报 cron 直接枚举用户，绕开一切请求层拦截。`WEEKLY_REPORT_
DELIVERY_ENABLED` 默认 off 只是让这个洞睡着，不是没有洞。现在选人 SQL 里带同意过滤，
  服务层再独立查一次——一个 WHERE 子句是合规控制的单点故障，改错了还不会报错。

**两个新洞是这轮真正的收获，都不是「说法」问题：**

1. **不可逆删除只凭一个 7 天有效期的会话。** 端点不收密码、不收任何重认证材料。UI 上的
   二次确认拦不住直接调 API 的人——攻击者用的不是 UI。现在要求当前密码，服务端
   `comparePassword` 校验，密码不符 401、缺字段 400，都不删任何东西。
2. **欠健康同意的用户被逼成「同意或删号」。** `athlete-profile` 整个路由在闸门后面，所以
   他们进不去 `PUT` 把伤病字段清空，只剩三条路：违心同意、退出但数据照存、删掉整个账号
   连同全部训练历史。这是 PIPL 第 15 条（便捷撤回）和第 16 条（不得因拒绝无关同意而拒绝
   服务）正对着的陷阱。新增 `DELETE /api/athlete-profile/injury-constraints`，走闸门豁免，
   服务端**只**把 `injury_constraints` 置空——目标、天数、器械是用户同意过的一般个人信息，
   顺手删掉会让撤回的代价高于它应有的样子。删完之后 pending 自动消失：不再存敏感信息，
   也就没有要征求的同意了。

**第四轮退回（同日）：又把「接口被拦住」说大了一圈。**

上一条我写「五条全部已修」，准确说法是两条修成、三条部分修成。六条新 finding 我逐条复现，
**全部属实**，只有第 6 条的机制描述我要修正（见下）。

- **一个请求最多穿过 5 道 gate。** 多个 router 挂在同一个 `/api` 前缀，各自用无路径的
  `router.use(authMiddleware)` 自我守卫——而无路径 `use` 会对**所有**路由进该 router 的请求
  执行，包括它没有 handler 的路径。于是 `GET /api/workouts` 依次穿过 assistant、feedback、
  athlete-profile、planned-workouts 四道，再到 workouts：五次 JWT 校验、五次同意查询，每次
  还各自新建并关闭一个 Pool。
- **这个问题已经在生产代码里咬过一次了**：`POST /api/cron/weekly-reports` 本该不鉴权，
  但它挂在最后，被前面的 gate 拦成 401——**这个端点一直是不可达的，没人发现**。我用探针
  确认了返回体是中间件的 "Missing authentication credentials"，不是控制器自己的
  "Invalid cron credentials"。
- 处置：每个无路径 gate 改成带上**它自己实际拥有的路径前缀**；中间件按请求 memoize（认证与
  闸门各一次）。三条回归测试钉住：一次请求只查一次同意、cron 可达、业务路由仍然 401。
- **PITR 会复活已删账号**，而我写的「不会用它们来重建已被删除的账号」没有实现支撑。整库回滚
  是整库操作，跳不过某几行。改法两步：文案如实承认这一限制；删除时向**数据库之外**的平台
  日志写一条 `account_deleted`（只含 user_id 与时间戳），因为放在 Postgres 里的台账会被它
  唯一要应对的那次回滚一起抹掉。恢复后的重放步骤写进 `china-launch-plan.md` §5.1。
- **撤回只删数据、没撤销同意**：下次再填伤病时 `ensureSensitiveHealthConsent` 会看到那条仍
  然有效的同意直接放行——一次会自己解除的撤回。加 `revoked_at`（迁移从未执行过，直接改），
  所有判定改为 `revoked_at IS NULL`。**行保留不删**：它仍是「这段时间里处理是被允许的」的
  证据，删掉会让撤回和从未同意过无法区分。
- **删除重认证没有限流**：登录限流盖不到它，拿到 7 天会话的人可以无限猜密码，每猜一次还买
  一次故意很慢的 bcrypt。加 3 次/分钟。
- **「重复删除返回 200」是假证明**：那条测试让 `findUserById` 仍返回用户、只让删除报 0 行，
  模拟的是并发删除竞态，不是第二次请求。真实第二次请求查不到人，返回 401。测试与契约都已
  按真实行为改写。**一个只在假场景下成立的断言，比没有断言更糟。**

**一处我要修正审查的描述**：第 6 条说「两步包在同一个 Promise，任一步失败都会显示删除失败」。
`refreshAuth` **内部 catch、从不抛出**，所以那条路径走不通——只有 `withdrawInjuryConstraints`
抛出才会出那句话，而那时它是准确的。但真实缺陷确实存在，形状不同：`/me` 失败时
`handleAuthFailure` 会**清掉会话**，用户在一次成功的隐私操作之后被静默登出并看到鉴权错误。
改法比包 try/catch 更干净——本地摘掉那条 pending，根本不做这次往返。

**第五轮退回（同日）：两个新 P1 是我自己上一轮引入的。**

六条全部复现属实，其中两条是上一轮修复的直接副产物：

- **再同意会抹掉同意与撤回的全部历史。** 我用完整唯一约束 + `ON CONFLICT DO UPDATE` 实现
  `revoked_at`，于是「授予 → 撤回 → 再授予」被迫复用同一行：第二次授予刷新了 `accepted_at`、
  清空了 `revoked_at`，**第一段合法处理区间和那次撤回一起消失**。而我在同一个文件里写着
  「保留行作为当时获准处理的证据」——实现直接推翻了自己的注释。改成**部分唯一索引**
  （`WHERE revoked_at IS NULL`）：同一版本同时只有一条有效，历史行任意多条并存，同意变成
  append-only，撤回是盖章封存而不是腾位置。
- **清数据与撤销同意不是一个事务。** 我写了「数据先、权限后，若只落一个，残留是无害的」——
  这个论证本身就是错的：第一步成功第二步失败时，数据已删、同意仍有效、请求返回失败，于是
  UI 照旧显示「你的伤病信息没有被改动」。**上一轮第 6 条以一条真实可达的新路径原样复活了。**
  排序解决不了这个问题，只有原子性可以。改成跨两表的单事务 `withdrawSensitiveHealthData`，
  并把两个非事务旧函数**删掉**——留着等于把不安全的路径摆在那儿等人用。

其余四条：`console.info` 撑不起 PITR 台账（平台日志保留 1 小时～1 天，**短于**数据库恢复
窗口的最长 30 天，恢复目标稍旧就查不到事件），承诺已从隐私政策撤回、代码注释改标为
observability、前置条件写进 §5.1；限流补上账号维度（分布式计数仍未解决，已在注释里写明是
「抬高成本，不是设上界」）；三处过期注释与 `db-schema.md` 缺的 `revoked_at` 已补。

**回退验证暴露了一个我自己的缺口。** 把 append-only 改回完整唯一约束之后，**没有任何测试
变红**——我给这个设计写了长篇理由，却没有给它门禁。补了两条 SQL 文本级断言后再回退，才真
的红。这条要记住：_写了理由不等于钉住了行为_。

**数字更正**：上一轮我报「工作树 55 项」。我确实跑过命令，但之后又改了文件，把旧值当成当前
值写进了回复。实际是 60 项（51 已跟踪 + 9 新增）。**一个真实命令的旧输出，和凭印象一样会
骗人。** 报数字前重跑，不要复用上一次的结果。

**真实 PostgreSQL 验证已完成（2026-08-04，用户启动 Docker 后）。**

连续五轮记为「未验证」的那一条闭环了。Docker Hub 拉不动镜像（TLS 握手超时），改用本地已有的
`monashfit/fit5137-postgis`（PostgreSQL 14.9）。`server/scripts/verify-consent-sql.ts` 调
**真实 repository 函数**打真库，`verify:consent-sql` 可重跑（需 `CONSENT_SQL_TEST_DATABASE_URL`，见 db-schema §13.1）。

**当时 18 项全过**（2026-08-06 为 fitmind-lmy 扩到 41 项，见文末条目），其中两条是 mock 无论如何证明不了的：

- `ON CONFLICT ... WHERE revoked_at IS NULL` **确实推断到了那个部分索引**——没报错、返回同一
  行、`accepted_at` 未被改写、仍然只有一行；再插第二条有效同意被拒（`23505`）。
- **授予 → 撤回 → 再授予留下两行**，原始那行的 `accepted_at` 原封不动、`revoked_at` 仍在。
  这正是上一轮那个 P1 修好之后应有的样子，现在有真库证据，不再只是我对 SQL 的信心。
- 撤回事务中途失败后，`athlete_profiles` 与 `user_consents` **两张表一起回退**。
- `down` → 表消失 → `up` → 部分索引原样重建，重跑仍全过。

**这次没能覆盖的，如实记**：本地唯一可用镜像没有 pgvector，`20260607090000_add_knowledge_
chunk_embeddings.js` 被临时移出后才跑通全链（跑完已还原，`git status` 核对过）。所以
**「全部迁移在同一个库上依次 up」仍未验证**；生产是 Neon，版本也不是 14.9。

**顺带自己执行了一次版本号纪律。** 政策文本今天又实质变了（收集清单、接收方联系方式、
删除语义、撤回路径全都改过），而 `2026-08-03` 尚未发布给任何用户，所以提版到 `2026-08-04`
并补齐变更记录。同时把纪律写进政策第九节和 README：**一个版本号一旦发放出去，就不再在
它下面改实质内容**——否则存下来的同意记录无法证明用户看过哪一份文本，而那是记录版本号的
全部意义。四处版本串由 `consent-service.test.ts` 的同步测试钉住。

## 2026-08-06 — fitmind-9yz：档案保存与撤回同意的竞态

第一条走完整 Beads 流程的任务：规划者写定 8 条 acceptance → `bd update --claim` → 实现 →
逐条验证。

**问题**：`saveAthleteProfile` 先经一次连接查/写同意，再经另一次连接 upsert 档案；
`withdrawSensitiveHealthData` 只保证自身两条 UPDATE 原子。两条路径**互不串行化**，所以
「保存读到同意有效 → 撤回提交 → 保存写回伤病」这个交错能稳定构造出非法终态：**伤病数据
存在、有效同意不存在**。

**修法不是再包一层事务。** Postgres 默认 READ COMMITTED 下，两个事务各自完美原子、合起来
的结果依然非法。真正需要的是让两条路径在同一把锁上排队：`SELECT id FROM users WHERE
id = $1 FOR UPDATE`，锁在最前，锁内完成「读同意 → 写同意 → 写档案」。

两条路径合并进 `server/src/db/user-health-data-repository.ts` 的同一个 `withLockedUser`
——锁顺序是一个可复查的事实，不是要从两个调用点拼出来的东西。旧的非加锁路径
（`ensureSensitiveHealthConsent`、`upsertAthleteProfile`、旧 `withdrawSensitiveHealthData`）
**全部删除**：留着等于留一条绕过锁的入口。

**并发验证让两个生产函数真的对撞**（`verify:consent-concurrency`，10 项全过）：第三个连接
先钉住 profile 行，先跑的生产函数就在事务里握着 `users` 锁停住，另一个生产函数只能堵在
`users` 锁上；两种锁顺序各一遍。屏障绑定到具体 backend PID（`pg_blocking_pids` +
`application_name`），并且要求等待方当时正卡在 `SELECT ... FROM users ... FOR UPDATE` 这条
语句上——等的是事实不是时间。回退演示两处各拆一次（共享锁、锁内同意重读），都变红，
输出正是原始 bug：`{"injuries":1,"liveConsents":0}`。

> 这一段是第 9 轮退回改出来的。上一版脚本的场景 B 标着「保存先拿锁」却从没调用保存，
> 场景 A 让生产的保存去撞手写 SQL；8 项全绿，证明的却是另一件事。**验证了一个东西然后声称
> 另一个东西**——同一种错法，这次出现在为了证明修复而写的那个脚本里。
> 另一处同样的形状：只断言「谁等谁」时，把共享锁拆掉断言依然绿（保存改成在 profile 行上
> 排队，`pg_blocking_pids` 照样把撤回算作阻塞者）。断言必须连「卡在哪条语句上」一起钉。

**回退演示自己也出了一次问题，值得记。** 第一版去掉锁之后不是失败，是**挂死**：测试自己
持锁，未串行化的写排在它后面，清理又排在那些写后面。已加 `lock_timeout` /
`statement_timeout`。**一个在守卫被拆掉时会挂死的回归测试不算门禁**——没人分得清挂死和
机器慢。

**顺带发现**：`server/tsconfig.json` 的 `include` 只有 `src/**/*.ts`，所以 `scripts/` 不在
type-check 范围内。移动导出时 `verify-consent-sql.ts` 的旧 import 没有报错，直到运行才
炸。已修 import；**把 scripts 纳入 type-check 属于本 issue 之外的改动，交给规划者**。

## 2026-08-06 — fitmind-lmy：清空伤病没有撤销同意，且撤回入口找不到

**两个问题，一个语义。** 服务端把「归一化后为空的 `injuryConstraints`」当成一次普通 upsert：
清了数据，那条 `sensitive_health_data` 同意仍然有效。于是用户下次再填伤病，锁内重读看到有效
同意直接放行——**一次会自己解除的撤回**。客户端那边，唯一的撤回入口在补签页
（`ConsentCatchupScreen`），而一个同意已经结清的账号永远不会看到那一页：**一个用户找不到的
权利，不是他拥有的权利**（PIPL 15）。

**修法：清空即撤回，写在服务端。** `saveProfileWithHealthConsent` 在原有的 `withLockedUser`
事务里，伤病列表为空时清档案 + 撤销同意。撤销抽成一个私有的
`revokeLiveHealthConsents(client, userId)`，`withdrawSensitiveHealthData` 也改调它——**两个
入口，一条语句**。它接收 client 不接收 pool：在这里自己开连接就是第二个锁顺序。撤销不按
`policy_version` 过滤（撤的是类别，不是某一版措辞），不碰其他同意类型，靠
`revoked_at IS NULL` 保持幂等且不改写原来的撤回时间戳。

**按钮是补入口，不是补语义。** 先把服务端语义修对，再在 `AthleteProfileSheet` 里加显式撤回
（两步确认，成功后只重置伤病相关状态，目标/天数/器械的草稿改动一律不动）。反过来做——只加
按钮——会让「清空再保存」这个更自然的动作继续是个陷阱。

**证据**（真库 PostgreSQL 14.9，`verify:consent-sql` 由 18 项扩到 **41 项全过**）：清空后
同意失效、跨境同意不受影响、其余档案字段保留；重复空保存不新增行也不改写 `revoked_at`；
无新同意再填被拒且什么都没存；带新同意成功且旧撤回行作为历史保留。**两侧回滚各注入一次**
（`INSERT INTO athlete_profiles` / `UPDATE user_consents`），两次都断言伤病数据与有效同意
双双仍在。`verify:consent-concurrency` 保持 10/10。

**浏览器覆盖**（`client/e2e/injury-withdrawal.spec.ts`，5 条）：普通档案面板露出撤回入口、
两步确认、完成后表单与服务端状态一致；撤回不动目标与每周天数；再次填写会重新弹出同意勾选；
手动清空再保存发出的是空列表；没有可撤回内容时控件不出现。

**回退演示两处**：把仓储层的撤销调用去掉 → 6 条单测红；把 UI 的显示条件写死为 false →
2 条 e2e 红（其余 3 条仍绿，说明红得精准而不是全线崩）。

**e2e 这次的耗时如实记**：功能断言全过，但整轮 9.3 分钟而单条用例各约 3 秒——这是
`fitmind-yi7` 的退出挂起被复现了一次。后一次同文件只用 37 秒正常退出，可作对照，但**不抵消**
那次挂起，`yi7` 保持 P1。

**顺带修掉一处上一轮没扫到的旧说法**：`docs/api-contract.md` 的 PUT 一节仍写着「同意先写、
档案后写，刻意不放在同一个事务里」。上一轮我只 grep 了已删除的函数名，这段没提函数名所以
漏了——**按符号搜索找不到用散文写的陈述**。

## 2026-08-06 — fitmind-lmy 第二轮：两处「只在想象的场景里成立」的判断

审查退回三条，全部属实，其中两条 P1 是我自己上一轮引入的。

**1. 旧版本措辞下的同意撤不到（P1）。** 撤回的 SQL 我特意不按 `policy_version` 过滤——用户撤的
是类别不是某一版措辞——但驱动界面控件的标志用的是只认当前版本的 `health_consent_on_file`。
**同一个概念两套判据**：服务端撤得掉、用户看不见。这类账号也不会被补签页问到（补签只在存有
伤病数据时才问 health 同意），那条有效同意对他们完全够不到。这正是本 issue 要修的那个形状，
被我在修它的过程中重新造了一遍。

修法不是加第二个标志去对齐，而是把谓词抽成导出的 `LIVE_HEALTH_CONSENT_PREDICATE`，撤回语句
和 `hasWithdrawableHealthConsent` 查询共用同一段 SQL——不是两处保持一致，是同一处。
`hasHealthConsent` 保留且必须保留：它回答「今天能不能存」，按版本过滤；新字段回答「有没有
授权可收回」，不按版本。合并会压掉勾选框、让保存以一个没被提醒过的 422 失败。

**2. 网络失败被当成「事务没提交」（P1）。** 撤回失败时无条件显示「你的数据没有被改动」，理由
是两处写入在同一事务里。事务原子没错，但**请求可以在提交之后才失败**——连接断开、超时、代理
放弃响应，都落进同一个 catch，而那时撤回已经成功。这句安慰恰好在用户最需要它是真的那件事上
说了假话。现在失败后回读档案：已清空→按成功处理；数据还在→才说没被改动（此时是核实过的）；
回读也失败→「撤回结果暂时无法确认」。**不知道的时候说不知道。**

**3. 把 mock 状态称作「服务端状态」（P3）。** e2e 注释写的是「服务端还剩什么」，断言的是
`mocks.getProfileState()`。措辞已改：这是夹具在执行 `mock-api.ts` 里写下的契约，证明的是
客户端把撤回走通了，不是真实服务端做了什么；服务端侧的证据在 `verify:consent-sql` §6。

**新增证据**：`verify:consent-sql` 由 41 项扩到 **47 项**，新增 §9 打真库验证旧版本同意的两个
标志确实分叉（`hasHealthConsent` 假、`hasWithdrawableHealthConsent` 真）、撤回够得到它、
行是被 revoke 而不是删除、跨境同意不受影响。HTTP 层加一条「两个标志分别上报」。e2e 由 5 条
扩到 8 条（共 34 条），新增旧版本措辞可撤回、响应丢失后回读为成功、两次都失败时说不确认。

**回退演示三处，都确认真会红**：撤回改回按版本过滤 → 真库 2 项红、退出码 1；控件改回读旧标志
→ e2e 恰好那 1 条红；失败提示改回原来那句 → e2e 恰好新增的 2 条红。均已还原。

**过程中自己又踩了一次同一个坑，记下来**：第一版「响应丢失」e2e 用 spec 层
`route.fetch()` + `route.abort()`，而 `route.fetch()` 走真实网络、绕过了 mock 处理器——
**「写入已提交」这个前提根本没成立**，测试名和它实际验证的东西又一次对不上。这次是红的（输入框
还留着 "knee"）才暴露出来。改成由 mock 自己表达「已提交但响应丢失」（`dropNextWithdrawalResponse`），
因为拦在 mock 前面的任何写法都会让撤回压根到不了 mock。

**另外记一条环境事实**：这台机器没有 `python`。之前有两次改文件用 `python - <<PY` heredoc，
**命令静默失败、文件没动**，靠 grep 复核才发现。改用 node 重做。批处理里的编辑必须回读确认。

## 2026-08-06 — fitmind-lmy 第三轮：快照证明不了历史

一条 P2，属实。上一轮把「你的数据没有被改动」保留在了「回读成功且数据仍在」这条分支里，理由是
此时已经核实过。核实的是**当前状态**：回读拿到的是一张此刻的快照，它能支撑「数据现在还在、
所以撤回没完成」，支撑不了「从未被改动」——撤回完全可能已经提交，另一台设备随后又保存了一次。
两句话的差别不是语气，是一句在讲现在、一句在讲历史，而这次读取只看得见现在。

改成：「当前仍检测到伤病信息或相关同意，撤回尚未完成，请重试。」

新增 e2e「reports the current state, not a claim about history」：`DELETE` 返回 500、随后
`GET` 成功且数据仍在，断言显示上述状态，并断言**不出现**「没有被改动」和「无法确认」。
回退演示：措辞改回旧句 → 该用例红，其余 34 绿；已还原。

**写这条用例时我又写错了一个断言**：原本断言失败后「撤回伤病信息」触发按钮可见，实际失败后
界面停留在确认态，重试入口是「确认撤回」。是断言错了不是界面错了，改断言。记下来是因为它和
本轮主题同源——我又一次凭对行为的印象写断言，而不是照着行为写。

至此三种失败路径各有一条回归：响应丢失（回读为已完成）、拒绝（回读为未完成）、两次都失败
（说不确认）。


## 2026-08-06 — fitmind-yi7：时间花在关停 dev server 上

**第一版结论是错的，先记这个。** 我最初判定成因是 `pnpm dev` 让 vite 成了曾孙进程、被孤儿化后
攥着 stdout 管道。改成直连 vite 之后连续三轮 15–17 秒退出，我据此交了活。审查者独立复跑，
**35 条全过但命令 120.7 秒不退出**——三次干净运行只证明了运气，没证明修复。

**逐段计时才定位到位置**：最后一条用例 12.9s → **静默 148.2s** → 打印汇总 → 0.0s 退出。
时间既不在用例里（JSON 报告显示 35 条全在 5.4 秒内开始、单条 2–3 秒），也不在退出之后。

**单变量验证**：改由外部启动 vite、Playwright 只复用不负责关停，静默立刻 148.2s → 0.4s。
开销就是关停这一步。进一步打点确认是 Windows 的 `taskkill /T`（整树遍历终止），同机实测
**3.8 秒到 96 秒**不等。这个方差解释了全部三种面貌：整轮 15–166 秒跳动、外层 120 秒超时恰好
砍在汇总行之前、以及残留 server 污染下一轮。

**修法**：`client/e2e/global-server.ts` 接管生命周期。先用 Node 直接终止进程（立即返回），
只有进程或端口没释放才升级到 `taskkill /T`；server 的 stdio 用 `inherit` 而非管道；端口被占用
时拒绝启动并说明端口；关停后分别校验「进程已死」与「端口已释放」。
静默：**90–148 秒 → 0.3–0.7 秒**，三轮 `verify:e2e-exit` 全部自行退出。

**我在这条 issue 上犯的错，按被抓顺序**：

1. **量错了对象。** 第一版夹具测「最后一次输出 → 退出」，可那次输出正是迟到的汇总行本身，
   所以永远是 0.1 秒。要量的是「最后一条**用例结果** → 退出」。**验证了一个东西，声称另一个
   东西**——同一种错法，这次出现在为了证明修复而写的度量里。
2. **断言是空的。** 用 `code !== null` 断言「自行退出」，可被 taskkill 杀掉时同样有退出码。
   改成记录看门狗是否触发。
3. **夹具自己不是有界的。** 超时用 `child.kill()`，Windows 上只杀了 Playwright、孤儿了它的
   vite，夹具挂死要手工 taskkill。改成 await + 校验 + 兜底。
4. **写出过一段危险代码。** 为了枚举进程树用 `wmic /format:csv` 按位置解析，而列名是按字母序
   （`Node,ParentProcessId,ProcessId`），我取反了，于是 edges 表成了「子→父」，遍历爬的是
   **祖先链**并逐个 SIGKILL——会杀掉运行自身乃至更上层。表现为一轮 462 秒无汇总。
   已整段删除：teardown 现在只终止本文件启动的进程，以及占着目标端口的那个进程。

**排除的假设**：`/api` 代理 ECONNREFUSED 与本缺陷无关。Service Worker 只在
`import.meta.env.PROD` 注册，E2E 跑 dev server 根本不会注册。

**新门禁两个**：`verify:e2e-lifecycle`（13 项：成功/失败两侧的清理、端口被一台会正常应答的
陈旧 server 占用时拒绝启动）、`verify:e2e-exit`（连跑三轮根目录 `pnpm test:e2e`，量静默、
要求自行退出，预算 20 秒）。

**第三轮退回（同日）**：修复本身有效，但**修复的实现方式仍有三处越界或不设防**，都属实。

1. **「有界」是假的。** `global-server.ts` 和两个夹具都先无超时地 `await taskkill`，兜底逻辑写在
   它后面。可我自己刚测出 `taskkill /T` 会跑 96 秒——**边界写在被等待的东西外面就不是边界**。
   现在每条外部命令都带 `execFile` 的 `timeout`（10 秒），两个夹具的看门狗强杀也各自加了时限。
   实测：对一个 60 秒不返回的命令设 2 秒上限，2040ms 返回。
2. **可能杀掉不属于本轮的进程。** 本轮 server 已死后，代码会去查 5173 的占用者并强杀。若别的
   程序恰好抢了端口就被误杀。改成**报错不杀**。这和上一轮刚从这个文件里删掉的「遍历进程表」是
   同一类错误——越过自己拥有的东西去动手；我删了大的那个，却留了小的那个。
3. **源码里还挂着已被否定的旧根因。** `global-server.ts` 与 playwright 配置仍写着「孤儿 esbuild
   攥住 Playwright 管道」「teardown 会在树完整时枚举整树」，而实测结论是 `taskkill /T` 的方差、
   实现也是直接杀 vite 不枚举树。文档改了、代码注释没改，等于留了两份互相矛盾的解释。已全部
   按实测重写，并保留一句「这条假设曾被提出并被测量否定」，免得以后有人再推导一遍。

**第四轮退回（2026-08-07）**：又一处同形状的问题，属实。

`measure-e2e-exit.mjs` 的看门狗写的是 `void killTree(child.pid)`——**把返回值丢了**。`killTree`
返回 `false`（taskkill 超时且目标仍活着）时，`measureOnce` 只剩 `child.exit` 一条出路，而那个
事件恰恰永远不会来。于是「有界的看门狗」守着一个无界的等待。

这已经是同一条 issue 上第三次出现「边界写在错误的位置」：先是 deadline 写在 `await taskkill`
外面，然后是超时强杀本身没有时限，现在是强杀的结果没有被使用。**每次我修的都是上一处，而不是
这个形状本身。**

修法：看门狗改为 `await killTree`，失败则 `SIGKILL`；有界轮询后仍存活，就释放 child 的
stdout/stderr 与进程句柄、以 `unkillable` 结果 finish 并让夹具退出报失败（而不是被自己杀不掉的
东西拖住——那正是它要度量的那个形状）。所有出口统一走一个只生效一次的 `finish()`。

**负向验证**（新增 `FITMIND_E2E_SIMULATE_UNKILLABLE` / `FITMIND_E2E_MEASURE_CEILING_MS`，
仅供验证）：让所有强杀变空操作、ceiling 设 5 秒 → 夹具 **11 秒退出、打印 UNKILLABLE、退出码 1**，
并提示手工清理它留下的那轮。第一次做这个验证时 ceiling 设了 20 秒，而整轮只跑 12 秒，看门狗
压根没触发——**又一次差点用一个没执行到的分支充当证据**，缩短 ceiling 后才真正验到。

## 2026-08-07 — fitmind-650：腾讯云 Lighthouse 部署骨架

确认的目标环境：腾讯云轻量应用服务器（上海五区），Ubuntu 24.04、Docker 29.6.2、Compose
5.3.1、4 核 4GB、40GB 系统盘；正式域名 `fitmind.jimmyuuu.com`。数据库继续使用 Neon Free
Plan，AWS Singapore，因此应用服务器在境内并不改变数据跨境事实，生产值固定为
`DATA_RESIDENCY=overseas`。

部署拆成宿主机与容器两层：API 和静态站点容器只绑定 `127.0.0.1:3000` / `127.0.0.1:8081`；
宿主机 Nginx 是唯一公网入口，负责 80/443、证书、canonical redirect 和 `/api` 反代。SSE 路径
关闭 proxy buffering。镜像按 Git SHA 打标签；迁移先于新 API 启动，并在替换容器前验证
`vector` 扩展和 `user_consents` 表。

本地证据：Compose 安全模式配置校验通过；API 与 Web 镜像实际构建成功；临时容器中
`GET /api/health` 返回 200，Web `/healthz` 返回 `ok`，任意 SPA 深链接回落到含
`<title>FitMind AI</title>` 的首页；HTTP 与 HTTPS 两份宿主机 Nginx 配置均通过 `nginx -t`。

一条安全事故必须保留：第一次验证用了普通 `docker compose config`，Compose 把本地 `.env`
里的 Neon、模型与 JWT 凭据展开到了输出。所有这些凭据必须轮换；部署文档和 Compose 顶部现在
只允许 `config --no-env-resolution --quiet`。**“只是看配置”也可能泄密，验证命令本身同样属于
攻击面。**

尚未执行任何线上迁移或容器替换。2026-08-07 的 `nginx -T` 已确认公网 8080 归属于独立静态站点
`/etc/nginx/sites-enabled/mj-portfolio`（站点根目录 `/var/www/mj-portfolio`），不是 FitMind
残留。部署不得停止或覆盖它，也不得把删除其防火墙规则写进 FitMind 验收；FitMind 只使用公网
80/443，容器 Web 端口 8081 只绑定 loopback，两者可以并存。

## 2026-08-07 — fitmind-cu6：Neon 生产事实与跨境披露收口

用户从 Neon 控制台确认生产项目 `FitMind-ai`（`raspy-hall-57794539`）位于 AWS Asia
Pacific 1 (Singapore)，并在 Billing 页面确认使用 Free Plan；账号级事实的脱敏记录见
`docs/evidence/neon-production-facts.md`。记录不包含数据库主机、角色、密码或连接串，正式公开上线
前仍应把同时显示 Region 与 Plan 的控制台截图导出到发布证据库。

官方事实重新核对后，旧披露有三处实质错误：腾讯云上海只承载应用与 API，并不会把 Neon
数据库搬回境内；Neon 现行自助产品条款的签约主体是 Databricks, Inc.，Neon, LLC 可能代表其
计费；Free Plan 的时间点恢复上限是 6 小时或 1 GB 数据变更（以先达到者为准），不能笼统写成
“一段时间的备份”。隐私政策据此升级到 `2026-08-07`，两个代码常量、API 示例、E2E mock 与
真实数据库验证脚本同步提版，存量用户会按既有补签机制重新确认。

当前部署没有“不出境”选项：Vercel 演示实例经美国应用/API 访问新加坡数据库，腾讯云正式实例
经上海应用/API 访问同一个新加坡数据库。生产继续使用 Neon 是已确认方案，但必须保持
`DATA_RESIDENCY=overseas`、跨境同意与敏感健康信息单独同意；如果未来要求数据不出境，才需要
另行迁移到境内 PostgreSQL，而不是本批的上线前提。

## 2026-08-07 — fitmind-drl：认证表单错态与凭据串页

生产 Neon 密码轮换后，Vercel 的数据库请求同时出现 500。这个基础设施故障暴露了一个此前
潜伏的客户端缺陷：登录失败写入全局 `auth.errorMessage`，切换到注册只清本地校验错误，于是同一
条错误会被当前标签重新命名为「注册失败」，尽管 Network 中根本没有注册请求。登录/注册又共用
邮箱与密码 state，「记住邮箱」和登录密码也一起出现在注册表单。

修复把登录与注册的邮箱、密码拆成独立内存状态，并记录每次认证请求由哪个标签实际提交；切换
标签会撤销错误归属。因此失败登录不能污染注册表单，注册页初始邮箱/密码为空，登录邮箱仍可按
用户勾选只保存在本机，密码仍不进入任何浏览器存储。

Playwright 负向回归让 `/api/auth/login` 固定返回 500，随后切换注册并同时断言：注册失败提示不
存在、三项注册凭据为空、登录只请求一次、`POST /api/auth/register` 从未发生。定向结果为
`registration-consent.spec.ts` **12/12 通过**；客户端 TypeScript 与 ESLint 同时通过。

线上故障仍分开处理：`/api/health` 为 200，而数据库端点为 500，说明函数入口存活但数据库访问
失败；生产恢复前必须取得具体运行时异常并校验 Neon pooled `DATABASE_URL`，不能把 UI 修复当成
数据库修复。线上还在运行旧构建：新分支的匿名 `/api/auth/registration-policy` 在线上返回 401，
且注册页没有新同意流程；不得继续通过 Redeploy 旧 Production 假装发布了当前分支。

随后对 Neon 生产项目 `raspy-hall-57794539` 独立执行只读 `SELECT 1`，查询成功。这把 Neon
服务本身与 Vercel 连接故障分开，线上 500 收敛到部署配置或陈旧构建。应用的兜底错误处理新增
一条脱敏 JSON 事件，只包含 HTTP 方法、路径、错误类型和保守校验后的错误码；异常消息、堆栈、
请求体、请求头、查询串和连接信息一律不写日志。

## 2026-08-08 — fitmind-650：发布来源与 Docker 构建上下文收口

上线资产复查确认现有 `.dockerignore` 已经把服务器 `.env`、日志、依赖树和测试产物挡在两个
Docker 构建上下文之外；第一遍检查因隐藏文件未列出而误判为缺失，回读 Git diff 后已恢复原文件，
不把既有保护算成新成果。真正缺少的是发布来源约束：部署说明要求只发布已审查提交，但
`deploy.sh` 会把脏工作树构建出的内容标成当前 Git SHA。现在脚本在构建前拒绝任何未提交或未跟踪
文件（被 Git 忽略的服务器 `.env` 不受影响）。长期存在的客户端 `debug.log` 仍保留在本机，但已
由 Git 忽略，不再污染发布工作树。

## 2026-08-08 — fitmind-650：腾讯云 Lighthouse 正式上线

腾讯云 `ubuntu@115.159.102.34` 的发布前审计确认 Docker 29.6.2、Compose 5.3.1、免密 sudo、
磁盘和内存余量满足部署；既有 `mj-portfolio` 继续独占公网 8080，FitMind 容器只绑定
`127.0.0.1:3000/8081`。固定提交 `5c499f3` 补齐一次性字典 seed 镜像，并修复数据库先决
条件校验从错误的 `/app` 工作目录加载 `pg` 的问题。`pnpm verify` 通过 92 个测试文件、733
个测试，Compose 与腾讯云原生 Bash 校验通过。

首次部署填写的 Neon URL 误指向一个空 `neondb`，因此在那里完整执行了 14 个迁移，并幂等
写入 17 个肌群、43 个动作和 92 条唯一动作-肌群映射；该库始终为 0 用户，没有覆盖账号数据。
URL 随后改回原生产库：只读审计确认 PostgreSQL 18.4、14 条迁移、`vector`、`user_consents`、
2 个用户、20 条训练及 17/43 字典数据均存在。切换时只重建 API 容器加载新连接，没有对原库
重跑迁移或 seed。API/Web 容器均为 healthy。主机 Nginx 已启用 80/443，HTTP 与 `www` 均 301 到
`https://fitmind.jimmyuuu.com`，HTTPS 首页和 `/api/health` 返回 200，公开字典 API 返回
17/43 条，注册策略保持 invite-only、`overseas` 与单独跨境同意。Let's Encrypt 双域名证书
有效期至 2026-11-06，`certbot.timer` enabled/active，续期 dry-run 成功；DeepSeek 凭据鉴权
探测返回 200。8080 站点与其 Nginx 配置未改动。

## 2026-08-08 — fitmind-b2w：认证反馈与同意控件产品化

按浏览器批注收口认证页与隐私页：跨境同意复选框扩大到 18px，使用低强调灰色选中态并保留整行点击；隐私政策版本说明改为正式简洁的产品措辞；无效凭据、服务端故障与网络故障分别映射为中文可行动提示，不再向用户展示 `Internal server error.`。

本地正确凭据登录的 500 最终定位为代理链路问题：Clash/TUN 将 Neon 主机解析到 `198.18.x`
Fake-IP，并在 PostgreSQL TLS 建连前断开；同一数据库通过 Neon 官方通道和腾讯云正式实例均可用。
本地改为由 Vite 经 HTTPS 转发正式 API 后，用户已确认正确账号可以登录。诊断期间未把数据库
连接串写入代码、文档或日志。

## 2026-08-09 — fitmind-c7m.1：训练录入入口与动作详情关闭优化

按浏览器批注把训练首页入口扩为语音、文本、手动三种：文本入口直接提供空白训练描述框，
不启动麦克风，并与语音入口复用既有解析、动作歧义确认和训练编辑器链路。语音实时预览和
确认文本框使用可直接模仿的胸部卧推训练示例，但示例仅作为占位提示。动作详情标题区增加
具有“关闭”可访问名称的叉号按钮，同时保留原有遮罩关闭行为。
## 2026-08-09 — 日历视图信息密度优化（fitmind-c7m.2）

- 训练列表摘要新增 `total_volume`，由服务端在列表查询中按训练组重量 × 次数聚合。
- 为正式站客户端与旧版 API 分步部署提供兼容：当前月份缺少摘要容量时，按需读取训练详情回算，
  新 API 上线后自动停止这些额外请求。
- 月历训练日改为直接显示当日总容量和逐次训练备注；长备注单行省略，空备注保留弱提示。
- 月历继续支持选中日期查看当天训练，且补齐相邻月份日期和当天标记。

## 2026-08-09 — 历史入口与历史 / 分析双视图（fitmind-c7m.3）

- 底部第二导航由「分析」改为「历史」，并改用时钟图标；训练首页移除训练记录，只保留
  近 30 天统计、三种训练录入入口、本周计划与动作库。
- 历史页顶部新增 `历史 | 分析` 双段切换，首次进入默认展示历史；原分析页完整保留在分析
  视图内，分析范围、总览、肌群容量、动作进展和周容量数据流不变。
- 原训练记录的列表、日历、详情、删除与编辑能力整体迁入历史视图；编辑训练仍复用原
  `TrainingSessionComposer`，没有退化为只读列表。
- 反馈来源路由在共享的底部历史入口内继续区分 `/history` 与 `/analysis`，便于定位用户提交
  反馈时实际所在的子视图。

## 2026-08-09 — 个人页健康工具与训练备忘录（fitmind-c7m.4）

- 个人页新增经期记录、身体数据、RM 计算器和训练备忘录四个入口，并保留原训练档案。
- 经期记录只标记真实日期，不做周期或排卵预测；用户可选择是否在历史月历显示日期标记。
- 身体数据支持带日期的体重、目标体重、体脂率及颈、肩、胸、腰、臀和双侧肢体围度，提供
  数据、趋势和日历三种查看方式及公斤 / 斤显示切换。
- RM 计算器使用 Epley 公式在本机估算 1RM，并给出 50%–100% 训练负荷参考，不保存输入。
- 训练备忘录支持标题、正文、新建、编辑、删除和置顶，按账号同步。
- 新增四张账号隔离的数据表、配套 API、服务层校验与单元测试。伤病约束、经期日期和身体测量
  统一使用单独的敏感健康信息同意；删除单类数据不影响其他类别，删除全部健康数据会撤回同意。
- 隐私政策升级到 `2026-08-09`，README、API 契约和数据库说明同步更新。
- 政策版本精确匹配，因此已经存有伤病、经期或身体数据但只同意过 `2026-08-07` 的用户，
  下次鉴权会进入补签流程；这是本次发布的预期用户可见后果。
- 移动端深浅主题、四个页面、RM 计算、备忘录编辑器及历史日历降级完成浏览器验收；`pnpm verify`
  通过 97 个测试文件、751 个测试，客户端与服务端生产构建通过。浏览器验收代理指向尚无新端点的
  已部署 API，因此只覆盖加载 / 错误 / 空态与本地编辑器；repository 测试使用 fake pool，未证明四张
  新表和 13 个端点能在真实 PostgreSQL 持久化。生产迁移和部署不在本任务中执行。

## 2026-08-09 — 历史日历默认模式与年月跳转

- 历史页首次进入默认显示月历，保留列表切换入口。
- 月历标题改为可点击控件，新增年份下拉、12 个月份按钮和「回到本月」快捷操作；左右翻月继续保留。
- 跳转月份时自动关闭选择面板，并清除不属于新月份的旧日期选中状态，避免下方继续显示跨月训练。
- 在批注同尺寸 829 × 1270 下完成关闭、打开、跨年跨月、返回本月和列表往返验收；浏览器无警告或错误。

## 2026-08-10 — fitmind-c7m.5：个人工具发布硬化与记录补齐

- 同意状态查询新增严格的 expand/contract 兼容：只有新个人健康表缺失产生 PostgreSQL `42P01`
  时，才回退读取既有伤病数据，避免迁移窗口把正确账号登录变成 500；连接、权限等其他错误不吞。
  `hasStoredHealthData` 改为必填，移除只看伤病的静默类型退化。
- 经期全删、身体数据全删和单条身体数据删除改为“鉴权但不受待补同意闸门阻塞”，让拒绝补签的
  用户能按类别退出；健康数据读取和写入仍保持严格闸门。新增真实 Express HTTP 测试覆盖全部
  13 个个人工具端点及上述路由顺序。
- 未知服务端错误日志把 ISO 健康日期与 UUID 路径参数归一化成 `:date` / `:id`；请求体、异常消息、
  stack 和凭据仍不记录。客户端区分健康同意缺失、政策版本过期和网络失败，不再统一提示稍后重试。
- 腾讯云 `deploy.sh` 在迁移前核对期望的 pooled host、direct host、数据库名和
  `current_database()`，迁移后验证四张个人工具表再切容器，堵住“在错误空库迁移后检查表当然存在”
  的假绿。Vercel 自动部署但不自动迁移的差异同步写入 README、运行手册和生产 smoke 清单。
- `design-qa.md` 当前版本移除 7 条微信内部账号绝对路径并纳入文档索引；远端旧提交仍含历史路径，
  本批不做破坏性的 Git 历史重写。新增 D54/D55 记录多类健康数据撤回语义、政策补签后果和迁移策略，
  roadmap 与中国上线计划同步到腾讯云已上线后的真实状态。
- 针对性单测、HTTP 测试与客户端/服务端类型检查通过。另在隔离的本地 PostgreSQL 17 中执行除
  既有 pgvector embedding 迁移外的 14 条迁移（包含四张个人工具表），现有 consent SQL 套件全绿；
  新增 `verify:personal-tools-sql` 真实验证经期、身体数据、备忘录、分类删除与全量撤回的持久化和同意
  语义。生产目标库迁移与 live smoke 仍须在发布时单独执行，不能用本地结果冒充线上已部署。

## 2026-08-10 — 腾讯云受限自动部署（本地候选，尚未启用）

- 参考已上线的 `mj-portfolio` 三件套，为 FitMind 新增独立 GitHub Actions 工作流、服务器强制命令
  入口和受限公钥安装脚本；没有复用静态站私钥，也没有把服务器 `.env`、数据库 URL 或 Docker
  权限交给 GitHub。
- 工作流仅在 `main` push 或手动触发时运行，先执行全仓验证与生产构建，再通过严格 known-host
  校验发送固定的 `deploy <40位SHA>`。服务器只接受这一种命令，并验证提交确实属于最新抓取的
  `origin/main`，非 main 提交、额外参数、任意 shell 和并发部署都在运行 `deploy.sh` 前拒绝。
- 自动入口继续复用既有迁移优先 `deploy.sh`；失败后恢复旧 checkout，并仅在旧 API/Web 镜像都
  存在时调用既有 image-only rollback。数据库绝不自动 down，破坏性迁移仍需独立扩展/收缩方案。
- 隔离临时 Git 远端测试已命中 10 个正负分支，包括无命令、任意 shell、额外参数、大写 SHA、
  非 main commit、部署失败恢复 checkout、镜像回滚调用与部署锁竞争。GitHub Secrets、服务器公钥
  安装器另有 4 个断言覆盖强制命令、幂等安装、错误密钥类型和禁止静默换钥。GitHub Secrets、
  服务器公钥安装、push、首次 Actions 运行和生产健康检查尚未执行，不能声称腾讯云已经自动更新。

## 2026-08-11 — HTTPS API 安全头继承修复（fitmind-1lo，本地候选）

- HTTPS 主站改用共享安全头片段，并在 `/api/` location 内重复 include；这是因为该 location 自己的
  `X-Accel-Buffering` 会关闭 Nginx `add_header` 的父级继承，修复前 API 响应不会继承主站四个安全头。
- 保留 API/SSE 的 `X-Accel-Buffering: no`，本批不加入 CSP 或 Permissions-Policy；部署说明同步要求
  先安装共享片段，再运行 `nginx -t` 和 reload。
- 新增源码作用域与安装顺序回归测试。真实生产响应尚未部署验证，不能用本地测试冒充线上已生效。

## 2026-08-11 — 发布关键 E2E 与 Assistant Eval 门禁（fitmind-h22，本地候选）

- 腾讯云部署 workflow 在任何 deployment key/SSH 操作前新增离线 assistant eval、Chromium 安装和
  注册同意＋健康数据删除两份 release E2E；失败时上传 Playwright trace、截图和 HTML 报告。
- release E2E 固定为两份合规 spec，不把 UI finishing 等非关键套件混入自动部署门禁；修正测试中
  已漂移的“撤回伤病”旧文案，使断言匹配当前多类健康数据与“删除伤病信息”产品语义。
- 注册政策和伤病删除 readback 的决策从组件内联分支抽成纯函数并补直接单测，浏览器失败可先由
  快速逻辑测试定位。GitHub Actions 实际运行、push 和生产部署仍未执行，不能声称远端门禁已生效。

## 2026-08-11 — 资源存在性与生产模型成本护栏（fitmind-x0t，本地候选）

- workout/set 的 user-scoped 查询返回空时统一为 `404 NOT_FOUND`，不再追加忽略 owner 的全局存在性
  探测；测试分别模拟“他人资源存在”和“资源不存在”，并断言两个旧 probe 的调用数均为 0。
- 核实 DeepSeek 官方资料后修正了原审计的过时前提：`deepseek-chat` / `deepseek-reasoner` 已于
  2026-07-24 退役。生产示例迁到 `deepseek-v4-flash`，官方 endpoint 若仍配退役别名会在调用前报错。
- 价格于 2026-08-11 从 `https://api-docs.deepseek.com/quick_start/pricing` 核实；V4 Flash 按输入
  cache-miss `$0.14/M`、输出 `$0.28/M` 计价。因现有 usage 没有 cache-hit 明细，所有 prompt token
  按 cache-miss 做保守上界；未知 BYO 模型仍为 `null`，调用次数闸门继续生效。
- 本批没有修改服务器环境、没有部署、没有真实 provider 调用；线上模型切换与成本累计仍未验证。

## 2026-08-11 — AGENTS 真实地图与可执行治理（fitmind-cqh，本地候选）

- 删除 AGENTS 中不存在的 Zustand/store、analytics、固定 controller 行数、全量 JSDoc、单批文件数等绝对规则，改为当前 client/server/shared 真实目录、职责边界和权威文档路由。
- 明确选择“重新启用 Beads”：用户已指定工作可由规划者创建并 claim，不必改做 `bd ready` 的无关任务；acceptance 开工前冻结，创建/执行同一 issue 的人继续不负责关闭。多人同步、hooks 与恢复仍由 `fitmind-xbt` 独立验证。
- training → assistant 本批只冻结两个具名例外：workout intake 复用 OpenAI-compatible client/config，assistant insights 复用 intent type；到修复计划结构债 4.2 抽中立边界，不在文档批次搬代码。
- 新 governance 测试解析 AGENTS architecture manifest，要求每个目录含真实非测试源码；内存加入幽灵目录和空目录都会失败。测试同时扫描反向依赖，第三个 importer 不在 allowlist 时失败。
- migration 硬规则改为 expand/contract：新 schema 必须兼容上一个应用镜像，破坏性删除放后续 release；生产 smoke 新增“是否破坏、旧镜像能否跑、回滚或分阶段前滚方案”三问。没有给已上线迁移补 `down()`，也没有执行生产回滚演练。

## 2026-08-11 — CSP 与浏览器能力边界（fitmind-y70，本地候选）

- 共享 Nginx 安全头新增精确 CSP：脚本、API/SSE、字体、manifest 与 service worker 只允许同源，object/frame 禁用，frame ancestors 禁止，图片额外允许 `data:`。
- `style-src` 暂保留 `'unsafe-inline'`：当前 36 个 TSX 文件使用 React style props，两份 legal 页面使用 inline style block；本批不以一条严格但会让 UI 失效的 header 冒充修复。script 不允许 inline/eval/wildcard/broad scheme。
- Permissions-Policy 关闭 camera/geolocation，只允许同源页面使用 microphone；这限制页面能力，不改变浏览器 SpeechRecognition 厂商的数据处理披露。
- Nginx 源码测试精确解析策略并加入四个内存退化：缺 frame-ancestors、script 加 unsafe-eval、style 去掉当前必要例外、microphone 放宽为 wildcard 都会失败。
- 本批没有部署；生产响应头、浏览器 console、PWA 与真实语音权限仍需单独线上 smoke，不能用本地配置测试冒充已生效。

## 2026-08-11 — Paging 与每日质量 Digest 分层（fitmind-ry9，本地候选）

- API 新增 `http_request_completed` 结构事件，为 5xx 比例提供真实分母；事件只含 method、路由模板、status 和 duration。query/body/headers/error message/stack 不记录，未匹配或路由前失败统一为 `/api/:unmatched`，logger 抛错不改变响应。
- 宿主监控把可用性与质量严格分层：容器退出/不健康、重启增量、连续三次 loopback health 失败和满足“5 分钟至少 10 请求、3 个 5xx、20%”三重门槛时 Paging；provider/budget fallback、faithfulness flagged、成本/调用逼近 80% 只进入每日 Digest。
- page 状态文件只按白名单逐项解析，不 `source`；写入使用同目录临时文件原子替换并由 `flock` 防并发。首次重启计数只建立基线，同一故障集合去重，清除后输出一次 recovery；dry-run 不访问 webhook，真实发送失败非零退出。
- API/Web 的 Docker `json-file` 日志限制为 `10m × 5`；仓库提供一分钟 page timer 和每日 09:00 digest timer 候选。日志汇总器默认在当前 API 镜像的禁网、只读临时容器中运行，不要求宿主另装 Node。
- 全量 `pnpm verify` 通过 104 个 Vitest 文件、802 个断言及 5 个 monitor Node 断言；禁网、只读挂载的本地 Linux API 镜像中 shell 隔离测试通过；client/server production build 和 Compose 安全配置检查通过。
- 本批没有安装 systemd unit、没有配置或调用真实 webhook、没有 push、没有部署，也没有执行“部署 → 回滚上一 tag → 健康检查 → 滚回候选”的生产演练；这些不能用本地 stub 或镜像测试冒充完成。

## 2026-08-11 — 已验证 SHA 的生产审批边界（fitmind-6e8，本地候选）

- 腾讯云 workflow 从单 job 拆为 `verify` 与 `deploy`：verify 保留全仓检查、assistant eval、两端构建、release E2E 和 monitor shell gate，全部成功后才输出本次运行的 40 位 `GITHUB_SHA`。
- deploy 必须 `needs: verify`、仅允许 `refs/heads/main`，并引用 `production` environment；部署凭据只在该 job 中读取，SSH 只发送 `needs.verify.outputs.release_sha`，不直接使用 moving ref 或另一份 SHA。
- 本批明确选择 SHA 语义，不引入 registry 或可部署 artifact。Playwright artifact 仍仅在失败时保存 trace/截图/报告，deploy job 不下载或消费它。
- 测试会拒绝删除 `needs`/environment/job output、直接改用 `github.sha`、把审批放到 verify 或把 gate/SSH 混回同一 job；全量 `pnpm verify` 通过 104 个 Vitest 文件、803 个断言和 5 个 monitor Node 断言，client/server production build 通过。
- 本地 workflow 文件不能证明远端审批已生效；本批没有 push、没有创建/修改 GitHub environment、没有配置 required reviewer、没有触发运行、没有审批或部署。后续必须保存 environment 规则截图和一次 verify 全绿后 Waiting → 独立批准 → 同 SHA 部署的证据。

## 2026-08-11 — 事务 query 不逃逸 CI 护栏（fitmind-bcq，本地候选）

- 新增无 Vitest 依赖的共享 transaction routing probe：`pool.query` 与 `connect()` 返回的 `client.query` 是两个独立通道，事务中一旦直接调用 pool 就抛固定错误并留下记录。
- 真实执行 consent 注册、health profile 保存、planned-workout supersede、workout+sets 创建和 personal-tools 经期保存五条链路；每条成功路径均断言 connect 一次、BEGIN/业务 SQL/COMMIT 全在 client、pool query 为 0、release 一次。workout set 写失败另证实 ROLLBACK 仍在 client 且不 COMMIT。
- 测试扫描 db 与 repositories 源码，所有直接发出 `BEGIN` 的非测试文件必须与具名场景集合精确相同；内存加入未覆盖的第五 repository 会失败，避免未来只靠人工维护清单。
- `workouts-repository.d.ts` 补齐运行时已有的可选 pool 参数与 query/client/pool 类型；测试从 runtime export 发现全部 10 个可注入函数并逐一检查声明，不使用类型强转绕过。
- 全量 `pnpm verify` 通过 105 个 Vitest 文件、812 个断言及 5 个 monitor Node 断言，server production build 通过。本批没有改变 SQL、连接生命周期或生产行为；每请求新建 pool、4 个 JS repository 和手写声明仍待 4.1b，不能记成已修。

## 2026-08-11 — 进程级共享数据库连接池（fitmind-o90，本地候选）

- 数据库默认路径已收口到一个进程级 pg Pool：14 个 TypeScript repository 移除各自的 `createRepositoryPool()`，与既有 4 个 JavaScript repository、weekly-report repository 一起通过 `createDbPool()` 使用同一稳定门面；生产 db 源码中只允许 `pool.ts` 构造或加载 `pg`。
- 共享门面的 `end()` 是兼容旧 repository finally 清理代码的 no-op，只有显式 `closeDbPool()` 会 drain 并清除真实底层 Pool；重复工厂调用返回同一门面，显式关闭后可重建底层 Pool。测试注入的 fake pool 仍由调用方持有，repository 不会关闭它。
- 唯一 Pool 配置固定 `max: 10` 与 `allowExitOnIdle: true`，并监听空闲客户端 error。输出事件只含 `db_pool_idle_error`、保守错误类型和错误码；异常 message、stack、数据库 URL、SQL 与凭据不进入日志。
- 新增机器护栏会精确枚举 19 个共享工厂消费者，拒绝第二个 `new Pool`、第二个 `require("pg")` 或任何 `createRepositoryPool`；生命周期、脱敏日志与 4.1a 事务不逃逸测试共 13 条定向断言通过。
- 全量 `pnpm verify` 通过 106 个 Vitest 文件、816 个断言及 5 个 monitor Node 断言，server production build 通过。验证全程使用 mock/fake pool，没有连接真实数据库、没有读取生产密钥、没有 push 或部署；4 个 JavaScript repository 的 TypeScript 迁移、手写声明清理和进程信号优雅停机仍不属于本批。

## 2026-08-11 — repository TypeScript 单一类型源（fitmind-18z，本地候选）

- `db/repositories` 的 exercises、muscle-groups、users、workouts 四个实现和 barrel 已从 JavaScript 原位迁移到 TypeScript；`index.d.ts` 与 `workouts-repository.d.ts` 两份旁路手写声明删除，公共行类型、输入类型及可注入 pool/client 类型现在与实现同源。
- NodeNext 导入说明符继续使用 `.js`，所以源码消费者无需改路由，server build 会从 `.ts` 生成对应运行时 `.js`。构建后精确检查 exercises、muscle-groups、users、workouts 和 index 五个产物均存在。
- 新增源码合同精确限定 5 个生产 `.ts`、0 个生产 `.js`、0 个手写 `.d.ts`，固定四个实现和 barrel 的运行时导出集合，并拒绝 `any` / `as unknown as` 类型逃逸。
- 迁移前冻结的 exercises 1 块、muscle-groups 1 块、users 5 块、workouts 12 块 SQL 模板，在统一换行后 SHA-256 逐项完全相同；参数、事务、分页和返回行为没有借类型迁移改写。auth、dictionary、workout service 与事务护栏定向共 49 条断言通过。
- 全量 `pnpm verify` 通过 107 个 Vitest 文件、820 个断言及 5 个 monitor Node 断言，server production build 通过。验证没有连接真实数据库、没有读取生产密钥、没有 push 或部署；真实 PostgreSQL 集成和进程信号优雅停机仍不属于本批。

## 2026-08-11 — TrainingSessionComposer 时间纯逻辑边界（fitmind-wyj，本地候选）

- 先以 `21556b2` 建立稳定 `training-time.ts` facade 和 7 条行为 characterization，再以 `3e6b754` 在尚未提交实现移动前补齐“5 个函数只有一个定义所有者、两个模块只能单向依赖”的负向护栏；最终冻结测试 blob 为 `4bb1639f1b664ef96c83f60cf1ba0b393324f923`。
- `formatTrainingTimeSummary`、`formatTimeOnly`、`formatDateTimeLocalValue`、`parseDateTimeLocalValue`、`getDurationMinutesFromLocalValues` 五个纯函数现在唯一位于 `training-time.ts`，composer 只导入消费；新模块不依赖 React、API、状态或 composer，characterization 测试文件从最终拆分前 commit 到 candidate 逐字节不变。
- 8 条模块测试固定 summary 分支优先级、中文文案、合法/非法本地时间显示、ISO 解析、分钟舍入、1 分钟下限、空值、同刻和倒序；fixture 使用本地构造 Date，未把执行机时区写死。composer 从 1723 行降至 1648 行，但行数不是完成判据，测试所有权与单向依赖才是。
- 全量 `pnpm verify` 通过 108 个 Vitest 文件、828 个断言及 5 个 monitor Node 断言，client production build 通过。没有改变 UI、保存/API 行为，没有访问网络或远端浏览器状态，也没有 push 或部署；composer 的表单组件、样式、错误映射及其余 1600 余行仍需后续独立边界，不能记成整体拆分完成。

## 2026-08-11 — assistant 训练部位纯规则边界（fitmind-bu0，本地候选）

- 先以 `67d43d9` 在原 orchestrator 上建立稳定 `assistant-focus-area.ts` facade，并冻结 8 条 characterization；测试 blob 为 `97a8e2092d2ad48da1f9cee9cfceea4064149a1e`。candidate 只反转依赖和移动实现，测试文件与合同均未修改。
- `inferDominantFocusArea`、`inferFocusAreaFromName`、`resolveNextFocusSuggestion`、`detectTargetArea`、`describeTargetArea` 及 `FocusArea` 类型现在唯一归属 `assistant-focus-area.ts`；orchestrator 只导入消费，新模块没有 provider、数据库、工具、环境或时间依赖。
- characterization 固定中英文名称/消息分类、自由输入反例、volume 累计、空输入、mixed 与恰好 1.25 阈值，以及 6 类部位的建议和描述文案。它同时揭示并保留现状：`lateral` 会先被 back 规则中的 `lat` 子串命中；本结构批次不顺手改变路由行为，该词边界缺陷单独跟踪。
- assistant 定向验证通过 28 个测试文件、264 条断言；全量 `pnpm verify` 通过 109 个 Vitest 文件、837 条断言及 5 个 monitor Node 断言，server production build 通过。orchestrator 从 2710 行降至 2595 行，但行数不是完成判据；provider、tool、answer、session、planning 等边界仍未拆分。
- 开工前已有的 deploy README/compose/deploy.sh、app test 与 health route 工作树改动未进入本批实现或提交；本批没有真实 provider/数据库/网络调用，没有 push 或部署。

## 2026-08-11 — assistant `lat` / `lateral` 词边界（fitmind-gct，本地候选）

- `90321a5` 先只修改回归期望并增加正反例；未改生产代码时定向运行精确出现 2 个失败、6 个通过，失败分别来自 exercise-name 与 message 的 lateral 误分类，证明测试确实命中原缺陷。冻结测试 blob 为 `35bcc03c8c5862ff613c7b23aef6db13da83832c`。
- 名称与消息 back 正则中的两处裸 `lat` 已分别收紧为完整 `lat` / `lats` token。`Dumbbell Lateral Raise` 与 `add lateral raise` 现在归 shoulders，`Pilates Roll Up` 与 `latest news` 归 unknown；`Lat Pulldown`、`lat pulldown`、`Lats` 与 `train lats` 继续归 back。
- 修复没有重排 chest/back/legs/shoulders 分支，也没有改变其他关键词、部位文案或运行时导出。regression 测试文件在实现修复后逐字节不变，定向测试由红转为 8/8。
- assistant 目录通过 28 个测试文件、264 条断言；全量 `pnpm verify` 通过 109 个 Vitest 文件、837 条断言及 5 个 monitor Node 断言，server production build 通过。五个开工前已有的 deploy/health 工作树改动仍保持未暂存、未提交；本批没有 provider、数据库、网络调用，没有 push 或部署。

## 2026-08-11 — assistant 显示度量纯逻辑边界（fitmind-6tx，本地候选）

- 合同由 `202ac44` 冻结；随后以 `dfd60ee` 建立迁移前 facade 和 14 条 characterization，测试 blob 固定为 `128720910b0cb57103acbc5c37d5212dbaa855de`。实现迁移后测试文件与合同均未修改，工作树测试 blob 仍与冻结值完全相同。
- `formatMetricKg`、`formatPercent`、`getDaysSince` 与私有 `METRIC_WEIGHT_DISPLAY_INCREMENT_KG = 0.5` 现在唯一归属 `assistant-display-metrics.ts`；orchestrator 只单向导入消费。新模块的运行时导出精确为三个函数，不依赖 provider、数据库、工具、环境配置或 orchestrator，也没有 `any` / `as unknown as` 类型逃逸。
- characterization 固定 null/零值、0.25kg 半步边界、负数、千分位、百分比四舍五入与固定一位小数；时间用 fake system clock 覆盖非法日期、未来、少于一天、整一天和 1.9 个 24 小时桶。迁移保持原有中文文案、`en-US` locale、round/floor/max 算法逐字不变。
- 定向测试通过 14/14；assistant 目录通过 29 个测试文件、278 条断言；全量 `pnpm verify` 通过 110 个 Vitest 文件、851 条断言及 5 个 monitor Node 断言，server production build 通过。orchestrator 从基线 2595 行降至 2568 行，但行数不是完成判据，其他 provider、tool、answer、session、planning 边界仍未拆分。
- 五个开工前已有的 deploy/health 工作树改动保持未暂存、未提交；验证没有真实 provider、数据库或网络调用，没有 push 或部署。

## 2026-08-11 — 中立 AI provider 边界与反向依赖清零（fitmind-dlo，本地候选）

- 合同由 `047e856` 冻结；`e4e158b` 先建立三个中立 re-export facade 与各自 characterization，再移动实现。冻结测试 blob 分别为 chat `26b099ef3830abc121e14fb6d1b42daa2f9af496`、config `e28c348b6cdac1bfc5ace44f499d8864721e1b05`、types `04845378ca0742a04c621798c79ec90d7800a656`，实现反转后逐字节保持一致。
- 通用 OpenAI-compatible HTTP/timeout/响应归一化现在唯一归属 `services/ai/openai-compatible-chat-client.ts`；Groq/BYO 环境配置唯一归属 `openai-compatible-provider-config.ts`；`OpenAiCompatibleProviderName`、`AssistantProviderUsage` 与完整 `AssistantIntentMode` union 唯一归属 `provider-types.ts`。三个中立模块不导入 assistant、training、controller 或 repository，也没有类型逃逸。
- assistant 旧 chat/config/types 路径保留兼容导出，assistant 专属 provider 选择与配置失败归一化仍在 assistant seam；workout intake 与 assistant insights 改为直接消费中立层。production training 对 `../assistant/` 的 importer 集合由冻结的两个降为零，AGENTS 临时 allowlist 已删除，治理测试改为任何 synthetic importer 都失败。
- 中立模块与相关 assistant/training/governance 定向验证通过 8 个文件、54 条断言；assistant 目录通过 29 个测试文件、278 条断言；全量 `pnpm verify` 通过 113 个 Vitest 文件、868 条断言及 5 个 monitor Node 断言，server production build 通过。HTTP URL、Bearer header、payload、content/tool call/usage、错误脱敏、timeout/timer、默认模型与缺失配置行为均由冻结 characterization 覆盖。
- 五个开工前已有的 deploy README/compose/deploy.sh、app test 与 health route 工作树改动保持未暂存、未提交；验证只使用 stub fetch 与 fake timers，没有真实 provider、数据库或网络调用，没有 push 或部署。中立边界到期债已清理，但 assistant orchestrator 其余业务流和 TrainingSessionComposer 其余 UI 边界仍需后续独立拆分。

## 2026-08-11 — assistant 确定性答案构建边界（fitmind-gdd，本地候选）

- 合同由 `5e28076` 冻结；`006602f` 先建立稳定 facade 和 11 条 characterization，答案测试 blob 固定为 `e3b2881f92a03e6509563ebb5784b8eb4533cfbb`。实现迁移后测试文件与合同均未修改。
- 四个工具结果 DTO、`AssistantAnswerCore`、八个公开 builder 以及 evidence/range/complete/recommendation 内部纯 helper 现在唯一归属 `assistant-deterministic-answers.ts`；orchestrator 只导入消费。`buildToolAnswer`、tool validation、provider simulation、stream、persistence 与 agent 生命周期仍留在 orchestrator。
- 混合 tool+RAG 路径通过既有 `buildToolAnswer(...).evidence` 复用同一 evidence owner，没有暴露第九个 API 或复制 helper。characterization 固定 empty/ready overview、progress、weekly，五类 recommendation、55% 集中度、24 小时恢复桶、plateau Sources、provider guidance、evidence 去重和 structured 默认字段。
- 初次全量验证揭示旧 focus/metrics 测试把“唯一实现所有者”错误绑定为“orchestrator 必须直接 import”。范围补充合同 `042cf56` 冻结正确两跳链，`ff98eb8` 单独适配护栏；focus/metrics 新测试 blob 分别为 `1df0141fa5971c0c72bb395a35b3493dd99fed43` 与 `086a78d383e2a0c4d3fe83f0a7766d0d757de21a`，candidate 不修改。
- 定向验证通过 47/47；assistant 目录通过 30 个测试文件、289 条断言；全量 `pnpm verify` 通过 114 个 Vitest 文件、879 条断言及 5 个 monitor Node 断言，server production build 通过。orchestrator 从 2568 行降到 2014 行，但完成判据是模块自有测试、单一所有权与依赖方向，不是行数。
- 开工前与过程中并行出现的 workflow/deploy/health/release-identity/progress 改动未进入本批暂存或提交；验证没有真实 provider、数据库或网络调用，没有 push 或部署。orchestrator 的 session/provider/tool/planning 生命周期和 TrainingSessionComposer 其余 UI 边界仍需后续独立拆分。

## 2026-08-11 — server scripts 独立 TypeScript 门禁（fitmind-xd4，本地候选）

- 合同由 `61f93aa` 冻结，baseline 为 `9e229c8`。首次 production build 揭示“测试必须位于 `server/src`”与“dist 路径逐项不变”冲突，`5ad9471` 在 candidate 前冻结范围补充，把治理测试移到 server 根并由 Vitest 显式收录；原合同未修改。
- `server/tsconfig.scripts.json` 继承 base 的 `strict` 与 `noUncheckedIndexedAccess`，使用 NodeNext 且 `noEmit`；server 默认 `type-check` 现在串联 src 与 scripts，根 recursive type-check/verify 会实际执行它。治理测试动态枚举当前 26 个 `.ts` 脚本，逐项验证 TypeScript program 覆盖脚本及其 source import closure，并锁定根/包命令和 production graph。
- 基线严格检查暴露的 12 条诊断已按真实类型修复：production smoke 的 JSON body 改用 Fetch 原生接受的 string；两个 seed 直接消费 `db/pool.ts`；共享 `DbPool`/`DbClient` query 支持泛型 row，而 SQL、seed 内容、路由、断言和 pool 生命周期未改。新增/修改 TypeScript 没有 `as any`、双重断言或 ignore suppression。
- 回滚演示把 demo seed 的有效 `../src/db/pool.js` 临时改成不存在的 `missing-pool.js`；根 `pnpm type-check` 在 scripts 阶段以 TS2307 非零退出。恢复后 type-check exit 0，故障注入前后文件 blob 均为 `8c5f790425b54b2661850431123a45ea85055da4`。
- production `tsconfig.json` blob 保持 `ee3259286eb56dca980f86fb5970f48da20f15da`，build 命令未变；最终 build exit 0，`dist` 仍为 219 个路径、SHA-256 `cc3a85d0e51384779a7b1e971e0d6729b752718aa5880abd3f2d4ff44f19c5f7`、`dist/scripts` 为 0，错误测试位置产生的单个 ignored artifact 已删除且未被重建。
- 最终 `pnpm verify` 通过 115 个 Vitest 文件、882 条断言及 5 条 monitor 断言；根 `pnpm eval` 的 intent 15/15、refusal 14/14、faithfulness 3/3、safety 20/20 全通过。需要数据库、provider、注册配置或线上 API 的 server eval/smoke 未验证；并行 deploy/health/release-identity/progress 改动未暂存、未提交，没有 push 或部署。

## 2026-08-11 — assistant turn routing 决策边界（fitmind-l47，本地候选）

- 合同由 `a09084e` 冻结，baseline 为 `c98b714`；`0b5439a` 先建立 facade 并把原 6 条 routing 测试扩为 43 条 characterization，冻结测试 blob 为 `be47e301969efa097b67a1fe9ecd18db8652058b`。candidate 未修改合同或测试。
- `resolveRoutedIntent`、`resolveExecutionModeForIntent`、`buildProviderRequest`、`ensureAllowedProviderTool` 及其 mode/intent、simulation、allowed-tools 私有 helper 现在唯一归属 `assistant-turn-routing.ts`；runtime export 精确为四个函数，orchestrator 单向导入消费并仅兼容 re-export 既有 `resolveRoutedIntent`。
- characterization 表驱动固定所有显式 mode 与 routed intent、plateau 有/无 exercise 分叉、keyword/LLM rescue telemetry、原消息与 simulation normalized message 分离、allowed-tools 顺序/去重，以及未授权 provider tool 的 502 `AI_PROVIDER_ERROR`。新模块没有 DB/repository、provider adapter/client、tool executor、agent、I/O、时间/随机或类型逃逸依赖。
- 初次真实消费验证揭示 `NO_LLM_CALL` 同时服务 provider telemetry 与 resumed clarification，并非 routing 私有事实；`bd89cf5` 在继续实现前冻结 addendum。routing 使用私有 `NO_ROUTER_CALL`，orchestrator 保留私有 provider no-call 常量并在 resumed 分支机械组装同一结果；43 条冻结测试不改，原先 13 条失败恢复为绿。
- 定向 routing 为 43/43，routing+weekly+safety 为 3 文件 81 条，assistant 目录为 30 文件 326 条；最终 `pnpm verify` 通过 115 个 Vitest 文件、919 条断言及 5 条 monitor 断言，根 `pnpm eval` 四组全过，server production build 通过。orchestrator 以同一物理行口径从 2027 降到 1826，但完成判据是单一所有权、冻结行为与依赖方向。
- provider 执行、预算、session/repository、持久化、stream、tool execution 与 answer construction 生命周期保持原位；并行 deploy/health/release-identity/progress 改动未暂存、未提交。验证没有真实 provider、数据库或网络调用，没有 push 或部署；orchestrator 与 TrainingSessionComposer 其余边界仍需后续独立拆分。

## 2026-08-11 — assistant chat session 安全 404（fitmind-1pv，本地候选）

- 合同由 `dc6e587` 冻结，baseline 为 `c51b125`；`35b8854` 在实现前提交 service 与真实 HTTP 失败回归，冻结 blobs 分别为 `f8cacdee6e1fb3081c5b7f58f4ae56f3fa059ef2`、`4d6324053f9ea771b632cc72b3fa1cf44d7cdb36`，candidate 未修改。红灯确认 foreign session 为 403、absent 为 404，且 absent 路径执行两次 DB query。
- 冻结判据要求测试 mock 同名引用也归零，但初版允许路径漏列 5 个既有测试；先回退机械清理，再由 `6621022` 只补充允许路径，未改产品判据或冻结回归，之后才重新删除失效 mock。
- `resolveSession` 现在只信任 `findChatSessionByIdForUser(sessionId, authenticatedUserId)`：scoped lookup 返回 null 时统一抛 404 `NOT_FOUND` / `Chat session was not found.`。repository 的无 owner `hasChatSessionById` 定义、SQL、export、生产调用与测试 mock 均已删除，源码全量同名引用为 0。
- service 与 production `createApp → auth middleware → assistant router/controller → error middleware` HTTP 回归证明 foreign/absent 的 status 与 JSON error body 逐字段相同；owned session 复用与无 `session_id` 创建路径由原 weekly-report characterization 继续覆盖。API 契约已明确不存在和他人会话均不披露存在性。
- 定向回归为 3 个文件、39 条断言；assistant 目录连同 HTTP 回归为 32 个文件、329 条断言。最终 `pnpm verify` 通过 117 个 Vitest 文件、922 条断言及 5 条 monitor 断言，根 `pnpm eval` 四组全过，server production build 通过；冻结测试哈希保持不变。
- 验证只绑定本地 loopback 并使用 fake DB/provider/tool 边界，没有真实数据库、provider 或外部网络。并行 deploy/health/release-identity/progress 改动未暂存、未提交；没有 push 或部署。

## 2026-08-11 — TrainingSessionComposer 保存边界（fitmind-l7y，本地候选）

- baseline 为 `84d8330`。初版合同 `43642e3` 与红灯测试 `96f2925` 揭示 intake 时间判据和 baseline 冲突：带 `draftStartedAt` 的 create-from-intake 实际会用保存点击时间覆盖 `draftEndedAt`。未提交实现先完整回退；期望修复拆为独立 bug `fitmind-8n2`，修订合同 `b679afe` 与修订测试 `36b6c00` 先固定现有行为后才重新实现。
- 冻结测试 blob 为 `e6a72f4fcaf0d8d166ea1d608bca3a1c723af0b7`，candidate 未修改。10 条红灯覆盖 active/intake 两条时间分支、edit patch/delete/patch/add、两类无效 draft、create 与 no-op、顺序写入、同一错误透传/失败短路及源码所有权；facade 开工时只抛 `Not implemented`，client type-check 仍通过。
- `training-session-save.ts` 现在唯一拥有 create/edit 保存计划准备和五个 workout mutation 的串行编排；`TrainingSessionComposer.tsx` 只传入当前 state、mode 与点击时创建的 `new Date()`，再消费两个 facade。组件原无 token/无效 draft 文案、pending、reset、`onCreated`、catch 与 finally 状态动作保持原位；组件从 1648 降到 1573 个物理行，但完成判据是单一所有权和冻结行为，不是行数。
- 隔离回退演示临时在 delete 失败后继续 patch/add、最后再抛同一错误；冻结测试 9/10 通过，唯一失败的 ordered log 明确多出 `updateWorkoutSet` 与 `addWorkoutSet`。恢复后定向 3 个文件、16 条断言通过，冻结测试 hash 不变。
- 最终 `pnpm verify` 通过 118 个 Vitest 文件、932 条断言及 5 条 monitor 断言；根 `pnpm eval` 四组全过；client production build 转换 146 个模块并成功产出。验证使用纯数据、fake API 与本地源码读取，没有真实 API、数据库、浏览器交互或外部网络。
- `fitmind-8n2` 的 intake 结束时间产品修复没有混入本批；并行 deploy/health/release-identity/progress 改动未暂存、未提交。没有 push 或部署。

## 2026-08-11 — 导入训练显式结束时间修复（fitmind-8n2，本地候选）

- 合同由 `014c0d0` 冻结，baseline 为 `4010f27`；`3259b53` 在实现前提交纯函数与真实浏览器路径失败回归，冻结 blobs 分别为 `9af48968244287a32c3aaedfd6df27a8ded0c9c9`、`77354f546419ec06ff3e46d184b8411bb95e836a`，candidate 未修改。
- 红灯精确证明同一缺陷：create-from-intake 明确填写 start/end 后，纯函数期望显式 end、实际得到固定的 2030 保存时刻（1/10 失败）；Playwright 从正式 App 的“文本录入训练”经过 parse、composer 时间编辑器和完成按钮，捕获 `POST /api/workouts`，同样只在 `ended_at` 上得到 2030（1/1 失败）。
- 修复只把 `activeStartedAt` 限定为 `mode === "create_active"`；active 训练仍在点击完成时结束，intake 显式 end 传给 request builder，无 start intake、performed-at、duration、notes、sets、edit plan、mutation 顺序与组件状态不改。
- 隔离回退演示临时恢复“任意 startedAt 都用 now end”：纯函数与 E2E 分别非零退出并显示显式 2026 end 与实际 2030 save time；恢复后定向纯函数/edit 为 2 文件 13 条，浏览器为 1/1。global teardown 后 5173 无监听；两个冻结 blobs 不变。
- 最终 `pnpm verify` 通过 118 个 Vitest 文件、932 条断言及 5 条 monitor 断言；根 `pnpm eval` 四组全过；client production build 转换 146 个模块并成功产出。E2E 使用 route interception，无真实 API、数据库、密钥或外网。
- 并行 deploy/health/release-identity/progress 改动未暂存、未提交；没有 push 或部署。
