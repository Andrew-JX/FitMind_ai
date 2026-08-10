# 数据库设计（db-schema.md）

> PostgreSQL 14+ on Neon（免费档够用），扩展阶段需启用 pgvector。 所有表使用 snake_case，主键用 `id` (uuid)，时间字段用 `_at` 后缀。

---

## 1. ER 概览

```
users ──┬─< workouts ──< sets >── exercises >─< exercise_muscles >── muscle_groups
        │
        ├─< chat_sessions ──< messages
        │
        └─< tool_call_logs

(扩展阶段)
knowledge_chunks（动作百科 RAG）
users ──┬─< menstrual_records
        ├─< body_measurements
        ├─< training_memos
        └── personal_health_settings
```

**关键关系**：

- 一个 user 有多个 workouts（一次训练 = 一个 workout）
- 一个 workout 有多个 sets（一组）
- 一个 set 关联一个 exercise（动作）
- 一个 exercise 关联多个 muscle_groups（**带权重的多对多 → exercise_muscles**）
- 一个 user 有多个 chat_sessions（聊天会话）
- 一个 chat_session 有多个 messages

---

## 2. 完整 DDL

下面 SQL 直接可在 PostgreSQL 跑。建议拆成多个 migration 文件按阶段执行。

### 2.1 扩展与公共

```sql
-- 启用 UUID 生成（主线 migration 启用）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pgvector 扩展不在主线启用；Phase 4.8C 的 RAG migration 已启用
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2.2 用户表

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  display_name    VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

### 2.3 肌群字典表

```sql
CREATE TABLE muscle_groups (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            VARCHAR(50) UNIQUE NOT NULL,    -- 'chest', 'back', 'legs'...
  name_en         VARCHAR(100) NOT NULL,
  name_zh         VARCHAR(100) NOT NULL,
  parent_id       UUID REFERENCES muscle_groups(id), -- 'chest_upper' parent 是 'chest'
  recovery_hours  INT NOT NULL DEFAULT 48,         -- 该肌群预期恢复小时数
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 种子数据示例
-- INSERT INTO muscle_groups (code, name_en, name_zh, recovery_hours) VALUES
--   ('chest', 'Chest', '胸', 48),
--   ('back', 'Back', '背', 48),
--   ('legs', 'Legs', '腿', 72),
--   ('shoulders', 'Shoulders', '肩', 48),
--   ('biceps', 'Biceps', '肱二头', 24),
--   ('triceps', 'Triceps', '肱三头', 24),
--   ('core', 'Core', '核心', 24);
```

### 2.4 动作字典表

```sql
CREATE TABLE exercises (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                VARCHAR(100) UNIQUE NOT NULL,   -- 'bench_press_barbell'
  name_en             VARCHAR(150) NOT NULL,
  name_zh             VARCHAR(150) NOT NULL,
  movement_pattern    VARCHAR(50),                    -- 'horizontal_push' / 'vertical_pull' / 'squat' / 'hinge'
  equipment           VARCHAR(50),                    -- 'barbell' / 'dumbbell' / 'machine' / 'bodyweight'
  is_compound         BOOLEAN NOT NULL DEFAULT TRUE,  -- 复合动作 vs 孤立动作
  default_rest_seconds INT DEFAULT 120,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exercises_code ON exercises(code);
CREATE INDEX idx_exercises_pattern ON exercises(movement_pattern);
```

### 2.5 动作-肌群关联表（**关键，含 contribution_weight**）

```sql
CREATE TABLE exercise_muscles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_id           UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  muscle_group_id       UUID NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE,
  contribution_weight   NUMERIC(3,2) NOT NULL CHECK (contribution_weight BETWEEN 0 AND 1),
  -- 1.00 = 该肌群是主要发力肌
  -- 0.50 = 该肌群是次要发力肌（协同肌）
  -- 0.30 = 该肌群是稳定肌
  is_primary            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(exercise_id, muscle_group_id)
);

CREATE INDEX idx_exercise_muscles_exercise ON exercise_muscles(exercise_id);
CREATE INDEX idx_exercise_muscles_muscle ON exercise_muscles(muscle_group_id);

-- 种子数据示例（卧推 = 胸 1.0 + 三头 0.5 + 肩前束 0.3）
-- INSERT INTO exercise_muscles (exercise_id, muscle_group_id, contribution_weight, is_primary) VALUES
--   (<bench_id>, <chest_id>, 1.00, TRUE),
--   (<bench_id>, <triceps_id>, 0.50, FALSE),
--   (<bench_id>, <shoulders_id>, 0.30, FALSE);
```

**为什么这样设计**：

- `contribution_weight` 是 fatigue 算法的核心输入
- 卧推 100 kg 的负荷不能只算给胸；三头和肩前束也要按比例累加
- 这是「业务建模 → 算法层」一致性的关键
- 面试拷问「多对多怎么用」时，能直接讲算法在用这个字段

### 2.6 训练日志（一次训练）

```sql
CREATE TABLE workouts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  performed_at    TIMESTAMPTZ NOT NULL,           -- 训练发生时间
  duration_minutes INT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workouts_user_perf ON workouts(user_id, performed_at DESC);
```

### 2.7 单组数据（组）

```sql
CREATE TABLE sets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id      UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id     UUID NOT NULL REFERENCES exercises(id),
  set_index       INT NOT NULL,                   -- 该动作的第几组（1, 2, 3...）
  reps            INT NOT NULL CHECK (reps >= 0),
  weight_kg       NUMERIC(6,2) NOT NULL CHECK (weight_kg >= 0),
  rpe             NUMERIC(3,1) CHECK (rpe BETWEEN 1 AND 10),  -- 主观疲劳 1-10
  is_warmup       BOOLEAN NOT NULL DEFAULT FALSE, -- 热身组不计入疲劳
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sets_workout ON sets(workout_id);
CREATE INDEX idx_sets_exercise ON sets(exercise_id);

-- 复合索引：按用户和时间查 sets（fatigue 算法高频查询）
-- 通过 join workouts 实现
```

### 2.8 聊天会话

```sql
CREATE TABLE chat_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(200),                    -- 自动生成或用户改
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, last_message_at DESC);
```

### 2.9 消息

```sql
CREATE TABLE messages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role              VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content           JSONB NOT NULL,                  -- 存 Anthropic 格式 content blocks
  -- user: { type: 'text', text: '...' }
  -- assistant: [{ type: 'text', ... }, { type: 'tool_use', ... }]
  -- tool: [{ type: 'tool_result', tool_use_id: ..., content: ... }]
  structured_output JSONB,                           -- assistant 消息的业务封装 JSON（含 evidence 等）
  usage             JSONB,                           -- { input_tokens, output_tokens, cache_*_tokens }
  metadata          JSONB,                           -- 其他元数据：model 版本、prompt 版本、ip 等
  token_input       INT,                             -- 冗余字段，方便聚合统计（优先从 usage.input_tokens 取）
  token_output      INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON messages(session_id, created_at);
