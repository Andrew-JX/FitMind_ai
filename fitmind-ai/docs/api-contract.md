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

### GET /api/auth/registration-policy

返回本实例当前的注册政策。**无需鉴权**——客户端要在还没有账号时读它，才能如实渲染注册入口，而不是收完表单再回 `403`。

**Response 200**：

```json
{
  "ok": true,
  "data": {
    "registration_open": true,
    "policy_version": "2026-08-09",
    "data_residency": "overseas",
    "cross_border_consent_required": true
  }
}
```

- `registration_open`：`REGISTRATION_INVITE_ONLY` 的反面。
- `data_residency`：由 `DATA_RESIDENCY` 决定（`overseas` / `mainland`），**失败即境外**：未设置或拼错都按境外处理。两种错法代价不对称——境内实例多问一次同意只是多一个勾选框，境外实例漏问就是出境无单独同意。
- `cross_border_consent_required`：`data_residency === "overseas"`。
- `policy_version`：客户端提交同意时必须原样带回；服务端只接受当前版本，见下。

### POST /api/auth/register

注册新用户。

**Request**：

```json
{
  "email": "user@example.com",
  "password": "atleast8chars",
  "display_name": "Andrew",
  "cross_border_consent": { "accepted": true, "policy_version": "2026-08-09" }
}
```

`cross_border_consent` 在 `cross_border_consent_required` 为 `true` 的实例上**必填**。这条校验在服务端，不在浏览器：此前它只存在于 `AuthScreen` 的提交函数里，直接 `POST` 本端点可以完全绕过。

用户行与同意记录**在同一个事务里写入**（`user_consents`）。同意写失败则用户一并回滚——否则会留下一个「账号存在、但没有任何记录证明当初被允许创建」的状态，而且从用户视角完全看不出来。

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

**Response 403**：邀请制部署下自助注册关闭。闸门排在限流之前，被拒的请求不消耗限流额度。

```json
{
  "ok": false,
  "error": {
    "code": "REGISTRATION_CLOSED",
    "message": "Registration is invite-only."
  }
}
```

由 `REGISTRATION_INVITE_ONLY` 控制，**失败即关闭**：未设置、留空、拼错都保持关闭，只有显式 `off/false/0/no` 才开放注册。理由与上线口径见 [`china-launch-plan.md`](./china-launch-plan.md) §3.2a。关闭期间建号用 `pnpm create:user -- --email <address>`（直连数据库，绕过本闸门）。

**Response 422**：本实例要求跨境同意，而请求缺少同意、明确拒绝、或带的是已被取代的政策版本。

```json
{
  "ok": false,
  "error": {
    "code": "CONSENT_REQUIRED",
    "message": "Creating an account on this instance requires consent to storing your data outside mainland China.",
    "details": {
      "consent_type": "cross_border_transfer",
      "expected_policy_version": "2026-08-09"
    }
  }
}
```

版本过期一律拒绝，不做「收下再升级」：缓存了旧 JS 的客户端否则会提交对一段已经不再展示的文案的同意，存下来的记录会声称用户同意了他从没看过的内容。`expected_policy_version` 只在版本不符时出现。

### POST /api/auth/login

**Request**：

```json
{ "email": "...", "password": "..." }
```

**Response 200**：返回同 register（同样 `Set-Cookie` 写入会话 cookie）。

### Auth rate-limit responses

`POST /api/auth/register` and `POST /api/auth/login` are rate-limited before their controllers run:

- register: `5` requests per minute per client IP.
- login: `10` requests per minute per client IP.
- `POST /api/auth/logout` and `GET /api/auth/me` are not covered by this auth endpoint limiter.

When exceeded, both endpoints return:

```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limited.",
    "details": {
      "retry_after_seconds": 60
    }
  }
}
```

### GET /api/auth/me

获取当前用户信息（鉴权）。

**Response 200**：

```json
{
  "ok": true,
  "data": {
    "user": { "id": "uuid", "email": "...", "display_name": "Andrew" },
    "pending_consents": [
      { "consent_type": "cross_border_transfer", "policy_version": "2026-08-09" }
    ]
  }
}
```

**服务端强制**：`pending_consents` 非空的账号，调用**任何**鉴权端点都返回 `403 CONSENT_REQUIRED`（`error.details.pending_consents` 带上欠的项）。闸门做在 `authMiddleware` 里且**默认开启**，此前这个拦截只存在于 `App.tsx`，也就是根本不存在。

