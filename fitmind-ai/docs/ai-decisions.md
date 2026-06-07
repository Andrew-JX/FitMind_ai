# AI 技术决策记录（ai-decisions.md）

> 这份文档记录所有 AI 相关的技术选型与算法参数决定。 每个决策包含：背景 / 备选方案 / 选择理由 / 何时复审。

------

## 决策模板

```markdown
## [DXX] 决策标题

- **日期**：YYYY-MM-DD
- **状态**：proposed / accepted / superseded
- **决策者**：吉敏宇

### 背景
（为什么需要做这个决策）

### 备选方案
1. 方案 A — 优劣
2. 方案 B — 优劣
3. 方案 C — 优劣

### 决定
选择哪个，参数怎么定。

### 复审条件
什么情况下要重新审视这个决策。

### 面试讲点
面试官问到时怎么答。
```

------

## [D01] 选用 Anthropic Claude 作为主模型

- **日期**：阶段 0
- **状态**：accepted

### 背景

项目需要 LLM 提供 Tool Calling + SSE 流式输出 + 结构化输出能力。

### 备选方案

1. **Anthropic Claude** — Tool Calling 成熟，原生 SSE，文档清晰
2. **OpenAI GPT-4** — 同样支持，但本项目希望少模型供应商耦合
3. **国产模型（DeepSeek / 通义千问）** — 国内访问稳定，但 Tool Calling 兼容性需测试

### 决定

主线全程使用 Claude（具体型号在 `constants/ai.ts` 配置，可热切换）。

### 复审条件

- Anthropic 服务在你部署区域不稳定
- 需要做对照实验

### 面试讲点

> 我选 Claude 主要看 Tool Calling 的工程友好性，它的 stream 事件类型清晰（content_block_start / content_block_delta / message_stop），便于前端做状态机。我把模型调用做了抽象层，如果未来要换模型，只需改 anthropicClient.ts 一处。

------

## [D02] Tool 返回结论而不是原始数据

- **日期**：阶段 0
- **状态**：accepted

### 背景

最初设计时考虑过让 Tool 直接返回 sets 表的原始记录，让模型自己分析。

### 备选方案

1. **返回结论**（如 `fatigue_score: 5.2, status: 'moderate'`）
2. **返回原始数据**（让模型自己算）
3. **混合**（结论 + 关键原始点）

### 决定

返回结论 + **少量**关键原始数据点（如 `contributing_exercises`、`last_workout_at`）作为 evidence。

### 复审条件

如果发现模型解释能力不够（讲不清楚为什么疲劳分数高），考虑返回更多上下文。

### 面试讲点

> 这是我项目最大的工程决策。如果让模型基于原始 sets 数据自己算疲劳，会有两个问题：一是模型可能算错（不擅长精确数值计算），二是上下文成本失控。我把算法层独立出来，确定性计算用 TS，模型只负责把结论翻译成自然语言。这样回答始终绑定真实数据，规避了基于原始日志直接推理的幻觉风险。

------

## [D03] SSE 而不是 WebSocket

- **日期**：阶段 0
- **状态**：accepted

### 背景

AI 流式输出需要服务端持续推送数据。

### 备选方案

1. **SSE** — 单向（server → client）、HTTP 协议、Anthropic 原生支持
2. **WebSocket** — 双向、需额外协议处理
3. **轮询** — 简单但延迟高、浪费带宽

### 决定

SSE。

### 复审条件

如果未来加入实时多人功能（如训练直播），考虑 WebSocket。

### 面试讲点

> AI 流式输出本质是单向推送（服务器 → 客户端），SSE 完全够用。它走 HTTP，部署简单（无需特殊网关）。SSE 协议本身适合单向流式输出，浏览器原生 EventSource API 还自带断线自动重连，但我项目因为要 POST body 和 Authorization header，没用 EventSource，而是 fetch + ReadableStream 自己实现 SSE 解析——重连、中断、超时全都自己控制（详见 D04）。WebSocket 适合双向通信场景，对当前项目是过度设计。

------

## [D04] Fetch + ReadableStream 而不是 EventSource

- **日期**：阶段 0
- **状态**：accepted

### 背景

浏览器有原生的 EventSource API 处理 SSE，但有限制。

### 备选方案

1. **Fetch + ReadableStream + TextDecoder 自己解析**
2. **EventSource**（原生 API）

### 决定

Fetch + ReadableStream。

