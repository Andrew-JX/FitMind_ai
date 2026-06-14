# API 接口约定（api-contract.md）

> 所有 API 路径前缀 `/api`。返回格式统一。错误码统一。 改 API 必须同步改本文档 + `shared/types/`。

------

## 1. 通用约定

### 1.1 请求

- Content-Type: `application/json`（除 SSE 端点）
- 鉴权（除登录 / 注册 / 登出）：浏览器走 **HttpOnly 会话 cookie**（`fitmind_token`，登录 / 注册时由后端 `Set-Cookie` 写入，请求需 `credentials: "include"`）；服务端脚本 / 非浏览器客户端可继续用 `Authorization: Bearer <jwt>` 作为兜底。中间件优先读 cookie，缺失时回退 Bearer。
- 时间统一用 ISO 8601 UTC 字符串

### 1.2 响应

**成功响应**：

```json
{
  "ok": true,
  "data": { ... }
}
```

**错误响应**：

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "weight_kg must be >= 0",
    "details": { ... }
  }
}
```

### 1.3 错误码

| code                | HTTP 状态 | 含义                |
| ------------------- | --------- | ------------------- |
| `VALIDATION_ERROR`  | 400       | 参数校验失败        |
| `UNAUTHORIZED`      | 401       | 未登录 / token 过期 |
| `FORBIDDEN`         | 403       | 无权访问该资源      |
| `NOT_FOUND`         | 404       | 资源不存在          |
| `RATE_LIMITED`      | 429       | 触发限流            |
| `AI_QUOTA_EXCEEDED` | 429       | AI 调用超出每日上限 |
| `AI_PROVIDER_ERROR` | 502       | Anthropic API 失败  |
| `INTERNAL_ERROR`    | 500       | 服务端内部错误      |

### 1.4 分页约定

```
GET /api/workouts?cursor=<id>&limit=20

返回：
{
  "ok": true,
  "data": {
    "items": [...],
    "next_cursor": "abc..." // 没有下一页时返回 null
  }
}
```

------

## 2. 认证模块

### POST /api/auth/register

注册新用户。

**Request**：

```json
{
  "email": "user@example.com",
  "password": "atleast8chars",
  "display_name": "Andrew"
}
```

**Response 201**：同时通过 `Set-Cookie` 写入 HttpOnly 会话 cookie（`fitmind_token`，`HttpOnly; SameSite=Lax; Path=/`，生产环境追加 `Secure`，有效期 7 天）。响应体仍返回 `token` 供非浏览器客户端使用。

```json
{
  "ok": true,
  "data": {
    "user": { "id": "uuid", "email": "...", "display_name": "Andrew" },
    "token": "<jwt>"
  }
}
```

### POST /api/auth/login

**Request**：

```json
{ "email": "...", "password": "..." }
```

**Response 200**：返回同 register（同样 `Set-Cookie` 写入会话 cookie）。

### GET /api/auth/me

获取当前用户信息（鉴权）。

**Response 200**：

```json
{ "ok": true, "data": { "user": { ... } } }
```

### POST /api/auth/logout

清除 HttpOnly 会话 cookie（`Set-Cookie` 过期）。无需鉴权，幂等。

**Response 200**：

```json
{ "ok": true, "data": { "success": true } }
```

------

## 3. 字典查询模块

### GET /api/muscle-groups

返回所有肌群。

**Response 200**：

```json
{
  "ok": true,
  "data": {
    "items": [
      { "id": "uuid", "code": "chest", "name_en": "Chest", "name_zh": "胸", "recovery_hours": 48 },
      ...
    ]
  }
}
```

### GET /api/exercises?q=&muscle=

搜索动作字典。

**Query**：

- `q`: 关键词模糊搜（中英文）
- `muscle`: 肌群 code，过滤主要练该肌群的动作

**Response 200**：

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "code": "bench_press_barbell",
        "name_zh": "杠铃卧推",
        "movement_pattern": "horizontal_push",
        "equipment": "barbell",
        "muscles": [
          { "code": "chest", "contribution_weight": 1.0, "is_primary": true },
          { "code": "triceps", "contribution_weight": 0.5, "is_primary": false }
        ]
      }
    ]
  }
}
```

------

