# API 接口约定（api-contract.md）

> 所有 API 路径前缀 `/api`。返回格式统一。错误码统一。 改 API 必须同步改本文档 + `shared/types/`。

------

## 1. 通用约定

### 1.1 请求

- Content-Type: `application/json`（除 SSE 端点）
- Authorization: `Bearer <jwt>`（除登录 / 注册）
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

**Response 201**：

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

**Response 200**：返回同 register。

### GET /api/auth/me

获取当前用户信息（鉴权）。

**Response 200**：

```json
{ "ok": true, "data": { "user": { ... } } }
```

### POST /api/auth/logout

（生产化用 HttpOnly Cookie 后）清除 cookie。 MVP 阶段前端清掉 token 即可，后端可不实现。

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

------

## 10. 版本演进

API 当前版本：v1（隐式，不在 URL 里）。 若未来不兼容更新，加 `/api/v2/` 前缀。本项目周期内不会涉及。