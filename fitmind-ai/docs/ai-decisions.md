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
## [D18] Phase 4.9 RAG operations path: hybrid retrieval plus fixture ingestion

- **Date**: 2026-06-07
- **Status**: Accepted

Decision:
- Keep the public Assistant API and frontend response shape unchanged.
- Keep `Evidence` reserved for user training data and `Sources` reserved for retrieved training knowledge.
- Move knowledge maintenance out of migrations by adding a server-side JSON/Markdown fixture ingestion CLI.
- Use stable upserts: `knowledge_documents.slug` for documents and `(knowledge_chunks.document_id, knowledge_chunks.chunk_index)` for chunks.
- When embeddings are available, rank with hybrid scoring: `0.7 * normalized_vector_score + 0.3 * normalized_keyword_score`.
- Keep keyword-only fallback for local/dev environments without `VOYAGE_API_KEY` or embeddings.

Out of scope:
- LangChain, LangGraph, MCP, agents, reranking, HNSW/IVFFlat ANN indexes, UI/admin screens, auth changes, training CRUD changes, voice changes, and new Assistant response fields.

## [D19] Phase 5.3 鉴权持久化：HttpOnly 会话 cookie

- **Date**: 2026-06-11
- **Status**: Accepted

背景：
- 之前 token 只存在前端内存里，刷新即掉线；与 `PROJECT_BRIEF.md §10.2` 承诺的生产安全方案（HttpOnly Cookie）不一致。

Decision：
- 登录 / 注册时后端把同一枚 JWT 通过 `Set-Cookie` 写入 HttpOnly 会话 cookie（`fitmind_token`，`HttpOnly; SameSite=Lax; Path=/`，生产环境追加 `Secure`，`maxAge` 7 天，与 JWT 过期一致）。
- `authMiddleware` 优先从 cookie 读 token，缺失时回退 `Authorization: Bearer`，让 `server/scripts/*-smoke.ts` 等非浏览器客户端继续可用；响应体仍返回 `token`。
- 新增 `POST /api/auth/logout` 清除 cookie（无需鉴权、幂等）。
- 前端所有请求（含 SSE `stream-turn`）改用 `credentials: "include"`；应用加载时调 `/api/auth/me` 用 cookie 恢复会话；登出调 `/logout` 再清本地状态。
- 不引入 `cookie-parser` 依赖：用 Express 内置 `res.cookie`/`res.clearCookie` 写、手写一个 `Cookie` 头解析器读。

CSRF 立场：
- `SameSite=Lax` 阻止跨站 POST/fetch 携带 cookie，叠加同源部署（Vercel 同时托管 app/API），对本项目已足够。
- 双提交 CSRF token 等更强方案推迟，待引入跨站场景时再做。

Out of scope（本次不做）：
- access/refresh 双 token 轮转、token 黑名单/吊销、多设备会话管理、CSRF token、把鉴权切到独立鉴权服务。

## [D20] Phase 6.0 多步 ReAct 训练计划 agent（next_week_plan）

- **Date**: 2026-06-14
- **Status**: Accepted（Batch 1 核心 + Batch 2 接线已落地，Batch 3 前端可视化进行中）

背景：
- 原 `next_week_plan` 是单轮：provider 选 1 个工具（get_weekly_training_report）→ 执行 → RAG → 拼装答案。要把项目从 "Tool Calling" 推进到 "Agent"，需要多步循环 + trace 可视化（PROJECT_BRIEF 扩展 C / roadmap §3）。

Decision：
- 新增 `server/src/services/agent/`，对 `next_week_plan` intent 用**确定性 ReAct 策略**（非 LLM 选工具）跑多步：查容量(get_weekly_training_report) → 找弱项(get_recommendation_context) → 查进展(get_exercise_progress，仅在指定动作时，否则记 skipped 步) → 检索知识(RAG) → 生成草案(synthesis)。
- 为何确定性而非让模型自由编排：与项目"不套壳、证据绑定、mock-first 可离线可单测"的定位一致；多步循环 + thought→action→observation 的 trace + 跨步证据聚合本身就是 Agent 的价值，步骤选择是否由 LLM 驱动可后续在 anthropic provider 上叠加。
- 策略基于观察分支：空数据第一步即停（stop_reason=no_data）；按周训练频率给"巩固/加量/维持"建议（阈值 HIGH=5、LOW=2 次/周，命名 module 常量）；次要工具失败不致命（记 error 步后继续合成）。
- 依赖注入（runTool/retrieve/onStep/now），agent 不直接碰 DB，便于单测；orchestrator 注入 `executeAiTool` 与 `retrieveKnowledgeChunks`（后者包一层 logRetrievalEvent 保留可观测性）。
- SSE 新增 `state:"planning"` + `agent_step_started` / `agent_step_finished` 事件；`agent_trace` 随 `structured_output` 持久化进消息，历史可重渲染。前端对未知事件类型一律忽略（向前兼容），避免新事件打挂旧客户端。