豁免清单**只有四条**，每条都是补签流程自身需要的，显式用 `authMiddlewareAllowingPendingConsents`：

| 端点 | 为什么必须豁免 |
| --- | --- |
| `GET /api/auth/me` | 不豁免就看不到自己欠什么 |
| `POST /api/auth/consents` | 不豁免就没法签 |
| `DELETE /api/auth/account` | 不豁免则拒绝的人既不能同意也不能离开 |
| `DELETE /api/athlete-profile/injury-constraints` | 不豁免则欠健康同意的人无法撤回伤病数据，只剩「同意/退出/删号」 |
| `DELETE /api/menstrual-records` | 允许只删除经期数据，不强迫用户连其他健康类别一起删除 |
| `DELETE /api/body-measurements` | 允许只删除全部身体测量，不强迫用户接受补签或全量删除 |
| `DELETE /api/body-measurements/:id` | 允许在补签前删除指定身体测量，范围仍受账号所有权约束 |
| `POST /api/auth/logout` | 本来就不鉴权 |

默认开启是要点：新加的业务路由只要用 `authMiddleware` 就自动带闸门，**不存在「忘了加」这种失败方式**，只存在「显式写了豁免」这种需要被 review 的动作。

`pending_consents` 是本实例当前政策下**这个账号还欠的同意**，注册后建的账号恒为空数组。它存在是为了处理同意接缝之前建的老账号：**不做回填迁移**——替他们插一条同意记录等于替他们签字。他们在这里浮出来，然后在应用内被问一次。

`sensitive_health_data` 只对**确实存了伤病约束、经期日期或身体测量数据**的用户出现。没填过健康数据的人不该被要求为一件没发生的事情签字。

### DELETE /api/auth/account

从**活动数据库**删除当前账号及其数据（鉴权 + **重新认证**）。级联删除 9 张引用 `users` 的表，含 `user_consents` 本身——人和数据都不在了，同意记录没有留存的依据。

**Request**：`{ "password": "<当前密码>" }`

**重新认证是必需的，不是装饰。** 会话 token 有效期 7 天，没有这一层的话，一个泄露的 cookie 就足以永久摧毁一个账号——这是本 API 里**唯一没有撤销、事后也查不到痕迹**的动作。UI 上的二次确认保护不了任何直接调 API 的场景，因为攻击者用的不是 UI。密码不符返回 `401`，缺字段返回 `400`，两种情况都不会删任何东西。

**Response 200**：`{ "ok": true, "data": { "success": true } }`，同时清除会话 cookie（留着会让浏览器每个后续请求都 401 且无从解释）。

**这个端点删的是活动库，不是所有副本。** `DELETE FROM users` 走完之后，托管商的历史/时间点恢复窗口内仍可能存在副本（Neon 的 history retention 最长可达 30 天，实际值需从项目控制台确认）。因此对外文案只能说「从活动数据库删除并停止业务处理，备份与历史副本在保留期届满后清除」——**不能说「立即永久删除、无法恢复」**，那句话本代码证明不了。

### DELETE /api/athlete-profile/injury-constraints

只删除已存的伤病约束，不动档案里的其他字段（鉴权）。

**Response 200**：`{ "ok": true, "data": { "success": true } }`。幂等：本来就没有伤病数据时也返回 200，那正是调用方想要的状态。

**两个撤回入口，一个撤回操作。** 这个端点和「清空后保存 `PUT`」走的是仓储层同一个私有撤回函数，在同一把 `users` 行锁、同一个事务、同一个连接上执行同一条 `UPDATE`。不是两份彼此对齐的实现——今天对齐的两份实现，就是明天会分叉的两份实现。UI 入口见 `docs/UI_SPEC.md` §11。

**豁免同意闸门。** 欠健康同意的用户被闸门挡在 `PUT /api/athlete-profile` 之外，也就无法把 `injuryConstraints` 清空；如果这条也挂闸门，他们就只剩三个选项：违心同意、退出但数据照存、删掉整个账号连同全部训练历史。那正是 PIPL 第 15 条（便捷撤回）与第 16 条（不得因拒绝无关同意而拒绝服务）要防的陷阱。

