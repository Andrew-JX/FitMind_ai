# 数据库设计（db-schema.md）

> PostgreSQL 14+ on Neon（免费档够用），扩展阶段需启用 pgvector。 所有表使用 snake_case，主键用 `id` (uuid)，时间字段用 `_at` 后缀。

------

## 1. ER 概览

```
users ──┬─< workouts ──< sets >── exercises >─< exercise_muscles >── muscle_groups
        │
        ├─< chat_sessions ──< messages
        │
        └─< tool_call_logs

(扩展阶段)
knowledge_chunks（动作百科 RAG）
```

**关键关系**：

- 一个 user 有多个 workouts（一次训练 = 一个 workout）
- 一个 workout 有多个 sets（一组）
- 一个 set 关联一个 exercise（动作）
- 一个 exercise 关联多个 muscle_groups（**带权重的多对多 → exercise_muscles**）
- 一个 user 有多个 chat_sessions（聊天会话）
- 一个 chat_session 有多个 messages

------

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

------

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

------

## 4. 索引策略

已经在 DDL 里加好的索引：

- `users.email`（登录）
- `workouts(user_id, performed_at DESC)`（按时间倒序查训练）
- `sets(workout_id)` / `sets(exercise_id)`
- `exercise_muscles(exercise_id)` / `exercise_muscles(muscle_group_id)`
- `messages(session_id, created_at)`
- `tool_call_logs(user_id, created_at DESC)`

后续根据慢查询日志再加复合索引。

------

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

------

## 6. 数据安全与合规

- 所有用户级表都有 `user_id` 外键 + ON DELETE CASCADE，删用户时数据全删
- `password_hash` 使用 bcrypt，不存明文
- 训练记录里不存身高 / 体重等敏感个人指标
- 用户可以通过 `DELETE /api/me` 触发账号注销，级联删除所有数据

------

## 7. 演进规划

| 阶段            | 涉及表                                                       |
| --------------- | ------------------------------------------------------------ |
| 阶段 1          | users, muscle_groups, exercises, exercise_muscles, workouts, sets |
| 阶段 2          | 不新增表，只查询                                             |
| 阶段 3          | chat_sessions, messages, tool_call_logs                      |
| 阶段 4          | 不新增表                                                     |
| 阶段 5          | 不新增表                                                     |
| 扩展 A（RAG）   | knowledge_chunks（扩展阶段单独 migration，含 CREATE EXTENSION vector） |
| 扩展 B（MCP）   | 不新增表                                                     |
| 扩展 C（Agent） | 可能加 agent_traces 表（记录 ReAct 步骤）                    |
## 8. Knowledge Operations Notes

Phase 4.9 keeps the Phase 4.8B/4.8C knowledge tables and adds one operational constraint:

- `knowledge_documents.slug` remains the stable document key.
- `knowledge_chunks(document_id, chunk_index)` is now unique so imported fixtures can upsert chunks without editing seed migrations.
- `knowledge_chunks.embedding vector(1024)`, `embedding_model`, and `embedded_at` remain nullable so local/dev environments can use keyword fallback.
- No HNSW or IVFFlat index exists in 4.9. Exact cosine search remains acceptable for the current small corpus.
- Future knowledge changes should prefer `import:knowledge` fixtures over migration edits unless a schema change is required.