Out of scope（本次不做）：
- 让 LLM 自由决定下一步工具（真正的开放式 ReAct）；多 intent 共用 agent；agent 步数上限自适应；trace 落独立表（现仅存在消息 structuredOutput 里）。

## [D21] 运行时 faithfulness 校验（answer-faithfulness，Slice 1）

- **Date**: 2026-06-14
- **Status**: Accepted（校验器 + 单测 + orchestrator 两路径接线已落地）

背景：
- 项目核心论点是「证据绑定、确定性、不是套壳 ChatGPT」。但"答案里的数字都来自真实工具输出"此前只是设计口号，没有被任何机制强制校验。要把它变成**被强制校验的不变量**，需要一道运行时护栏。

Decision：
- 新增 `server/src/services/assistant/answer-faithfulness.ts`，导出确定性（无 LLM）的 `verifyAnswerFaithfulness(answer, toolOutputs)` → `{ status: "verified" | "flagged"; checkedNumbers; unverifiedClaims[] }`。
- 思路：深度遍历本轮所有工具输出收集「可接受数字集合」——原始数值 + **数组长度**（覆盖"X 条 workout"这类派生计数）+ **字符串内嵌数字**（覆盖日期 `2026-06-01`、`toLocaleString` 的 kg 串）+ **ratio×100**（覆盖 `formatPercent` 的 `0.4 → 40.0%`）；再从答案 summary/bullets/conclusion/recommendation 抽取数字 token，带容差逐个比对（相对 1% + 绝对 0.5，覆盖四舍五入 / toFixed / 千分位逗号）。匹配不上 → `unverifiedClaims`。文本中出现的 UUID 引用若不在 evidence/sources → 也计入。
- 阈值（`NUMERIC_RELATIVE_TOLERANCE`、`NUMERIC_ABSOLUTE_TOLERANCE`、`RATIO_PERCENT_MULTIPLIER`、`ORDINAL_STRIP_PATTERN`）全部命名常量，写在文件顶部（遵守 AGENTS §5）。
- **为何确定性而非 LLM 评判**：与项目 mock-first、可离线、可单测、零成本定位一致；校验"数字有没有出处"本就是确定性问题，不需要模型。
- **为何标注不拦截（默认）**：护栏的目标是把编造**暴露出来**而不是改写答案文案。`status=flagged` + 列表是元数据，挂在 `structured_output.faithfulness` 上随消息持久化，不改既有答案逻辑。dev 自查可选抛错：`shouldStrictlyVerify()` 仅在 `FAITHFULNESS_STRICT=1` 且非 production 时开启，`enforceFaithfulnessInDev` 据此对 flagged 抛错；默认关闭，生产 / 测试安全。
- **接线**：`MockAssistantTurnResponseData` 加 response 级 optional `faithfulness` 字段（与 `agent_trace` 同款）。常规工具路径用作用域内那一次 tool result（覆盖 mixed_tool_rag / plateau）；`next_week_plan` agent 路径在注入的 `runTool` 外包一层捕获工具结果，跑完后对聚合结果集校验——因此**不需改动 agent 与 react-planner-types**。knowledge/unsupported/message 路径无工具数据，字段留空。

与未来真实模型的关系（为何护栏先于模型就位）：
- 当前 mock provider 是确定性的、不会编造，所以校验现在几乎总是 verified。但 Slice 7 接真实大模型后，模型**会**编造数字与引用——届时这道护栏（以及 Slice 2 的 faithfulness 通过率指标）正是兜住编造的关键。先于模型把不变量和校验机制建好，比模型上线后再补更稳。

诚实标注的取舍：
- 可接受集合刻意宽松（宁可漏标也不误标真实数据），配合"标注不拦截"。代价是少数硬编码文案常量（如 recommendation 路径的"最近 30 天"窗口描述）可能被标 flagged——这是记录性元数据，不影响答案或测试。未来"✓ 数据已核对"前端徽章（后续 Slice）可据 `status` 决定展示。