**范围严格受限**：服务端只把 `injury_constraints` 置空，训练目标、每周天数、可用器械原样保留——那些是用户同意过的一般个人信息，顺手一起删会让撤回的代价高于它应有的样子。

删完之后 `pending_consents` 里的 `sensitive_health_data` 自动消失：不再存储敏感信息，也就没有要征求的同意了。

**与同意闸门的关系**：本端点用 `authMiddlewareAllowingPendingConsents`，**欠同意时也能调用**。这是补签页「不同意」的真实出口——只退出登录不会停止任何处理，数据仍在境外库里；只有删除会。把删除挡在闸门后面，等于让拒绝的人既不能同意也不能离开。

**重复删除返回 `401`，不是 200。** 账号已经不存在，所以密码校验前的用户查找拿不到人，请求按未鉴权拒绝。这是对的行为，但要写清楚——本节此前写着「幂等，返回 200」，而唯一支撑它的测试其实模拟的是「查到用户后被并发删掉」，不是第二次请求。**一个只在假场景下成立的断言，比没有断言更糟。**

**撤回会同时撤销同意**：清空 `injury_constraints` 的同时给 `user_consents` 里那条 `sensitive_health_data` 盖上 `revoked_at`。只清数据不撤同意的话，用户下次再填伤病时 `saveProfileWithHealthConsent` 的锁内同意重读会看到那条仍然有效的同意直接放行——一次会自己解除的撤回。行本身保留不删：它仍然是「在这段时间里处理是被允许的」的证据，删掉会让撤回和从未同意过变得无法区分。

### POST /api/auth/consents

**只用于补签**：记录本账号**当前确实欠着**的同意（鉴权）。注册走 register 请求内嵌的字段，以便和用户行共享事务；**填写档案时的健康同意走 PUT `/api/athlete-profile` 内嵌的 `sensitiveHealthConsent`，不走本端点**。

本端点会先算一遍 `pending_consents`，请求的 `consent_type` 不在其中就返回 `422`。这条限制是要点不是修饰：没有它，客户端可以凭空 POST 一条 `sensitive_health_data` 同意、**之后**再保存伤病数据，于是「填写那一刻单独问」退化成「调用方想什么时候问就什么时候问」——同意与它所授权的处理脱钩，正是 29 条单独同意要防的事。

因此**新产生**的健康数据无法从这里取得同意；本端点覆盖的是补签场景：当前政策版本生效前就已存在的伤病、经期或身体测量数据。「欠不欠」由数据库回答（已存的健康数据、已有的同意行），不由请求声明。

**Request**：

```json
{
  "consent_type": "cross_border_transfer",
  "accepted": true,
  "policy_version": "2026-08-09"
}
```

**Response 201**：返回存下的同意行。

同一 `(user_id, consent_type, policy_version)` 重复提交会因为「已经不欠了」而返回 `422`；即便绕过该检查，仓储层的 upsert 也返回原记录且**不刷新 `accepted_at`**：那个时间戳记的是他何时同意，不是他何时又打开了一次页面。

`accepted: false` 返回 `422 CONSENT_REQUIRED` 而不是存一行 `accepted = false`。本表里「有一行」就是「给过许可」的证据，拒绝是这个证据的缺席；把拒绝也存成行，会让整张表的含义从「行是否存在」变成「要去读某一列」。拒绝的人继续欠着，应用继续问。

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
- Invalid `cursor` values return `400 VALIDATION_ERROR` with message `Invalid workout cursor.` before any workout repository query is attempted.

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

> ⚠️ 本节曾描述一套 `/api/analytics/*` 设计，那套接口**从未实现**，实际建成的是下面的 `/api/training/*`。2026-07-27 更正。

普通查询接口，供前端展示（不经过 AI）。AI 工具调用对应的 service 函数，不走 HTTP。全部需要鉴权，返回统一信封。

日期范围参数统一为 `start_date` / `end_date`（`YYYY-MM-DD`，闭区间，非法或倒置返回 `VALIDATION_ERROR`）。