## 4. 训练日志模块

### POST /api/workouts

创建一次训练（含若干组）。

**Request**：

```json
{
  "performed_at": "2026-05-01T10:00:00Z",
  "duration_minutes": 75,
  "notes": "腿日 状态一般",
  "sets": [
    {
      "exercise_id": "uuid",
      "set_index": 1,
      "reps": 5,
      "weight_kg": 100,
      "rpe": 8,
      "is_warmup": false
    },
    ...
  ]
}
```

**Response 201**：

```json
{
  "ok": true,
  "data": { "workout": { "id": "uuid", ... } }
}
```

### GET /api/workouts?from=&to=&cursor=&limit=

查询训练记录。

**Query**：

- `from`: ISO 日期，默认无下限
- `to`: ISO 日期，默认 now
- `cursor` / `limit`: 分页

**Response 200**：

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "performed_at": "...",
        "duration_minutes": 75,
        "notes": "...",
        "sets_count": 12,
        "muscle_groups": ["chest", "triceps"]  // 由后端聚合
      }
    ],
    "next_cursor": null
  }
}
```

### GET /api/workouts/:id

查询单次训练详情（含全部 sets）。

### PATCH /api/workouts/:id

修改训练（部分字段）。

### DELETE /api/workouts/:id

删除训练（级联删 sets）。

### POST /api/workouts/:id/sets

往已有训练里追加组。

### PATCH /api/sets/:id

修改单组数据。

### DELETE /api/sets/:id

删除单组。

------

## 5. 训练分析视图模块

这些是普通查询接口，提供给前端展示用（不经过 AI）。AI 工具会调用对应的 service 函数（不是 HTTP）。

### GET /api/analytics/volume-distribution?weeks=4

最近 N 周的肌群容量分布。

**Response 200**：

```json
{
  "ok": true,
  "data": {
    "weeks": 4,
    "by_muscle": [
      { "muscle_code": "chest", "weighted_volume": 28500, "share": 0.32 },
      { "muscle_code": "back", "weighted_volume": 24000, "share": 0.27 }
    ]
  }
}
```

### GET /api/analytics/recovery-status?muscle=legs

单肌群当前恢复状态。

**Response 200**：

```json
{
  "ok": true,
  "data": {
    "muscle_code": "legs",
    "fatigue_score": 5.2,            // 0-10
    "status": "moderate",            // recovered / moderate / high
    "days_since_last": 2,
    "last_workout_at": "2026-04-29T10:00:00Z"
  }
}
```

### GET /api/analytics/progress?exercise_code=bench_press_barbell&weeks=8

**Response 200**：

```json
{
  "ok": true,
  "data": {
    "exercise_code": "bench_press_barbell",
    "weeks": 8,
    "data_points": [
      { "week_start": "...", "estimated_1rm_kg": 110.5 },
      ...
    ],
    "slope_kg_per_week": 0.4,
    "is_plateau": false,
    "plateau_weeks": 0
  }
}
```

------

## 6. AI 聊天模块（核心）

### POST /api/chat（**SSE 端点，重点**）

**Request**：

```json
{
  "session_id": "uuid",         // 不传则后端创建新会话
  "message": "我今天能练腿吗"
}
```

**Response Headers**：

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**SSE 事件类型**（前端状态机依据）：

```
event: state
data: {"state":"thinking"}

event: state
data: {"state":"tool_calling","tool":"get_recovery_status"}

event: tool_result
data: {"tool":"get_recovery_status","output":{"muscle_code":"legs","fatigue_score":5.2,...}}

event: state
data: {"state":"answering"}

event: text_delta
data: {"delta":"你的腿部"}

event: text_delta
data: {"delta":"今天恢复程度中等"}

...

event: structured_output
data: {"summary":"...","recommendation":"...","evidence":[...],"risk_level":"low","disclaimer":"..."}