```

### 2.10 工具调用日志（可观测性 + 面试素材）

```sql
CREATE TABLE tool_call_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id      UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_name       VARCHAR(100) NOT NULL,
  tool_input      JSONB NOT NULL,
  tool_output     JSONB,                          -- 返回的结构化结论
  duration_ms     INT,
  status          VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tool_call_logs_user_time ON tool_call_logs(user_id, created_at DESC);
CREATE INDEX idx_tool_call_logs_tool ON tool_call_logs(tool_name);
```

**面试讲点**：你可以查这张表，统计「最常被调用的工具是哪个」「平均工具响应时间多少」「有多少次工具调用失败」——这些都是项目运营观察的真实数据。

### 2.11 知识库分块（扩展阶段 RAG）

```sql
-- ⚠️ 此表不在主线 migration 创建。扩展阶段 A（RAG）单独执行 migration:
--   1. CREATE EXTENSION IF NOT EXISTS vector;
--   2. ai-decisions.md D09 已确定 Phase 4.8C 使用 Voyage voyage-4-lite
--      - Voyage voyage-4-lite:              VECTOR(1024)
--      - OpenAI text-embedding-3-small:     VECTOR(1536)
--      - OpenAI text-embedding-3-large:     VECTOR(3072)
CREATE TABLE knowledge_chunks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_title    VARCHAR(300) NOT NULL,
  source_url      TEXT,                           -- 原文 URL（引用溯源）
  topic           VARCHAR(100),                   -- 'squat_form' / 'bench_press_form'...
  exercise_id     UUID REFERENCES exercises(id),  -- 关联到具体动作（可选）
  content         TEXT NOT NULL,                  -- 分块后的文本内容
  content_tsv     TSVECTOR,                       -- 全文检索（可选混合检索）
  embedding       VECTOR(1024),                   -- Phase 4.8C: Voyage voyage-4-lite
  embedding_model VARCHAR(80),
  embedded_at     TIMESTAMPTZ,
  safety_level    VARCHAR(20) DEFAULT 'general',  -- general / advisory（伤病相关高敏感）
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phase 4.8C 先使用 exact cosine search，不创建 ANN index:
-- ORDER BY embedding <=> $query_embedding LIMIT k
-- 后续 corpus 变大后再评估 HNSW / IVFFlat。
-- CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 全文检索索引（如果做混合检索）
-- CREATE INDEX idx_knowledge_chunks_tsv ON knowledge_chunks USING GIN(content_tsv);
```

**注意**：Phase 4.8C 已确定 `embedding` 使用 `vector(1024)`，provider/model 为 Voyage AI `voyage-4-lite`。当前先做 exact cosine search，不加 HNSW / IVFFlat。

---

## 3. 关键查询示例

### 3.1 取用户最近 7 天的 sets（疲劳计算用）

```sql
SELECT
  s.id, s.reps, s.weight_kg, s.rpe, s.is_warmup,
  w.performed_at,
  s.exercise_id,
  EXTRACT(EPOCH FROM (NOW() - w.performed_at)) / 86400.0 AS days_ago