| 端点 | 用途 | 关键返回 |
| --- | --- | --- |
| `GET /api/training/summary` | 区间训练汇总 | `range` / `totals`（次数·组数·次数·容量）/ `by_exercise`（按容量降序）/ `evidence` |
| `GET /api/training/exercise-progress` | 单动作进展，额外需 `exercise_id`(uuid) | `exercise` / `totals`（含 `max_weight_kg`、`estimated_1rm_kg`）/ `sessions`（按时间升序）/ `evidence` |
| `GET /api/training/muscle-load` | 肌群加权容量分布 | 见「Phase 4.3 Addition」一节 |
| `GET /api/training/recommendation-context` | 给助手用的确定性上下文预览 | `summary` / `focus_exercises` / `recent_workouts` |
| `GET /api/training/assistant-insights` | 主动洞察看板数据 | 见「Phase 4.3 Addition」一节 |
| `GET /api/training/weekly-report` | 周报 | 见「Phase 5.0 Addition」一节 |

**口径约束**：这些端点只做确定性计算，返回里出现的每个数字都必须能由 `evidence` 中的 workout/set 复算出来。`range` 必须回显服务端实际使用的区间——前端文案据此标注，不得自行命名时间窗口。

------

## 6. AI 聊天模块（核心）

> ⚠️ 本节曾描述 `/api/chat`（POST，SSE）与一组 `/api/sessions` 读取端点，均**从未实现**。实际的助手入口是下面两个。2026-07-27 更正。

### POST /api/assistant/stream-turn（SSE，主入口）

见「6.1 SSE 事件契约」。请求体：`mode` / `message` / `start_date` / `end_date` / 可选 `exercise_id` / 可选 `session_id`（带上即续用同一会话）。

### POST /api/assistant/mock-turn

同一编排的非流式版本，返回一次性 JSON，供测试与不支持 SSE 的客户端使用。

当请求携带 `session_id` 时，该会话必须属于当前认证用户。会话不存在或属于其他用户均返回同一安全响应：HTTP `404`，`error.code = "NOT_FOUND"`，`error.message = "Chat session was not found."`；接口不会向调用者披露其他用户会话是否存在。

两个端点都挂 per-user 限流（见 §9）。会话历史目前没有独立的读取端点：`session_id` 由 `done` 事件回传，客户端自行保留。

------

## 7. 用户数据管理

> ⚠️ 本节曾描述 `/api/me` 的读取（用户总体统计）与删除（注销并级联删除）两个端点，均**未实现**。当前只有下列端点。2026-07-27 更正。

| 端点 | 用途 |
| --- | --- |
| `GET /api/auth/me` | 返回当前登录用户（见 §2），不含统计 |
| `GET /api/athlete-profile` / `PUT /api/athlete-profile` | 训练档案，见「Slice 4 Addition」一节 |
| `POST /api/feedback` | 应用内反馈。请求体 `message`（必填）+ 可选 `source_route`；返回创建的反馈 id |

账户注销尚未实现，需要时另行设计（涉及级联删除范围与不可逆确认）。


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
| `/api/auth/register` | 5 req / IP / minute |
| `/api/auth/login`   | 10 req / IP / minute |
| `/api/chat`         | 20 req / 用户 / 分钟  |
| `/api/chat`（每日） | 50 req / 用户 / 天    |

超限返回 `429` + `Retry-After` header。

**已实现（roadmap §8 Slice 6）**：AI turn 端点 `POST /api/assistant/mock-turn` 与 `POST /api/assistant/stream-turn` 已挂 per-user 限流中间件——每用户 20 次/分钟超限返回 `RATE_LIMITED`、50 次/天超限返回 `AI_QUOTA_EXCEEDED`，均为 `429`，`error.details.retry_after_seconds` 给出重试秒数。当前为单进程内存计数（多实例/Serverless 各自计数；分布式需 Redis/DB，接口 seam 不变）。全局 60/IP/分钟尚未实现；auth register/login endpoint 限流见 hardening-1 T3。

**Implemented in hardening-1 T3**: auth register/login endpoint limits now return `429 RATE_LIMITED` with `error.details.retry_after_seconds`. They are in-memory per server instance and keyed by Express `req.ip` plus the auth route.

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
- `WORKOUT_INTAKE_LLM_PROVIDER` supports `off`, `mock`, `anthropic`, `gemini`, `groq`, and `openai_compatible`, defaulting to `mock` for local tests and smoke (prod can use `groq` or an OpenAI-compatible BYO endpoint).
- `openai_compatible` uses the shared `OPENAI_COMPAT_BASE_URL` / `OPENAI_COMPAT_MODEL` / `OPENAI_COMPAT_API_KEY` env vars and must point at an HTTPS `/chat/completions` compatible service. This is text parsing only; browser speech recognition remains Web Speech API.
- Phase 4.4 Batch 6B treats a matched exercise with no valid sets as low quality and attempts fallback, so oral phrases like `我今天训练了背部做了高位下拉做了3组每组做的是70公斤然后每组做了10次` can return a saveable draft instead of a matched empty row.
- **roadmap §8.2 Slice 12 (varied-set escalation, `ai-decisions.md` D30)**: when the text mentions ≥2 distinct weights but the rule parser captured fewer distinct weights (oral filler like 做了/加到 dropping `weight×reps` pairs and flattening per-set weights), the hybrid parser escalates to the LLM fallback even though the rule draft looked "complete". Compares distinct-weight counts (not values), so it is safe across lb→kg conversion.
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