event: state
data: {"state":"done","session_id":"uuid","message_id":"uuid","usage":{"input_tokens":1234,"output_tokens":456}}
```

**错误事件**：

```
event: error
data: {"code":"AI_PROVIDER_ERROR","message":"upstream timeout"}
```

**注意**：

- 这个接口不能用 `EventSource`（GET-only），必须 fetch + ReadableStream
- 鉴权用 `Authorization` header（同其他接口）

> 实现说明：当前线上端点是 `POST /api/assistant/stream-turn`，实际事件名是
> `state` / `session` / `provider_selected` / `tool_call_started` / `tool_call_finished` /
> `answer_delta` / `structured_output` / `done` / `error`（上方示例是早期草案命名，待整段重写）。

**多步 Agent 事件（Phase 6.0，`next_week_plan` intent）**：

`next_week_plan` 走多步 ReAct 规划器，额外发以下事件，并新增 `state: "planning"`：

```
event: state
data: {"state":"planning"}

event: agent_step_started
data: {"index":1,"kind":"tool","title":"查训练容量","thought":"...","tool_name":"get_weekly_training_report"}

event: agent_step_finished
data: {"index":1,"status":"success","duration_ms":12,"observation":"训练 4 次 / 40 组；约每周 4 次；..."}

...（找弱项 / 查进展 / 检索知识 / 生成草案，共最多 5 步）

event: structured_output
data: {"intent":"next_week_plan","answer":{...},"agent_trace":{...},"plan":{"strategy":"maintain","exercises":[{"exercise_name":"Barbell Bench Press","sets":3,"rep_min":6,"rep_max":10,"target_weight_kg":72.5,"basis":"基于估算 1RM ..."}],"notes":["..."]}}
```

- `kind`：`tool` | `retrieval` | `synthesis`；`status`：`success` | `error` | `skipped`。
- `agent_trace` 随 `structured_output` 一并持久化到消息，可在历史里重渲染 trace 时间线。
- `structured_output` 在 `next_week_plan` agent 路径可选带 `plan`：确定性生成的可执行下周草案 `{ strategy, exercises[{ exercise_name, sets, rep_min, rep_max, target_weight_kg, basis }], notes[] }`（见 `ai-decisions.md` D23）。`target_weight_kg` 仅在有真实重量基线（估算 1RM / 近期最高重量）时给出，否则为 `null`（不编造）。**结构化字段、不内联进答案文本**——因此不进入 faithfulness 数字扫描。本片先不落库；前端结构化渲染留作后续 Slice。
- `structured_output` 可选带 `faithfulness`：`{ status: "verified" | "flagged", checkedNumbers, unverifiedClaims[] }`（运行时确定性 faithfulness 校验结果，见 `ai-decisions.md` D21）。常规工具路径与 `next_week_plan` agent 路径会带；knowledge/unsupported 等无工具数据的路径不带。仅标注、不改答案文案。前端可据此渲染"数据已核对"徽章（后续 Slice）。
- 前端对未知事件类型必须**忽略**（向前兼容），不能当成错误处理。
- 客户端可通过 `AbortController` 中断；后端要妥善处理 connection close

### GET /api/sessions

查询会话列表（鉴权）。

**Response 200**：

```json
{
  "ok": true,
  "data": {
    "items": [
      { "id": "uuid", "title": "腿日恢复咨询", "last_message_at": "...", "message_count": 4 }
    ]
  }
}
```

### GET /api/sessions/:id/messages

查询会话内的所有消息（用于刷新页面后恢复对话）。

**Response 200**：

```json
{
  "ok": true,
  "data": {
    "session": { "id": "uuid", "title": "..." },
    "messages": [
      {
        "id": "uuid",
        "role": "user",
        "content": [{ "type": "text", "text": "我今天能练腿吗" }],
        "created_at": "..."
      },
      {
        "id": "uuid",
        "role": "assistant",
        "content": [
          { "type": "tool_use", "id": "tu_1", "name": "get_recovery_status", "input": { "muscle_group": "legs" } },
          { "type": "text", "text": "..." }
        ],
        "structured_output": { ... },  // 业务封装的 JSON
        "created_at": "..."
      }
    ]
  }
}
```

### DELETE /api/sessions/:id

删除会话（级联删消息）。

------

## 7. 用户数据管理

### GET /api/me

返回当前用户的总体统计。

**Response 200**：

```json
{
  "ok": true,
  "data": {
    "user": { ... },
    "stats": {
      "total_workouts": 87,
      "total_sets": 1240,
      "first_workout_at": "...",
      "ai_calls_today": 7
    }
  }
}
```

### DELETE /api/me

注销账户，级联删除所有数据。

------

## 8. Tool Calling 内部约定（后端实现要点）

> 这里列的不是 HTTP 端点，是后端 AI 层与计算层的内部协议。

### 4 个 Tool 的 schema（写在 `shared/tools.ts`）

```typescript
export const TOOL_DEFINITIONS = [
  {
    name: 'get_recovery_status',
    description: '查询某肌群的当前恢复状态。返回疲劳分数（0-10）和距上次训练时间。',
    input_schema: {
      type: 'object',
      properties: {
        muscle_group: {
          type: 'string',
          enum: ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'core'],
          description: '肌群代码',
        },
      },
      required: ['muscle_group'],
    },
  },
  {
    name: 'get_progress_analysis',
    description: '分析某动作的最近进展和是否停滞。',
    input_schema: {
      type: 'object',
      properties: {
        exercise_code: { type: 'string', description: '动作代码，如 bench_press_barbell' },
        weeks: { type: 'integer', minimum: 4, maximum: 26, default: 8 },
      },
      required: ['exercise_code'],
    },
  },
  {
    name: 'get_weekly_volume_distribution',
    description: '查询最近 N 周各肌群的训练容量分布，识别薄弱点。',
    input_schema: {
      type: 'object',
      properties: {
        weeks: { type: 'integer', minimum: 1, maximum: 12, default: 4 },
      },
    },
  },
  {
    name: 'get_recent_training_signals',
    description: '获取最近 N 天的总体训练信号：场次、平均 RPE、总容量。',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'integer', minimum: 1, maximum: 90, default: 14 },
      },
    },
  },
] as const;
```

### Tool 返回结构

每个 Tool 必须返回**结论**而不是原始数据：

```typescript
// ✅ 好
{
  muscle_code: 'legs',
  fatigue_score: 5.2,
  status: 'moderate',
  days_since_last: 2,
  last_workout_at: '...',
  contributing_exercises: ['squat', 'leg_press']
}