Out of scope（本次不做）：
- 前端"✓ 数据已核对"徽章展示；校验非数字的语义声明（如"训练量上升"这类定性判断）；把 faithfulness 落独立表。

## [D22] 离线 Eval 套件 + 回归门禁（assistant-eval，Slice 2）

- **Date**: 2026-06-14
- **Status**: Accepted（数据集 + 评测器 + runner + `pnpm eval` + 单测已落地）

背景：
- 面试高频问题"你怎么知道它对 / 不回归？"此前没有标准答案。需要一个可离线复现、零成本的 eval 套件，把"对不对"变成可量化、可门禁的指标。

Decision：
- 新增 `server/src/services/assistant/assistant-eval.ts`：golden 数据集（`AssistantIntentEvalCase` { message, mode, expectedIntent, mustCiteEvidence?, shouldRefuse? } + `FaithfulnessEvalCase` { answer, toolOutputs, expectedStatus }）+ 三个纯函数评测器。
- **评测项（全部 mock-first、无 DB）**：
  ① intent 路由准确率——对每条跑 `classifyAssistantIntent`（纯函数）比对 expectedIntent，覆盖 summary/progress/weekly_report/plateau_diagnosis/next_week_plan/recommendation/imbalance/evidence/exercise_history/knowledge/mixed_tool_rag/unsupported。
  ② 关键回归断言——`shouldRefuse` 的必须路由到 unsupported；`mustCiteEvidence` 的不能落到 unsupported/knowledge（证据绑定回归）。
  ③ faithfulness 通过率——复用 Slice 1 的 `verifyAnswerFaithfulness` 对「答案 + 工具输出」fixtures 打分（含编造 999kg → flagged）。
- **runner**：`server/scripts/run-eval.ts`（tsx），根 `pnpm eval` 委托到 server 跑；打印每项 pass/fail + 分项分数 + Overall，**任一项未达 100% → 非零退出**，可进 CI。
- **为何 mock-first / 离线 / 零成本**：与项目定位一致——核心可评测的部分（intent 路由、faithfulness）都是确定性纯函数，不需要调任何付费模型即可复现回归。门禁因此能无密钥、无 DB、在任意 CI 跑。
- **LLM-as-judge（叙述质量）默认 off**：保留干净 seam（`NarrativeJudge` 接口 + `runAssistantEval({ narrativeJudge })` 可选注入），但默认不注入、不调用任何模型，保持零成本。接真实 provider（Slice 7）后可注入一个调模型的实现给叙述质量打分，无需改评测框架。
- **门禁阈值**用命名常量 `REQUIRED_PASS_RATE`（确定性套件期望全过）。
- 与现有 `server` 的 `eval`（rag-eval，DB-backed RAG 检索质量）并存、互不影响：新套件是无 DB 的助手层 eval，挂在根 `pnpm eval`。

Out of scope（本次不做）：
- 真正注入 LLM judge 跑叙述质量（等接真实模型）；把 eval 接进 CI workflow（先本地可跑）；mustCiteEvidence 的"端到端真出 evidence"校验（需 orchestrator + DB，当前以路由层近似）。

## [D23] 可执行下周计划生成器（next-week-plan-generator，Slice 3）

- **Date**: 2026-06-14
- **Status**: Accepted（纯函数生成器 + 单测 + 接入 agent synthesis + structured_output 已落地；先不落库）

背景：
- 产品闭环第一步：助手不该只解释数据，还要给出**可执行**的下周方案（动作 × 组 × 次 × 目标重量）。这是 PM 维度的产品价值，也要守住"证据绑定、确定性、不编造"的定位。