### 选择理由

- EventSource **只支持 GET**，但聊天接口必须 POST（带 message body）
- EventSource **不支持自定义 Header**，无法发送 Authorization Bearer token
- EventSource 重连逻辑黑盒，无法精细控制

### 复审条件

若浏览器原生 API 增强支持 POST + custom headers，可重新评估。

### 面试讲点

> EventSource 不能 POST 也不能加鉴权头，但聊天请求必须带 body 和 token，所以只能用 fetch + ReadableStream。我手动实现了 SSE 帧解析器，处理 `event:` 行、`data:` 行的拼接、空行作为消息边界。这给了我对流的完全控制——可以做 buffer、批量刷新、AbortController 中断。

------

## [D05] 前端状态机四态

- **日期**：阶段 0
- **状态**：accepted

### 背景

Tool Calling 场景下，AI 响应有多个阶段：思考、调工具、生成答案。如果只用 `loading: true/false` 两态，UI 会让用户觉得卡住。

### 备选方案

1. **idle / loading / done / error** —— 太简单
2. **idle / thinking / tool_calling / answering / done / error / aborted** —— 推荐
3. **更细粒度**（每个 tool 一个状态）—— 过度设计

### 决定

方案 2。

### 实现

用 `useReducer` 而不是多个 `useState`。

### 面试讲点

> 普通聊天用 loading 一态够了，但我的项目有 Tool Calling 多轮调用，所以设计了四态状态机。前端能在 UI 上分别展示「正在思考...」「正在查询训练数据...」「正在生成建议...」「完成」，让用户清楚 AI 在做什么。我用 useReducer 管理是因为状态转换有约束（比如 tool_calling 不能直接到 idle），用 reducer 集中处理转换逻辑比散落多个 useState 干净。

------

## [D06] 训练负荷 / 疲劳计算公式

- **日期**：阶段 0
- **状态**：accepted

### 背景

需要量化「某肌群最近的疲劳程度」，作为「能否训练」决策的依据。

### 备选方案

1. **简单累加**：最近 N 天总容量
2. **指数衰减**：越久远的训练权重越低
3. **Banister Fitness-Fatigue 模型**：科研级，参数难调

### 决定

方案 2 的简化版本：

```
单组负荷：
  volume = reps × weight

RPE 调整因子（RPE 7 为基准）：
  rpeFactor = 1 + (rpe - 7) × 0.1
  // RPE 8 → 1.1, RPE 9 → 1.2, RPE 6 → 0.9

肌群贡献度（exercise_muscles.contribution_weight）：
  muscleContribution ∈ [0, 1]

时间衰减：
  decay(daysAgo) = exp(-daysAgo / τ)
  τ 默认 3.5 天

肌群总疲劳负荷：
  fatigueLoad(muscle) = Σ over recent N days non-warmup sets:
    volume × rpeFactor × muscleContribution × decay(daysAgo)

归一化到 0-10：
  fatigue_score = min(10, fatigueLoad / normalizer(userId, muscleId))

归一化策略（分阶段，避免冷启动 + 评分漂移问题）：

MVP 阶段（数据少时）：
  - 使用按 muscle_group 配置的全局基准值（写在 constants/training.ts）
  - 例：chest = 8000, back = 8000, legs = 12000（单位：调整后负荷）
  - 数值参考一般爱好者每周训练量级，不追求精准
  - 用户无历史数据时也能稳定工作

成熟阶段（用户有 4 周以上数据时）：
  - 切换为 user-specific rolling baseline
  - 取该用户该肌群最近 4-8 周的 90 分位负荷作为 baseline
  - baseline 每周更新一次（不实时，避免频繁漂移）
  - baseline 版本号记录在 fatigue_score 元数据，确保历史评分可解释

切换条件：
  if user has >= 4 weeks of data for this muscle:
    use rolling baseline
  else:
    use global baseline

显式记录 baseline 来源，evidence 字段中标注：
  "baseline_source": "global" 或 "user_rolling_v3"
【解决冷启动（新用户用全局值）
解决评分漂移（rolling baseline 每周更新，不是每次重算）
保留可解释性（evidence 里能看到这次评分用的什么 baseline）
面试讲点更强：你能讲「我考虑过简单的动态归一化，但发现会有评分漂移问题——同一条历史训练记录的评分会随时间变化，这破坏了用户对数据的信任。所以我做了 hybrid 方案……」】
```