FROM sets s
JOIN workouts w ON s.workout_id = w.id
WHERE w.user_id = $1
  AND w.performed_at >= NOW() - INTERVAL '7 days'
  AND s.is_warmup = FALSE
ORDER BY w.performed_at DESC;
```

### 3.2 取动作的肌群贡献度（fatigue 计算用）

```sql
SELECT
  em.exercise_id,
  em.muscle_group_id,
  em.contribution_weight,
  mg.code AS muscle_code
FROM exercise_muscles em
JOIN muscle_groups mg ON em.muscle_group_id = mg.id
WHERE em.exercise_id = ANY($1::uuid[]);
```

### 3.3 周容量分布（按肌群聚合）

```sql
SELECT
  mg.code AS muscle_code,
  SUM(s.reps * s.weight_kg * em.contribution_weight) AS weighted_volume
FROM sets s
JOIN workouts w ON s.workout_id = w.id
JOIN exercise_muscles em ON s.exercise_id = em.exercise_id
JOIN muscle_groups mg ON em.muscle_group_id = mg.id
WHERE w.user_id = $1
  AND w.performed_at >= NOW() - INTERVAL '7 days'
  AND s.is_warmup = FALSE
GROUP BY mg.code
ORDER BY weighted_volume DESC;
```

---

## 4. 索引策略

已经在 DDL 里加好的索引：

- `users.email`（登录）
- `workouts(user_id, performed_at DESC)`（按时间倒序查训练）
- `sets(workout_id)` / `sets(exercise_id)`
- `exercise_muscles(exercise_id)` / `exercise_muscles(muscle_group_id)`
- `messages(session_id, created_at)`
- `tool_call_logs(user_id, created_at DESC)`

后续根据慢查询日志再加复合索引。

---

## 5. 数据迁移与种子数据

### 推荐工具

- 迁移：`node-pg-migrate`（轻量、SQL 文件式）
- 种子：写一个 `server/scripts/seed.ts`，启动时检测空表则填充

### 必填的种子数据

1. `muscle_groups` 字典（约 12 条，胸/背/腿等）
2. `exercises` 字典（约 50 条，覆盖常见动作）
3. `exercise_muscles` 关联（每个动作 1-3 条）

### 可选的种子数据

- 一个 demo 用户 + 4 周训练记录（用于 demo 和测试）

---

## 6. 数据安全与合规

- 所有用户级表都有 `user_id` 外键 + ON DELETE CASCADE，删用户时数据全删。当前共 **9 张**表直接引用 `users`（含本批新增的 `user_consents`），删 `users` 一行即可级联干净
- `password_hash` 使用 bcrypt，不存明文
- **存有一类敏感个人信息**：`athlete_profiles.injury_constraints`（伤病约束）。按 PIPL 第 28/29 条，它在**填写那一刻单独征求同意**，写入 `user_consents`，见 §13。不存身高、体重、训练年限——数据库里从来没有这些列
- **账号注销是自助接口**：`DELETE /api/auth/account`（鉴权），删 `users` 一行、其余靠级联。**欠同意时也能调用**——拒绝同意的人正是最需要这个出口的人，把它挡在闸门后面等于让人既不能同意也不能离开

> 订正：本节此前写着「用户可以通过 `DELETE /api/me` 触发账号注销」，而**当时没有任何删除
> 端点**（全仓 `router.delete` 一个都搜不到）。上一轮我把这句改成了「注销是人工流程」，
> 现在它又变了——因为补签页的「暂不同意」原本只是退出登录，数据照留在境外库里，页面却
> 暗示处理会停止。既然要让拒绝变成真的，就得有一个用户自己按得动的删除。所以这一版是
> 实现追上了文档，不是文档追上了实现。
>
> 「不存敏感个人指标」这句也改了：伤病约束一直都存着，而它恰好是本项目唯一一类敏感个人
> 信息。原话把「不存身高体重」错误地推广成了「不存敏感信息」。

---

## 7. 演进规划

| 阶段            | 涉及表                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| 阶段 1          | users, muscle_groups, exercises, exercise_muscles, workouts, sets      |
| 阶段 2          | 不新增表，只查询                                                       |
| 阶段 3          | chat_sessions, messages, tool_call_logs                                |
| 阶段 4          | 不新增表                                                               |
| 阶段 5          | 不新增表                                                               |
| 扩展 A（RAG）   | knowledge_chunks（扩展阶段单独 migration，含 CREATE EXTENSION vector） |
| 扩展 B（MCP）   | 不新增表                                                               |
| 扩展 C（Agent） | 可能加 agent_traces 表（记录 ReAct 步骤）                              |

## 8. Knowledge Operations Notes

Phase 4.9 keeps the Phase 4.8B/4.8C knowledge tables and adds one operational constraint:

- `knowledge_documents.slug` remains the stable document key.
- `knowledge_chunks(document_id, chunk_index)` is now unique so imported fixtures can upsert chunks without editing seed migrations.
- `knowledge_chunks.embedding vector(1024)`, `embedding_model`, and `embedded_at` remain nullable so local/dev environments can use keyword fallback.
- No HNSW or IVFFlat index exists in 4.9. Exact cosine search remains acceptable for the current small corpus.
- Future knowledge changes should prefer `import:knowledge` fixtures over migration edits unless a schema change is required.

## 9. Assistant Saved Insights

Phase 5.1 adds `assistant_saved_insights` for persisted assistant reply snapshots.

Columns:

- `id uuid primary key`
- `user_id uuid not null references users(id) on delete cascade`
- `message_id uuid references messages(id) on delete set null`
- `insight_type varchar(40) not null`
- `title varchar(160) not null`
- `summary text not null`
- `structured_snapshot jsonb not null`
- `share_text text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints and indexes:

- `insight_type` is limited to `weekly_report`, `plateau_diagnosis`, and `next_week_plan`.
- `message_id` is unique when present, so saving the same assistant reply updates the existing insight.
- `(user_id, created_at)` supports recent-history listing.

Safety:

- Saved snapshots keep aggregate Evidence counts, tool names, Source titles/categories, limitations, and a structured output subset.
- Copy text must not include raw workout/set payload dumps or secrets.

## 10. Athlete Profiles

roadmap §8 Slice 4 adds `athlete_profiles` — one thin profile per user, injected into the next-week-plan agent for personalization + safety.

Columns:

- `user_id uuid primary key references users(id) on delete cascade`（一人一档，user_id 即主键，CRUD 走 upsert）
- `goal text not null`（check：`strength` / `hypertrophy` / `endurance` / `general_fitness`）
- `weekly_days smallint not null`（check：1–7）
- `available_equipment text[] not null default '{}'`（受控词表：barbell/dumbbell/machine/cable/bodyweight/kettlebell）
- `injury_constraints text[] not null default '{}'`（自由标签，service 层归一化小写 + 去重，≤10 个、每个 ≤40 字）
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`（upsert 时 `now()` 刷新）

Migration: `20260614100000_create_athlete_profiles.js`。

Safety:

- 档案只存训练目标 / 频率 / 器械 / 伤病约束标签，不存身高体重真实姓名（遵守 AGENTS §7.4 脱敏）。
- 伤病约束用于在计划草案里加保守安全提示，不作医疗判断。

## 11. Planned Workouts

roadmap §8 Slice 5 adds `planned_workouts` — 把助手生成的下周草案「接受」成 app 里的计划训练，合上 记录→分析→计划→再记录 闭环。

Columns:

- `id uuid primary key default uuid_generate_v4()`
- `user_id uuid not null references users(id) on delete cascade`
- `status text not null default 'active'`（check：`active` / `completed` / `abandoned`）
- `start_date date not null` / `end_date date not null`（计划周期；读取时转 text 喂给依从度计算）
- `plan jsonb not null`（`NextWeekPlanDraft` 快照：strategy / exercises[动作×组×次×目标重量] / notes，接受时 zod 校验）
- `source_message_id uuid references messages(id) on delete set null`（可选：来源助手消息，便于溯源）
- `created_at` / `updated_at timestamptz not null default now()`

Constraints and indexes:

- `(user_id, status, created_at)` 支持"取当前 active 计划"。
- 一个用户可有多条历史计划，"当前"取最近 active 一条。

依从度（adherence）：

- **不新增 performed 数据**：依从度在**读取时**确定性计算（`plan-adherence.ts`），把 `plan.exercises` 与该周期内已记录训练的 by-exercise（来自 `getTrainingSummary`）按动作名匹配，得出逐动作 done/partial/missed + 动作级/组级依从比例。
- 计划是快照，不随后续动作字典变化漂移。

## 12. Weekly Report Digests

Slice 8 Tier 1 adds `weekly_report_digests` for in-app proactive weekly report delivery. The report body remains the deterministic weekly report snapshot; no LLM output is stored here.

Columns:

- `id uuid primary key default uuid_generate_v4()`
- `user_id uuid not null references users(id) on delete cascade`
- `iso_year integer not null`
- `iso_week integer not null check (iso_week between 1 and 53)`
- `week_start_date date not null`
- `week_end_date date not null`
- `status text not null check (status in ('ready', 'empty'))`
- `title varchar(160) not null`
- `summary text not null`
- `report_snapshot jsonb not null`
- `generated_at timestamptz not null default now()`
- `dismissed_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints and indexes:

- Unique `(user_id, iso_year, iso_week)` makes cron idempotent.
- `(user_id, dismissed_at, generated_at)` supports latest visible digest reads.

Safety:

- `dismissed_at` is preserved on cron upsert so a dismissed digest does not reappear after a retry.
- `report_snapshot` is user-scoped and must not be exposed cross-user.

---

## 13. User Consents

同意接缝（2026-08-03）新增 `user_consents`。它回答的问题不是「这个人同意过吗」，而是
**「他同意的是哪一版」**——PIPL 第 14 条要求处理目的或信息种类变更时重新取得同意，而
`users` 上加两列只能存最后一次，政策改版后就再也分不清谁同意的哪一版。

Columns:

- `id uuid primary key default uuid_generate_v4()`
- `user_id uuid not null references users(id) on delete cascade`
- `consent_type text not null check (consent_type in ('cross_border_transfer', 'sensitive_health_data'))`
- `policy_version text not null check (char_length(btrim(policy_version)) > 0)`
- `accepted_at timestamptz not null default now()`
- `revoked_at timestamptz`（撤回时间；`NULL` = 仍然有效）
- `source text not null check (source in ('registration', 'profile_form', 'consent_catchup'))`

Constraints and indexes:

- **部分**唯一索引 `(user_id, consent_type, policy_version) WHERE revoked_at IS NULL`：同一
  版本同时只允许**一条有效**同意（所以重复提交是幂等的），但允许任意多条已撤回的历史行并存。
- `(user_id, consent_type)` 索引支撑「这个人还欠哪些同意」的查询。

**为什么是部分索引而不是完整唯一约束**：完整约束会逼着「授予 → 撤回 → 再授予」复用同一行，
于是第二次授予会覆盖掉第一次的 `accepted_at` 并清空 `revoked_at`——**第一段合法处理区间和
那次撤回一起消失**。一张自称用来回答「在 T 时刻处理是否被允许」的表，不能改写自己的历史。
现在同意是 append-only 的：撤回是给行盖章封存，不是把位置腾出来复用。