Decision：
- 新增 `server/src/services/agent/next-week-plan-generator.ts`：纯函数 `generateNextWeekPlan(input) → NextWeekPlanDraft`，输入是从 weekly report / exercise progress 提取后的干净结构（progressionMode / weakArea / topExercises / focusExercise 的重量基线），无 LLM、无 DB、可单测。
- **方案合成规则（确定性，命名常量）**：每个动作 `sets` 由进展策略决定（`SETS_BY_MODE`：consolidate/maintain=3、add_frequency=4）；次数区间固定 `WORKING_REP_MIN~MAX`=6~10；focus 动作目标重量 = 取整(估算 1RM × `TARGET_INTENSITY_PCT_OF_1RM`=0.72) 到 `WEIGHT_ROUNDING_KG`=2.5kg；无 1RM 时退化用近期最高重量，再无基线则 `target_weight_kg=null` 并提示"沿用上次重量"。最多 `MAX_PLANNED_EXERCISES`=4 个动作。
- **绝不编造重量**：没有真实重量基线就给 null + 文案提示，而不是凭空算一个 kg。这是定位的硬约束。
- **结构化、不内联进答案文本**：草案作为 `NextWeekPlanDraft` 挂在 agent 输出 → `MockAssistantTurnResponseData.plan` → `structured_output`（与 `agent_trace`/`faithfulness` 同款 optional 字段），**不**写进 answer 的 summary/bullets。这样 Slice 1 的 faithfulness 数字扫描看不到这些**派生**目标重量，不会误标——派生数字本就不在工具输出里。这是与 D21 的关键交互。
- **先不落库**：本片只生成 + 结构化展示（structured_output 持久化随消息），不引入 planned-workout 数据模型、不接"接受计划"。那是 Slice 5。
- ProgressionMode 类型从 agent 内部提升到 `react-planner-types.ts` 共享给生成器。

与未来的关系：
- Slice 4（运动员档案）会把目标 / 器械 / 伤病喂进生成器输入，让 sets/强度/动作选择更个性化更安全；Slice 5 把本草案接成 app 里的「计划训练」并记录依从度。生成器的纯函数签名预留了 `(+ 档案)` 扩展位。

Out of scope（本次不做）：
- 前端结构化渲染草案卡片；落库为 planned workout；按器械 / 伤病约束筛动作；多动作各自的 1RM 基线（weekly top_exercises 不带单动作重量，故非 focus 动作目标重量保持 null）。

## [D24] 运动员档案（薄）+ 注入计划生成器（athlete profile，Slice 4）

- **Date**: 2026-06-14
- **Status**: Accepted（持久化 + CRUD + 注入 agent 已落地，分 3 批）

背景：
- Slice 3 的计划生成器对所有人用同一套增肌方案。要做"个性化 + 安全"，需要一份薄档案（目标 / 每周天数 / 器械 / 伤病约束）持久化并注入 agent，喂给生成器更准、更安全。

Decision：
- **数据模型（Batch 1）**：`athlete_profiles` 表，`user_id` 主键（一人一档，CRUD 走 upsert），`goal`（受控枚举 strength/hypertrophy/endurance/general_fitness）、`weekly_days`（1–7）、`available_equipment text[]`（受控词表）、`injury_constraints text[]`（自由标签）。repository（get/upsert）+ service（zod 校验、标签归一化小写去重 ≤10 个、DI 可注入 fake repo 单测）。只存训练偏好，不存身高体重真实姓名（AGENTS §7.4）。
- **HTTP CRUD（Batch 2）**：`GET/PUT /api/athlete-profile`，鉴权必填，PUT 用 `.strict()` zod 拒绝额外字段（含 `user_id`），thin controller + 路由挂载，controller 单测 mock service。
- **注入 agent（Batch 3）**：orchestrator 在 `next_week_plan` 路径用 `getAthleteProfile(userId)` 加载档案（**best-effort：加载失败回退 null，不破坏规划**），映射成 `PlanProfileContext`（goal/weeklyDays/injuryConstraints）经 `NextWeekPlanAgentInput` → 生成器。生成器据 `goal` 选次数/强度方案（`GOAL_SCHEMES`：strength 3~6@85%、hypertrophy 6~10@72%、endurance 12~15@60%、general_fitness 8~12@68%；**无档案退回 hypertrophy，保持档案上线前行为**），伤病约束 / 每周天数注入安全与分配提示 notes。
- **为何确定性映射而非让模型解释档案**：与项目定位一致；目标→方案、伤病→提示都是确定性规则，可单测、可解释、零成本。
- **为何 best-effort 加载**：个性化是增强项，不应让档案查询故障阻断核心规划能力（降级到默认方案）。

与未来的关系：
- Slice 5 把生成的草案接成 app 里「计划训练」并记录依从度；伤病约束未来可升级为按动作→部位的硬过滤（当前是安全 notes）；前端档案编辑表单 + 把 DTO 提升到 `shared/` 待前端 CRUD 片。

Out of scope（本次不做）：
- 前端档案编辑 UI；按器械/伤病硬过滤动作；把档案喂给非 next_week_plan 的其它 intent；档案历史版本。