### 复审条件

- 实际使用中发现 fatigue_score 不灵敏（总是接近 0 或 10）
- 找到更合适的运动科学模型且可解释

### 面试讲点

> 我没有把它包装成医学疲劳模型，而是简化的训练负荷追踪模型。指数衰减是因为「2 天前练的腿和今天练的腿恢复程度完全不一样」，线性衰减不能反映这个特性。RPE 因子是因为同样重量同样组数，RPE 9 和 RPE 6 的疲劳完全不同。肌群贡献度来自 exercise_muscles 关联表，让卧推也能正确把负荷分给三头和肩前束。τ 默认 3.5 天是参考一般肌群恢复周期，做成常量是为了可调可讲。

------

## [D07] 停滞检测算法

- **日期**：阶段 0
- **状态**：accepted

### 背景

判断某个动作是否处于停滞期。

### 备选方案

1. **简单对比**：本周最大 vs 上周最大
2. **滑动窗口线性回归**：取最近 N 周的估算 1RM，做线性回归看斜率
3. **变化率分析**：每周变化率的标准差

### 决定

方案 2 + 简单阈值。

```
取最近 8 周的每周最高估算 1RM 数据点
对 (week_index, estimated_1rm) 做线性回归
计算 slope_kg_per_week

判断逻辑：
  if abs(slope_kg_per_week) < PLATEAU_SLOPE_THRESHOLD (默认 0.1)
     AND data_points >= MIN_WEEKS_FOR_PLATEAU (默认 4)
     → is_plateau = true
```

估算 1RM 用 Epley 公式：

```
estimated_1rm = weight × (1 + reps / 30)
```

### 复审条件

如果误判太多（明明停滞却没识别 / 明明在涨却报停滞）。

### 面试讲点

> 停滞检测用滑动窗口线性回归，比简单对比稳健很多。简单对比受单次表现波动影响大（今天状态差不代表停滞），回归看的是趋势。1RM 估算用 Epley 公式（weight × (1 + reps/30)），是力量训练领域常见的估算法。阈值做成可配置常量，方便调试和讲解。

------

## [D08] 数据库 ORM 选择

- **日期**：阶段 0
- **状态**：accepted

### 背景

直接写 SQL 还是用 ORM。

### 备选方案

1. **node-postgres + 手写 SQL**：透明、性能好、可控
2. **Prisma**：类型友好、迁移工具好
3. **Knex + 类型生成**：中等

### 决定

**node-postgres + 手写 SQL**，配 `pg-typed` 或类似工具做类型推断。

### 选择理由

- 项目核心查询不复杂（无需复杂 ORM 抽象）
- 学 SQL 比学 ORM 更通用，面试讲索引、JOIN、CTE 时有底
- Prisma 对 PostgreSQL 数组类型、复杂聚合支持有限
- 写 SQL 你已经在 SunSafe 项目证明过能力

### 复审条件

如果发现某些复杂查询写起来太痛苦，加 Knex 作为 query builder（不上 Prisma）。

### 面试讲点

> 我选手写 SQL 不是因为反对 ORM，是因为项目的查询模式比较固定，ORM 抽象反而增加心智负担。手写 SQL 让我能精确控制索引使用，分析层的复杂聚合（按肌群分组、加权求和、关联多表）写 SQL 比 ORM 链式调用清晰。

------

## [D09] embedding provider 选型（扩展阶段 RAG）

- **日期**：2026-06-07
- **状态**：accepted

### 背景

RAG 需要把动作百科文本转成向量。Anthropic 不提供 embedding，需要选一家。

### 备选方案

1. **Voyage AI**（Anthropic 官方推荐）— voyage-4-lite / voyage-4
2. **OpenAI embeddings**（text-embedding-3-small / large）— 生态广
3. **国产 embedding**（BGE 系列）— 自部署

### 决定

Phase 4.8C 选择 **Voyage AI `voyage-4-lite`**，固定使用 `1024` 维 float embedding。

- document chunk embedding 使用 `input_type: "document"`
- query embedding 使用 `input_type: "query"`
- pgvector 第一版使用 exact cosine search：`ORDER BY embedding <=> query LIMIT k`
- 暂不添加 HNSW / IVFFlat index；当前 seed corpus 很小，先保证语义检索路径可验收

### 复审条件