**所有判定必须写 `revoked_at IS NULL`**，不能只判断「有没有行」。`getConsentStatus` 是主判定
入口，但**不是唯一的**：周报 cron 的选人 SQL 直接查表，必须自己带上这个条件。加 `revoked_at`
那一轮就漏了 cron 这两处——文档当时已经写着「所有判定都改了」，而实际没有。**新增任何直接
读 `user_consents` 的查询时，先确认它带了这个条件。**

设计要点：

- **两种 `consent_type` 是分开问的，所以分开存。** `cross_border_transfer` 在注册时问
  （第 39 条，数据出境）；`sensitive_health_data` 在填写伤病约束时问（第 28/29 条）。
  合并成一个标志正是第 29 条要禁止的捆绑同意。
- **`source` 留着是有用的。** 「同意是怎么取得的」本身是要能证明的一部分；而且如果哪天
  真的出现了回填脚本，它写进来的值会在这一列里显形，而不是和真实同意无法区分。
- **不存 `accepted = false`。** 这张表里「有一行」就是「给过许可」的证据，拒绝是这个证据
  的缺席。把拒绝也存成行，会让整张表的语义从「行是否存在」退化成「要去读某一列」。
- **注册时与 `users` 同事务写入**（`createUserWithConsents`）。分成两次写会留下「账号存在、
  但没有任何记录证明当初被允许创建它」的状态，而且从用户视角完全看不出异常。
- **没有回填迁移，而且不会有。** 同意接缝之前建的账号通过 `GET /api/auth/me` 的
  `pending_consents` 浮出来，在应用内被问一次。替他们插一行等于替用户签字。

Migration: `20260803090000_create_user_consents.js`。

### 13.0 写入不变量与 `users` 行级锁（fitmind-9yz）

**不变量**：`athlete_profiles.injury_constraints` 非空 ⇒ 该用户在**当前政策版本**下存在一条
未撤销的 `sensitive_health_data` 同意。

这条不变量横跨两张表，所以**单表事务保证不了它**。任何会改动 `injury_constraints` 的路径，
都必须先取同一把锁：

```sql
BEGIN;
SELECT id FROM users WHERE id = $1 FOR UPDATE;   -- 锁在最前，且必须命中行
-- 锁内完成：读同意 → （必要时）写同意 → 写档案
COMMIT;
```

两条路径都在 `server/src/db/user-health-data-repository.ts`，**同一个文件、同一个
`withLockedUser`**——锁顺序是一个可复查的事实，而不是要从两个调用点拼出来的东西：

- `saveProfileWithHealthConsent`：档案写入（含随行的健康同意）；伤病列表归一化后为空时清空该字段，
  仅在经期和身体数据也为空时撤销同意
- `withdrawSensitiveHealthData`：清空伤病，并在三类健康数据都为空时盖 `revoked_at`

**两个撤回入口共用一个撤回操作（fitmind-lmy）。** 「清空后保存」与显式的
`DELETE /api/athlete-profile/injury-constraints` 都调用同一个私有的
`revokeLiveHealthConsentsIfNoStoredData(client, userId)`：它接收的是**客户端**而不是连接池，因为两条路径都
必须在已经持锁的那个连接上撤销。任何在这里自己开连接的写法都是第二个锁顺序，也就是绕过
`lockUserRow` 的后门。

```sql
UPDATE user_consents SET revoked_at = now()
 WHERE user_id = $1
   AND consent_type = 'sensitive_health_data'   -- 不碰 cross_border_transfer
   AND revoked_at IS NULL;                      -- 幂等：不覆盖已有的撤回时间戳
```

**不按 `policy_version` 过滤**：用户撤回的是这个类别，不是对某一版措辞的同意。留下一条旧版本
的有效行，就是在用户要求删除之后仍然留着一项有效授权。（它不会让下一次保存通过——锁内重读是
按当前版本过滤的，这是有意的——但「不能再用」和「已经撤回」是两回事。）

**这条谓词是导出的常量 `LIVE_HEALTH_CONSENT_PREDICATE`，撤回语句和「有没有东西可撤回」的
查询共用它**（`getConsentStatus` 的 `hasWithdrawableHealthConsent`）。两者曾经分叉过一次：
撤回不看版本，而驱动界面控件的标志只认当前版本，于是**旧版本措辞下的有效同意，服务端撤得掉、
用户却看不见**——一项谁也够不到的权限。共用谓词之后，它们不是「两处保持一致」，而是同一处。