Intent routing & honesty boundaries (roadmap §8 Slice 11a + §8.2 A/B; `ai-decisions.md` D32/D33):

- Free-text messages are sent with `mode: "auto"` and routed by the deterministic keyword classifier (`classifyAssistantIntent`). Quick prompts / insight cards send an explicit `mode`. (Known limitation: the classifier and the mock-provider path are dual-track — convergence is deferred to Slice 11.)
- An `unsupported` route now splits:
  - **Out-of-scope** (weather/jokes/stocks blocklist, or empty) → polite clarification refusal, **no Evidence, no Sources**.
  - **Unmatched but training-anchored** (the message contains a curated training term, e.g. 疲劳/恢复) → attempts knowledge retrieval; if relevant knowledge is found it returns a **`knowledge`** answer with Sources, otherwise the same clarification. So "unsupported prompts return no Sources" is **no longer absolute** — anchored ones can be recovered.
- **Knowledge relevance floor (D33)**: `knowledge` answers (and the fallback above) only use retrieved chunks that **lexically overlap** the query's curated tokens (`filterRelevantKnowledgeChunks`). Topics the small KB does not cover (e.g. 睡眠/热身) return an honest "no reliable material" reply instead of the semantically-nearest (wrong) chunk. Lexical overlap is deterministic (no run-to-run flicker); chosen over a vector-score threshold.

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
    },
    "health_consent_on_file": true
  }
}
```

`health_consent_on_file`：该用户在**当前政策版本**下是否已给出 `sensitive_health_data` 同意。表单靠它决定要不要问——没有这个标志，客户端只能每次保存都重复问（把用户训练成闭眼勾），或者凭空假设一个它无从知道的答案。

`withdrawable_health_consent`：该用户是否存在**任意版本**的有效 `sensitive_health_data` 同意，即是否有一项权限可供撤回。**和上一个标志是两个问题，不能合并**：在旧版本措辞下同意过的用户，今天不构成存储伤病数据的许可（所以表单必须重新问），但那条同意仍然有效、用户有权收回（所以撤回入口必须出现）。合并成一个布尔值，要么压掉勾选框、让保存以一个用户没被提醒过的 422 失败，要么藏掉撤回入口——后者就是 fitmind-lmy 换了个位置重演。

服务端这个标志与撤回语句共用同一个 SQL 谓词（`db-schema.md` §13.0），所以「界面提供撤回的范围」和「撤回实际撤掉的范围」不会各走各的。

### PUT /api/athlete-profile

Validates (zod, `.strict()`) and upserts the profile. Body:

```json
{
  "goal": "strength | hypertrophy | endurance | general_fitness",
  "weeklyDays": 1,
  "availableEquipment": ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell"],
  "injuryConstraints": ["knee"],
  "sensitiveHealthConsent": { "accepted": true, "policy_version": "2026-08-09" }
}
```

- `weeklyDays` 1–7；`goal` 受控枚举；`availableEquipment` 受控词表；`injuryConstraints` 自由标签（service 归一化小写 + 去重，≤10 个 / 每个 ≤40 字）。
- 不接受请求体里的 `user_id` 等额外字段（`.strict()` 拒绝）。
- Response 200 返回与 GET 相同的 `{ profile, health_consent_on_file }` 结构。

**`sensitiveHealthConsent`**：`injuryConstraints` 归一化后**非空**且用户尚无当前版本的健康同意时**必填**，否则返回 `422 CONSENT_REQUIRED`。伤病约束是 PIPL 第 28 条定义的敏感个人信息，第 29 条要求单独同意。

判定用的是**归一化之后**的列表，所以一份伤病标签全部被 trim 成空的请求，按空列表处理，不会为「存了个寂寞」索要同意。

**同意与档案在同一个事务、同一把锁内落地**（`saveProfileWithHealthConsent`）。此前这里写的是「同意先写、档案后写，刻意不放在同一个事务里」，理由是两个方向的失败不等价。理由没错，但它默认两条路径不会交错，而撤回同意是并发路径：保存读到同意有效 → 撤回在缝隙里提交 → 保存把伤病数据写回去，两个事务各自原子，合起来就是「存了敏感数据却没有授权」。现在读同意、写同意、写档案都在 `users` 行锁内的同一个客户端上完成，见 `docs/db-schema.md` §13.0（fitmind-9yz）。

**归一化后为空的 `injuryConstraints` 就是一次撤回**（fitmind-lmy）。同一个事务里清空伤病字段，并给该用户**所有仍有效的** `sensitive_health_data` 同意盖上 `revoked_at`：

- 不按政策版本过滤——用户撤回的是这个**类别**，留下一条旧版本的有效同意，下次保存的锁内重读就会放行。
- 不影响 `cross_border_transfer` 或其他类型的同意。
- 幂等：`revoked_at IS NULL` 保证重复的空保存不新增行、也不覆盖原来的撤回时间戳（撤回**发生在何时**正是这行要记录的事实）。
- 之后再填伤病，锁内重读发现无有效同意，返回 `422 CONSENT_REQUIRED`；带上新的当前版本同意才能存，且旧的已撤回行作为历史保留。

这条规则不是给按钮做的补充，而是相反：用户清空输入框再点保存，这个动作本身就该被理解成「别再留着了」。此前它只清数据不撤同意，于是下次填写会直接复用那条仍然有效的同意——**一次会自己解除的撤回**。

**这是新伤病数据取得健康同意的唯一路径。** `POST /api/auth/consents` 只处理补签，且会拒绝没有已存伤病数据的账号，所以「先写一条同意再存数据」这条绕路不成立。

## Slice 5 Addition - Planned Workouts (accept plan + adherence)

把助手生成的下周草案接受成 app 里的计划训练，并按 planned vs performed 给依从度。鉴权必填。

### POST /api/planned-workouts

接受一份计划草案（通常来自助手 `structured_output.plan`），持久化为 active 计划。Body（zod `.strict()`）：

```json
{
  "startDate": "2026-06-15",
  "endDate": "2026-06-21",
  "plan": {
    "strategy": "maintain",
    "exercises": [
      { "exercise_name": "Barbell Bench Press", "sets": 3, "rep_min": 6, "rep_max": 10, "target_weight_kg": 72.5, "basis": "..." }
    ],
    "notes": ["..."]
  },
  "sourceMessageId": "uuid (可选)"
}
```

- `endDate` 必须 ≥ `startDate`；plan 结构按 `NextWeekPlanDraft` 校验。
- Response 201：`{ "ok": true, "data": { "plannedWorkout": { id, status, startDate, endDate, plan, sourceMessageId, createdAt, updatedAt } } }`。

### GET /api/planned-workouts/current

返回当前 active 计划 + **读取时计算**的依从度，无则 `plannedWorkout: null`。

Response 200：

```json
{
  "ok": true,
  "data": {
    "plannedWorkout": {
      "id": "uuid", "status": "active", "startDate": "...", "endDate": "...",
      "plan": { "...": "NextWeekPlanDraft" },
      "adherence": {
        "planned_exercise_count": 2,
        "trained_exercise_count": 2,
        "extra_exercise_count": 0,
        "exercise_adherence_ratio": 1,
        "set_adherence_ratio": 0.7143,
        "exercises": [
          { "exercise_name": "Barbell Bench Press", "planned_sets": 3, "performed_sets": 3, "status": "done", "set_completion_ratio": 1 }
        ]
      }
    }
  }
}
```

- 依从度按计划周期内已记录训练的 by-exercise（动作名匹配，大小写/空格不敏感）确定性计算；状态 `done` / `partial` / `missed`；比例封顶 100%。

### PATCH /api/planned-workouts/:id

更新计划状态。Body：`{ "status": "completed" | "abandoned" }`（`.strict()`）。计划不存在 → 404 `NOT_FOUND`；Response 200 返回更新后的 `{ plannedWorkout }`。
## Slice 8 Addition - Weekly Report Digests

Tier 1 weekly report delivery generates deterministic weekly report snapshots on a schedule and shows them in-app. It does not implement Web Push.

### POST /api/cron/weekly-reports

Runs the weekly digest generator. Intended only for the Cloudflare scheduled worker.

Authentication:

- Requires `Authorization: Bearer <WEEKLY_REPORT_CRON_SECRET>`.
- Missing, wrong, or unconfigured secrets return `401 UNAUTHORIZED`.
- The response never includes the secret, user ids, raw report payloads, or per-user errors.

Response 200 data:

```json
{
  "enabled": true,
  "attempted": 1,
  "created": 1,
  "updated": 0,
  "skipped": 0,
  "failed": 0
}
```

Behavior:

- `WEEKLY_REPORT_DELIVERY_ENABLED=off` returns a safe no-op count response.
- Active users are users with at least one workout in the last 30 UTC days.
- The generated week is the previous UTC ISO week.
- Idempotency key is `(user_id, iso_year, iso_week)`.

### GET /api/training/weekly-report-digest

Returns the authenticated user's latest undismissed weekly report digest.

Response 200 data:

```json
{
  "digest": {
    "id": "uuid",
    "iso_year": 2026,
    "iso_week": 26,
    "week_start_date": "2026-06-22",
    "week_end_date": "2026-06-28",
    "status": "ready",
    "title": "Weekly report 2026-06-22 to 2026-06-28",
    "summary": "Recorded 2 workouts and 12 sets from 2026-06-22 to 2026-06-28. Top exercise: Bench Press.",
    "report_snapshot": {},
    "generated_at": "2026-07-01T00:00:00.000Z",
    "dismissed_at": null,
    "created_at": "2026-07-01T00:00:00.000Z",
    "updated_at": "2026-07-01T00:00:00.000Z"
  }
}
```

When no digest is visible, `digest` is `null`.

### PATCH /api/training/weekly-report-digests/:id

Dismisses one digest for the authenticated user.

Request:

```json
{
  "dismissed": true
}
```

Response 200 data:

```json
{
  "dismissed": true,
  "id": "uuid"
}
```

Rejects cross-user ids and unknown ids with `404 NOT_FOUND`.

## Personal tools

All routes below are authenticated and user-scoped. Health writes that create
sensitive data accept `sensitiveHealthConsent: { accepted, policy_version }`
when the current policy has not already been accepted. The consent check,
consent insert, and health-data write share one transaction and per-user lock.

### Menstrual records

- `GET /api/menstrual-records?month=YYYY-MM` returns `dates`,
  `showInHistory`, and the current health-consent flags.
- `PUT /api/menstrual-records/:date` accepts `{ isPeriod }` plus the optional
  consent object. `date` is an ISO calendar date.
- `PATCH /api/menstrual-records/settings` accepts `{ showInHistory }`.
- `DELETE /api/menstrual-records` deletes every menstrual date for the user.
  It remains authenticated but bypasses the pending-consent gate so declining
  users can delete this category without deleting unrelated health data.

### Body measurements

- `GET /api/body-measurements` returns up to 366 dated measurements, newest
  first, plus the current health-consent flags.
- `PUT /api/body-measurements` creates or replaces the record for
  `measuredOn`. Supported optional values are weight, target weight, body-fat
  percentage, neck/shoulder/chest/waist/hip, and bilateral upper-arm, thigh,
  and calf measurements. At least one value is required.
- `DELETE /api/body-measurements/:id` deletes one owned measurement.
- `DELETE /api/body-measurements` deletes all body measurements.
  Both deletes remain authenticated but bypass the pending-consent gate; reads
  and writes stay gated.

### Training memos

- `GET /api/training-memos` lists memos, pinned first and then newest first.
- `POST /api/training-memos` accepts `title`, `content`, and optional
  `isPinned`.
- `PATCH /api/training-memos/:id` updates any of those fields.
- `DELETE /api/training-memos/:id` deletes one owned memo.

### Health-data withdrawal

- `DELETE /api/personal-health-data` is authenticated but consent-exempt so a
  user can decline a catch-up request. It deletes injury constraints,
  menstrual dates, and body measurements in one transaction, then revokes all
  live `sensitive_health_data` consent rows. Account data, workouts, memos, and
  assistant history remain.