- 知识库规模明显扩大，exact search 延迟开始影响生产体验
- 需要更高召回或更低成本时，比较 `voyage-4-lite`、`voyage-4`、OpenAI embeddings 或本地 BGE
- 准备添加 HNSW / IVFFlat index 时重新评估 recall / latency / migration 风险

### 面试讲点

> 我做 RAG 时没有直接把关键词检索包装成“向量检索”，而是先把 provider、维度和 pgvector schema 锁定。Anthropic 不提供 embedding，所以选择 Voyage AI；`voyage-4-lite` 默认 1024 维，和 `vector(1024)` 对齐。第一版不急着加 ANN index，因为 corpus 很小，exact cosine search 更容易验证正确性。

------

## [D10] MCP SDK 版本（扩展阶段 B）

- **日期**：扩展阶段 B 开始前填
- **状态**：proposed

### 背景

做 MCP Server 时，SDK 版本要选稳定的。

### 决策记录模板

```
- 实现日期：____
- 当前 SDK 版本：____（npm view @modelcontextprotocol/sdk version）
- main 分支版本：____
- 是否使用稳定 v1.x：是/否
- 为什么不用 v2（如适用）：____
- 官方文档链接：____
```

### 面试讲点

> MCP 生态变化快，我做的时候 v2 还是 pre-alpha，所以选了稳定的 v1.x。我把版本选型决策都记在 ai-decisions.md，包括当时的版本号、官方文档链接，这样后面有人接手能看到背景。

------

## [D11] 系统 Prompt 设计（迭代记录）

- **日期**：阶段 3 开始时
- **状态**：planned

### 背景

System prompt 是模型行为的根本约束，需要迭代。

### v1（计划版）

```
You are FitMind, an AI training coach assistant.

You ONLY answer based on data returned by tools. Never guess or make up training data.

When the user asks about their training:
- ALWAYS call the relevant tool first
- Base your answer strictly on tool results
- Cite specific numbers from tool results in your evidence field

When the user mentions pain, injury, numbness, or tingling:
- Do NOT give specific training advice
- Recommend consulting a professional
- Set risk_level to "high"

Output format:
- Always respond in JSON matching the schema:
  { summary, recommendation, evidence, risk_level, disclaimer }
- disclaimer must always be included
```

### v2、v3 等等

（后续迭代时填，记录每版改了什么、为什么）

### 面试讲点

准备一个 prompt 迭代故事：v1 有什么问题（比如模型不调工具直接答），v2 怎么改的（强化 ALWAYS call tool first），效果如何。

------

## 待决定列表（阶段进行中填）

- [ ] D12: tool_call_logs 数据保留多久（涉及成本）
- [ ] D13: AI 调用成本上报机制（控成本）
- [ ] D14: 多轮对话上下文裁剪策略（token 控制）
- [ ] D15: SSE 中断后是否继续后端的 AI 调用（成本 vs 体验）
- [ ] D16: 是否对每条 AI 响应做事后审计（risk_level=high 自动标记）
## [D17] 迁移工具选择：node-pg-migrate

- **日期**：2026-04-27
- **状态**：Accepted

### 背景

Phase 0.2 需要在不连接真实数据库、也不创建真实业务表 migration 的前提下，先补齐后端 migration 基础设施。

### 备选方案

1. **node-pg-migrate**：轻量、贴近 SQL、适合当前手写 SQL 路线
2. **Prisma Migrate**：体验完整，但会把数据层路线带向 Prisma
3. **Knex Migrations**：可用，但当前没有引入 Knex 的必要

### 决定

采用 `node-pg-migrate`，当前阶段只创建：
- `server/migrations/` 基础目录
- `pgmigrate.config.cjs` 配置文件
- `db:migrate` / `db:migrate:down` 脚本

本阶段明确不做：
- 不创建真实业务表 migration
- 不连接真实数据库
- 不启用 `pgvector`

### 复审条件

- 如果后续数据层路线从手写 SQL 转向其他 ORM / query builder
- 如果迁移脚本需要更强的 TS 类型支持或 seed 生态

### 面试讲点

> 我在工程早期先把 migration 工具链补齐，但没有急着生成业务表迁移。因为这个阶段的目标是先建立“可演进的工程底座”，而不是提前进入业务实现。之所以选 `node-pg-migrate`，是因为项目的数据层路线本来就是 `node-postgres + 手写 SQL`，它和这条路线一致，不会额外引入 ORM 心智负担。