注意 `hasHealthConsent` 与 `hasWithdrawableHealthConsent` **必须保持为两个字段**：前者回答
「今天能不能存伤病数据」，按版本过滤；后者回答「有没有一项授权可以收回」，不按版本。

为什么「清空即撤回」要在服务端而不是靠 UI 按钮：清空输入框再保存，是用户表达「别再留着了」
最自然的动作。此前它只清数据不撤同意，于是下次填写伤病会复用那条仍有效的同意直接存下。
两个入口必须是同一个意思，最省事的保证方式就是让它们跑同一条语句。

**为什么事务本身不够。** Postgres 默认 READ COMMITTED 下，保存请求可以读到「同意有效」，
撤回在这之后提交，保存再把伤病数据写回去——两个事务各自完美原子，**合起来的结果非法**。
在 `users` 行上串行化，才让「查同意 → 写数据」变得不可分割。

**同意必须在锁内重读**，不能沿用请求早期读到的值；这正是「先开始的保存仍然能看见后发生的
撤回」的原因。

**`FOR UPDATE` 命中 0 行时抛错，不放行**：锁不到任何东西的 `FOR UPDATE` 等于没加锁，继续
执行就会悄悄退回被修的行为。

### 13.1 真实 PostgreSQL 验证（2026-08-04 已执行）

单测只能断言 SQL 文本。这张表有两个性质是**由 PostgreSQL 决定、不是由我们发出的字符串决定**
的，必须打真库才算证明：

- `ON CONFLICT (user_id, consent_type, policy_version) WHERE revoked_at IS NULL` 能否正确
  **推断到那个部分索引**（推断不到就会直接报错，或者匹配错索引）；
- 跨 `athlete_profiles` 与 `user_consents` 两张表的撤回事务，回滚是否真的两边都退回。

`server/scripts/verify-consent-sql.ts` 调**真实 repository 函数**打真库跑完这些，可重复执行：

```bash
CONSENT_SQL_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/fitmind_migtest \n  pnpm --filter @fitmind/server run verify:consent-sql
```

2026-08-04 在 PostgreSQL 14.9 上的结果：**18 项全过**——注册原子写入、重复提交不改
`accepted_at` 且仍是一行、第二条有效同意被部分唯一索引拒绝（`23505`）、**授予→撤回→再授予
留下两行**（原始那行的 `accepted_at` 未被改写、`revoked_at` 仍在）、撤回事务失败后两张表
一起回退、删用户级联清空。`down` → 建表消失 → `up` → 部分索引原样重建，重跑仍全过。

2026-08-06 为 fitmind-lmy 追加「清空即撤回」的完整生命周期，同一脚本现为 **41 项全过**：

- §6 清空保存：同意不再有效、伤病数据清空、**跨境同意不受影响**、目标/天数/器械原样保留；
  重复的空保存不新增行、也不改写 `revoked_at`；无新同意再填返回 `consent_missing`（HTTP 层
  即 `422`）且什么都没存；带新同意则成功，旧的已撤回行作为历史保留、只有新行有效。
- §7 两侧回滚：分别在 `INSERT INTO athlete_profiles` 与 `UPDATE user_consents` 上注入失败，
  两次都断言**伤病数据仍在、同意仍有效**——注入点之前的语句是真的打到 PostgreSQL 上执行过
  的，所以这里验的是「已生效的写入被撤销了」，不是「stub 记得别写」。
- §8 显式撤回的范围：伤病与健康同意都清掉，而跨境同意、目标、每周天数、器械全部不变。

**这次运行没有覆盖到的**（如实记）：本地唯一可用的 Postgres 镜像没有 pgvector，所以
`20260607090000_add_knowledge_chunk_embeddings.js` 被临时移出后才跑通全链——**「全部迁移
在同一个库上依次 up」这件事仍未验证**。生产用 Neon，版本也不是 14.9。

### 13.2 并发验证（fitmind-9yz，2026-08-06 已执行）

```bash
CONSENT_SQL_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/fitmind_migtest \
  pnpm --filter @fitmind/server run verify:consent-concurrency
```