// ❌ 坏
{
  raw_sets: [
    { exercise: 'squat', weight: 100, reps: 5, rpe: 8, performed_at: '...' },
    ... 50 条原始记录
  ]
}
```

------

## 9. 限流策略

| 端点                | 限制                  |
| ------------------- | --------------------- |
| 全局所有 API        | 60 req / IP / 分钟    |
| `/api/auth/login`   | 10 req / IP / 15 分钟 |
| `/api/chat`         | 20 req / 用户 / 分钟  |
| `/api/chat`（每日） | 50 req / 用户 / 天    |

超限返回 `429` + `Retry-After` header。

**已实现（roadmap §8 Slice 6）**：AI turn 端点 `POST /api/assistant/mock-turn` 与 `POST /api/assistant/stream-turn` 已挂 per-user 限流中间件——每用户 20 次/分钟超限返回 `RATE_LIMITED`、50 次/天超限返回 `AI_QUOTA_EXCEEDED`，均为 `429`，`error.details.retry_after_seconds` 给出重试秒数。当前为单进程内存计数（多实例/Serverless 各自计数；分布式需 Redis/DB，接口 seam 不变）。全局 60/IP/分钟与登录限流尚未实现。

------

## 10. 版本演进

API 当前版本：v1（隐式，不在 URL 里）。 若未来不兼容更新，加 `/api/v2/` 前缀。本项目周期内不会涉及。
------

## Phase 4.3 Addition - Training Muscle Load

### GET /api/training/muscle-load

Returns deterministic muscle-group load distribution for the authenticated user.

Authentication:

- Requires `Authorization: Bearer <jwt>`.
- `user_id` is always read from auth context.
- `user_id` query/body/tool args are not accepted as authority.

Query:

- `start_date`: `YYYY-MM-DD`
- `end_date`: `YYYY-MM-DD`

Calculation:

- `raw_volume = weight_kg * reps`
- `normalized_contribution_weight = contribution_weight / sum(contribution_weight for the exercise)`
- `weighted_volume = raw_volume * normalized_contribution_weight`
- `contribution_ratio = muscle_group_weighted_volume / total_weighted_volume`

Response data:

- `range`: requested date-only range.
- `totals`: workout count, set count, total reps, raw volume, weighted volume, and represented muscle-group count.
- `by_muscle_group`: grouped muscle rows with raw volume, weighted volume, contribution ratio, and top contributing exercises.
- `top_muscle_groups`: highest weighted-volume groups.
- `low_volume_muscle_groups`: lowest nonzero recorded-volume groups; this is not an `undertrained` judgment.
- `evidence`: workout ids, set ids, and calculation rules.

------

## Phase 4.3 Addition - Assistant Insights

### GET /api/training/assistant-insights

Returns deterministic assistant dashboard cards for the authenticated user.

Authentication:

- Requires `Authorization: Bearer <jwt>`.
- `user_id` is always read from auth context.
- `user_id` query/body/tool args are not accepted as authority.

Query:

- `start_date`: `YYYY-MM-DD`
- `end_date`: `YYYY-MM-DD`
- `exercise_id`: optional selected exercise UUID

Response data:

- `range`: requested date-only range.
- `overview`: workout count, set count, total volume, top muscle group name, and top exercise name.
- `cards`: dashboard-ready assistant insight cards.
- `limitations`: user-facing boundaries for deterministic reminders.
- `evidence`: aggregate counts, calculation source names, and calculation rules. Raw workout/set ids are intentionally not returned by this endpoint.

Notes:

- This endpoint is deterministic and does not call an LLM.
- The frontend renders the returned view-model and should not duplicate card business rules.
- Muscle concentration language must stay conservative: lower share / higher share / current records are concentrated in, not undertrained or medical risk.

------

## Phase 4.4 Addition - Natural Language Workout Intake

### POST /api/training/workout-intake/parse

Parses a natural-language workout description into a structured workout draft for later user confirmation.

Authentication:

- Requires `Authorization: Bearer <jwt>`.
- `user_id` is always read from auth context.
- `user_id` query/body values are ignored and must not affect parsing or persistence.

Request:

- `text`: required natural-language workout description.
- `performed_at`: optional ISO datetime; defaults to current server time when omitted.
- `duration_min`: optional positive integer.
- `note`: optional string.

Response data:

- `draft.performed_at`: ISO datetime used by the draft.
- `draft.date_source`: `explicit_text`, `request_performed_at`, or `server_default`.
- `draft.date_label`: recognized text date label such as `昨天` or normalized date such as `2026-05-29`.
- `draft.duration_min`: provided duration or `null`.
- `draft.note`: provided note or `null`.
- `draft.exercises`: parsed exercise drafts with input name, match status, candidates, and parsed sets.
- `draft.exercises[].sets`: complete, saveable set drafts. `weight_kg` and `reps` are positive values; the parser must not emit fake zero values for missing fields.
- `draft.exercises[].incomplete_sets`: partial set facts recognized from oral / natural-language text, such as group count and weight without reps. These rows are not saveable until the user corrects the transcript and reparses.
- `unresolved_items`: names that were ambiguous, unmatched, or missing parsable sets.
- `warnings`: user-facing parse limitations.
- `evidence`: parser version, rules, parser source, and fallback warnings.

Notes:

- This endpoint only generates a draft and does not create `workouts` or `sets`.
- The endpoint runs the deterministic rule parser first; Batch 6 can optionally use an LLM structured fallback for low-quality oral parses.
- Ambiguous exercise names return candidates and must be confirmed by the user.
- This is natural-language / transcript intake only, not backend STT, audio upload, RAG, MCP, or Agent behavior.
- Phase 4.4 Batch 5B keeps the parser conservative for oral inputs: missing weight or reps returns `incomplete_sets` and warnings instead of manufacturing values like `1kg x 0` or `7kg x 0`.

### Phase 4.4 Batch 2 - Exercise Alias Matching

The workout-intake parser now uses a deterministic system alias layer before fallback name matching.

Alias behavior:

- Exact system aliases can resolve directly to one standard exercise.
- Broad aliases can intentionally return multiple candidates with `match_status: "ambiguous"`.
- Unknown movement names still return `match_status: "unresolved"`.
- Alias matching only affects draft generation and never writes workout data.

Current boundaries:

- Aliases are code-defined system aliases keyed by exercise `code`.
- There is no user-custom alias table or migration in this batch.
- Ambiguous aliases must be confirmed by a future UI before saving through the existing workout API.

### Phase 4.4 Batch 5B - Voice Intake UX & Parser Guardrails

The intake response now supports incomplete set drafts for recognized but unsaveable oral descriptions.

Example:

- Input: `我昨天训练了背部做了高位下拉做了十组，每组是70公斤`
- Draft: matched `高位下拉`, `sets: []`, `incomplete_sets[0].group_count: 10`, `incomplete_sets[0].weight_kg: 70`, `incomplete_sets[0].missing_fields: ["reps"]`

Contract boundaries:

- Complete `sets` remain the only source for save payload construction.
- `incomplete_sets` is review-only metadata that blocks save.
- Context words such as `背部`, `今天`, `昨天`, `训练`, `练了`, `做了`, `每组`, and `然后` should not become standalone unresolved exercises.
- Intake exercise display names are Chinese-first where a known Chinese name is available, with English fallback.
- This batch still does not add LLM parsing, backend STT, audio upload, audio storage, or any workout persistence from the parse endpoint.

### Phase 4.4 Batch 6 - LLM Structured Workout Intake Fallback

The parse endpoint remains `POST /api/training/workout-intake/parse`, but the backend can now use a hybrid parser:

- `evidence.source = "rule_parser"` when deterministic rules produce a complete draft.
- `evidence.source = "llm_structured_fallback"` when a low-quality rule parse is repaired by the structured fallback.
- `evidence.source = "rule_parser_llm_unavailable"` when fallback is disabled, unavailable, or fails schema validation.
- `evidence.fallback_warnings` contains fallback failure details when the conservative rule result is returned.

Fallback boundaries:

- LLM output is strict JSON validated by Zod.
- LLM output can contain `spoken_name`, complete `sets`, incomplete set facts, and warnings.
- LLM output must not contain `exercise_id`; database exercise matching still uses the deterministic exercise matching service.
- LLM fallback never creates `workouts` or `sets`; user confirmation and the existing create workout API remain the only persistence path.
- `WORKOUT_INTAKE_LLM_PROVIDER` supports `off`, `mock`, and `anthropic`, defaulting to `mock` for local tests and smoke.
- Phase 4.4 Batch 6B treats a matched exercise with no valid sets as low quality and attempts fallback, so oral phrases like `我今天训练了背部做了高位下拉做了3组每组做的是70公斤然后每组做了10次` can return a saveable draft instead of a matched empty row.
- User-facing parse warnings are Chinese product copy; provider/debug failures remain in `evidence.fallback_warnings`.
- Phase 4.4 Batch 6C resolves date hints like `昨天`, `前天`, `5月29号`, `五月二十九号`, `2026年5月29日`, `5/29`, and `2026-05-29` into `draft.performed_at`. Explicit text dates take priority over request `performed_at`; if text has no date, the request value is used; otherwise server time is used.
- Phase 4.4 Batch 6D expands the system dictionary and alias map for common Chinese gym movements such as `哑铃推肩`, `坐姿哑铃推肩`, `引体向上`, `侧平举`, `杠铃划船`, `哑铃划船`, `腿屈伸`, `腿弯举`, and `臀推`.
- Broad aliases such as `推肩`, `划船`, `夹胸`, `飞鸟`, `下拉`, and `弯举` remain ambiguous and must be confirmed by the user before saving.
- Expanded exercise-muscle contribution weights are deterministic approximations for training load analysis; they are not medical or rehab advice.

------

## Phase 5.0 Addition - Weekly Training Report

### GET /api/training/weekly-report

Returns a deterministic weekly training coach report for the authenticated user.

Authentication:

- Requires `Authorization: Bearer <jwt>`.
- `user_id` is always read from auth context.
- `user_id` query/body values are not accepted.

Query:

- `start_date`: `YYYY-MM-DD`
- `end_date`: `YYYY-MM-DD`
- `exercise_id`: optional selected exercise UUID

Response data:

- `range`: requested date-only range.
- `status`: `empty` or `ready`.
- `totals`: workout count, set count, total reps, total volume, and total weighted volume.
- `frequency`: range days and normalized workouts per week.
- `top_exercises`: highest-volume exercises in the selected range.
- `top_muscle_groups`: highest weighted-volume muscle groups from muscle-load analysis.
- `low_volume_muscle_groups`: lowest nonzero recorded-volume muscle groups.
- `selected_exercise_progress`: optional progress summary when `exercise_id` is provided.
- `recovery_notes`: conservative reminders based on recent recorded workouts only.
- `limitations`: user-facing boundaries; this is not medical advice or a professional coaching prescription.
- `evidence`: workout ids, set ids, calculation sources, and calculation rules.

Assistant integration:

- `weekly_report` uses `get_weekly_training_report` and returns Evidence.
- `plateau_diagnosis` uses exercise progress Evidence plus RAG Sources when an exercise is selected.
- `next_week_plan` uses weekly report Evidence plus RAG Sources and must describe the output as a draft, not a prescription.
- Unsupported prompts continue to return no Evidence and no Sources.

------

## Phase 5.1 Addition - Assistant Saved Insights

Saved insights persist selected Assistant replies for authenticated users. This is copy-text sharing only: no public URLs, no anonymous access, and no Assistant answer-shape change.

Eligible assistant intents:

- `weekly_report`
- `plateau_diagnosis`
- `next_week_plan`

### POST /api/assistant/insights

Saves one eligible assistant reply.

Authentication:

- Requires `Authorization: Bearer <jwt>`.
- `message_id` must belong to the authenticated user's chat session.

Request:

```json
{
  "message_id": "uuid"
}
```

Response 201 data:

- `id`: saved insight id.
- `message_id`: original assistant message id, or `null` for seeded demo snapshots.
- `insight_type`: `weekly_report`, `plateau_diagnosis`, or `next_week_plan`.
- `title`: stable display title.
- `summary`: assistant answer summary text.
- `structured_snapshot`: durable display snapshot with message text, intent, Evidence counts/tool names, Source titles/categories, limitations, and a structured output subset.
- `share_text`: stable copy-text summary with intent, summary, Evidence counts, Source titles, and limitations.
- `created_at` / `updated_at`.

Rejects:

- user messages.
- unsupported / knowledge / mixed / generic assistant replies.
- missing message ids.
- cross-user message ids.

### GET /api/assistant/insights

Lists the authenticated user's recent saved insights.

Response 200:

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "message_id": "uuid",
        "insight_type": "weekly_report",
        "title": "Weekly Training Report",
        "summary": "...",
        "share_text": "...",
        "created_at": "2026-06-08T00:00:00.000Z",
        "updated_at": "2026-06-08T00:00:00.000Z"
      }
    ]
  }
}
```