**争锁的两方都是生产函数本身**：`saveProfileWithHealthConsent` 与
`withdrawSensitiveHealthData`，两种锁顺序各跑一遍，谁都没有被替身、钩子或标志位改造过。
让它们真的撞上而不改代码的办法：**第三个连接先把 `athlete_profiles` 那一行钉住**。先跑的
生产函数拿到 `users` 锁之后会卡在这一行上，于是它就在事务里握着 `users` 锁不动；这时启动
另一个生产函数，它只能堵在 `users` 锁上。放开钉住的行，两者按预期顺序排空。

> 这一段是被审查退回换来的。**上一版脚本没有做到上面这件事**：场景 A 让生产的保存去撞一对
> 手写的 `UPDATE`，场景 B 标着「保存先拿锁」却根本没调用保存，只用一句裸的
> `SELECT ... FOR UPDATE` 持锁。两个场景都是绿的，而它们证明的是「生产函数会等一把别人持有
> 的锁」，不是「这两条路径彼此串行化」。**验证了一个东西、然后声称另一个东西**，是这个项目
> 被抓得最多的一种错法。

屏障用的是「可观测条件」而不是 sleep，并且**绑定到具体 backend**：`pg_blocking_pids` 回答
「谁在等谁」，等待方的 PID 由唯一的 `application_name` 从 `pg_stat_activity` 取到。上一版只
问「这个库里有没有未授予的锁」——任何无关会话都能满足它。sleep 只作为超时上限出现，超时算
失败不算通过。

**光有「谁等谁」还不够。** 把共享锁去掉重跑时这条断言依然是绿的：没有 `users` 锁，保存只是
改为在 profile 行上排在撤回后面，而 `pg_blocking_pids` 对「排在等待队列前面的事务」一视同仁
地报告。所以断言还要求等待方**当时正卡在哪条语句上**必须是
`SELECT id FROM users WHERE id = $1 FOR UPDATE`——这才把「在共享锁上串行化」和「碰巧按同样
顺序摸了同一行」区分开。

2026-08-06 在 PostgreSQL 14.9 上 10 项全过：撤回先拿锁时保存卡在 `users` 锁上等它、解锁后在
锁内重读同意并被拒、伤病数据没有被恢复；保存先拿锁时撤回同样卡在 `users` 锁上、保存**确实
提交成功过**（否则「撤回赢在最后」可以被一个失败的保存冒充）、最终态两者皆空；带有效同意的
保存成功且不变量成立。

**回退演示**（acceptance #6 要求）：两处各拆一次，都在 65 秒内以非零退出码变红。

| 拆掉的东西 | 结果 |
| --- | --- |
| `lockUserRow` 的 `FOR UPDATE` | 4 项红，含 `no injury data was restored — {"injuries":1,"liveConsents":0}` |
| 锁内的同意重读 | 3 项红，同样落在 `{"injuries":1,"liveConsents":0}` |

两次的终态都是原始 bug 本身：伤病数据在库里，有效同意为 0。

> 一个副产物：**第一版回退演示不是失败，是挂死**——测试自己持锁，未串行化的写排在它后面，
> 清理又排在那些写后面，全链锁住。已给连接加 `lock_timeout` / `statement_timeout`。
> **一个在守卫被拆掉时会挂死的回归测试不算门禁**，因为没人分得清挂死和机器慢。

## 14. 个人页健康与训练工具（2026-08-09）

迁移 `20260809120000_create_personal_tools.js` 新增四张用户级表：

- `menstrual_records`：`(user_id, period_date)` 复合主键，只保存用户主动标记的实际经期日期；
- `personal_health_settings`：一人一行，保存是否在训练历史日历显示经期标记；
- `body_measurements`：一人每天最多一条，保存可空的体重、目标体重、体脂率及各项围度；
- `training_memos`：标题、正文、置顶状态与时间戳，按 `is_pinned DESC, updated_at DESC` 索引。

经期日期、身体测量和 `athlete_profiles.injury_constraints` 共用
`sensitive_health_data` 同意类别。首次保存经期或身体数据时，
`ensureCurrentHealthConsent` 与数据写入在 `withLockedUser` 的同一事务内执行；删除某一类健康数据后，
只有在三类敏感数据都为空时才撤销同意。`DELETE /api/personal-health-data` 则在同一事务中删除三类数据并撤销全部有效健康同意。

`training_memos` 不是健康数据，不触发敏感信息同意；它仍按 `user_id` 隔离并随账号级联删除。