### GET /api/assistant/insights/:id

Returns one saved insight for the authenticated user.

### DELETE /api/assistant/insights/:id

Deletes one saved insight for the authenticated user.

Response 200:

```json
{
  "ok": true,
  "data": {
    "deleted": true,
    "id": "uuid"
  }
}
```

## Slice 4 Addition - Athlete Profile

薄运动员档案，一人一档（user_id 主键，upsert）；注入 next-week-plan agent 做个性化 + 安全提示。鉴权必填（cookie/Bearer）。

### GET /api/athlete-profile

Returns the authenticated user's profile, or `null` when none saved yet.

Response 200:

```json
{
  "ok": true,
  "data": {
    "profile": {
      "goal": "hypertrophy",
      "weeklyDays": 4,
      "availableEquipment": ["barbell", "dumbbell"],
      "injuryConstraints": ["knee"],
      "updatedAt": "2026-06-14T00:00:00.000Z"
    }
  }
}
```

### PUT /api/athlete-profile

Validates (zod, `.strict()`) and upserts the profile. Body:

```json
{
  "goal": "strength | hypertrophy | endurance | general_fitness",
  "weeklyDays": 1,
  "availableEquipment": ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell"],
  "injuryConstraints": ["knee"]
}
```

- `weeklyDays` 1–7；`goal` 受控枚举；`availableEquipment` 受控词表；`injuryConstraints` 自由标签（service 归一化小写 + 去重，≤10 个 / 每个 ≤40 字）。
- 不接受请求体里的 `user_id` 等额外字段（`.strict()` 拒绝）。
- Response 200 返回与 GET 相同的 `{ profile }` 结构。
