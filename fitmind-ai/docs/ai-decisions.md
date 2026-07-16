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

## [D25] 可观测 + AI 配额限流（observability + rate limit，Slice 6）

- **Date**: 2026-06-14
- **Status**: Accepted（每轮 telemetry + 限流中间件已落地，分 2 批；Track 1 AI 工程，回摆平衡 Slice 3/4 的 Track 2）

背景：
- AGENTS §7.3 承诺的 AI 限流（20/分、50/天）此前只是文档承诺、未实现；助手每轮也没有延迟/调用计数等运维 telemetry。要兑现承诺并具备"每轮可观测"。

Decision：
- **每轮可观测（Batch A）**：`assistant-turn-observability.ts` 纯 builder `buildAssistantTurnLogEvent` + `logAssistantTurnEvent`，记录 intent / 总延迟 / 工具调用数 + 错误数 + 总工具耗时 / agent 步数 / faithfulness 状态（verified/flagged/unchecked）/ 有无 plan，单行结构化 JSON。**接入点选在两个 turn controller**（mock-turn / stream-turn）各一处，而非 orchestrator——避免 observability ↔ orchestrator 循环依赖，且 controller 能拿到完整 response（tool_calls/agent_trace/faithfulness/plan 都在里面）+ 测量总延迟。**token 成本故意不记**，等 Slice 7 接真实计费 provider 再加。
- **AI 限流（Batch B）**：`ai-rate-limiter.ts` 纯固定窗口限流器 `createAiRateLimiter({ perMinute, perDay, now })`，注入 store（内存 Map）+ clock，可确定性单测；每用户每分钟 20 次超限 → `RATE_LIMITED`，每天 50 次 → `AI_QUOTA_EXCEEDED`（命名常量来自 §7.3），仅在完全放行时才消费计数器，retryAfterSeconds 给到窗口末尾。`ai-rate-limit-middleware.ts` 用 `createAiRateLimitMiddleware(limiter)` 工厂（可注入 limiter 便于测）+ 默认内存单例，挂在 mock-turn / stream-turn 两个 AI 端点（authMiddleware 之后，拿到 res.locals.userId），超限抛 `HttpError(429, code, …, { retry_after_seconds })` 走统一错误处理。
- **为何内存计数而非 DB/Redis**：与项目 mock-first、零依赖、可单测定位一致；先把承诺落地 + 接口 seam 建好。**诚实标注限制**：单进程内存计数，多实例/Serverless 各自计数，分布式需 Redis/DB 计数器（`AiRateLimiter` 接口不变，换实现即可）。
- **为何错误码这样映射**：每分钟超限是瞬时退避 → `RATE_LIMITED`；每天 50 次是硬上限 → `AI_QUOTA_EXCEEDED`，两者都是文档里已有的 429 码，前端/调用方可区分"稍后重试"vs"今日用尽"。

与未来的关系：
- Slice 7 接真实模型后：observability 加 token/成本字段、限流可叠加成本预算；分布式部署换 Redis/DB 计数。

Out of scope（本次不做）：
- 全局 60/IP/分钟与登录限流；分布式计数；telemetry 落库/接 APM；错误轮（失败 turn）的 telemetry。

## [D26] 接受计划 → planned workout 模型 + 依从度（Slice 5）

- **Date**: 2026-06-14
- **Status**: Accepted（依从度计算器 + 持久化 + HTTP 已落地，分 3 批；合上闭环）

背景：
- 此前助手能生成下周草案（Slice 3）但用户无法"接受"它，也没有 planned vs performed 反馈。要真正合上 记录→分析→计划→再记录 的产品闭环，需要把草案接成 app 里的计划训练并给依从度。

Decision：
- **依从度计算器（Batch 1）**：`services/training/plan-adherence.ts` 纯函数 `computePlanAdherence({ plannedExercises, performedExercises })`，动作名 trim+lowercase 匹配，逐动作 done/partial/missed + 动作级/组级依从比例，完成度用 min(performed, planned) 封顶 100%，除零安全。无 LLM、无 DB、6 例单测。比例小数位用命名常量。
- **持久化（Batch 2）**：`planned_workouts` 表把 `NextWeekPlanDraft` 存为 jsonb 快照 + 周期 + status（active/completed/abandoned）+ 可选 source_message_id。repository（create/getActive/updateStatus）+ service（`acceptPlan` 校验后持久化、`getCurrentPlanWithAdherence`、`setPlanStatus`）。
- **依从度在读取时计算，不新增 performed 数据**：`getCurrentPlanWithAdherence` 取 active 计划后，用既有 `getTrainingSummary` 拉该周期内已记录训练的 by-exercise，喂给计算器。好处：单一事实来源（performed 永远来自真实训练日志）、计划是快照不漂移、零冗余存储。
- **计划存快照而非引用动作字典**：jsonb 存草案全文，未来动作字典变化不影响历史计划/依从度回看。
- **date 列读取转 text**：`start_date::text`，避免 pg 把 date 解析成 JS Date，干净喂给 `getTrainingSummary` 的 `$::date`。
- **读取时用 zod 解析 jsonb plan**：`planDraftSchema.parse(row.plan)` 既校验又给类型，避免 `as` 类型逃逸（遵守 AGENTS §4）。
- **HTTP（Batch 3）**：`POST /api/planned-workouts`（接受，201）、`GET /api/planned-workouts/current`（带依从度或 null）、`PATCH /api/planned-workouts/:id`（completed/abandoned）。thin controller + zod `.strict()` 校验 + controller 单测。

与未来的关系：
- 前端「接受计划」按钮 + 依从度卡片（让闭环在 UI 可见）；依从度可反过来注入 agent 上下文（下次规划参考上次依从，如依从低则更保守）；可加完成单个动作的勾选/手动 override。

Out of scope（本次不做）：
- 前端 UI；按 set/rep/重量的细粒度依从（当前以动作×组数为粒度）；自动判定计划完成/过期；把依从度喂回 agent。

## [D27] 周报回传单动作最高重量 → 非 focus 动作目标重量（补 D23 局限）

- **Date**: 2026-06-17
- **Status**: Accepted（聚合 + 接线 + 单测已落地）

背景：
- D23 的计划生成器只有 focus 动作（即用户指定、走 `get_exercise_progress` 的动作）有重量基线，能算出具体 `target_weight_kg`；其余 top 动作目标重量恒为 `null`，前端只能显示"沿用上次重量"。根因写在 D23 的 Out of scope：周报 `top_exercises` 来自 `training-summary` 的 `by_exercise`，只带 `exercise_name + set_count + total_*`，不带单动作重量，所以非 focus 动作没有重量基线。

Decision：
- **在聚合层加重量基线，而不是在周报里 enrich**：`training-summary-repository.ts` 的 `by_exercise` 分组 SQL 增 `MAX(COALESCE(s.weight_kg,0)) AS max_weight_kg` 和 `MAX(COALESCE(s.weight_kg,0) * (1 + COALESCE(s.reps,0)/30)) AS estimated_1rm_kg`（Epley，与 `exercise-progress-repository` 同款规则）。`training-summary-service` 的 `TrainingSummaryExerciseDto` + zod schema、`weekly-training-report-service` 的 `WeeklyTrainingReportExerciseDto` 各加这两个 nullable 字段；周报 `top_exercises` 本就直接 slice 透传，运行时自然带上。
  - **为何聚合而非 enrich**：enrich 要对每个 top 动作再发一次 `getExerciseProgress` 查询（N 次往返）；而 `by_exercise` 聚合本就扫同一批 sets，加两个 `MAX` 几乎零成本，且和单动作进展共用同一条计算规则，单一真相源、不漂移。
- **生成器统一重量推导**：`next-week-plan-generator.ts` 把原 `buildFocusExercise` 的重量逻辑抽成共享 `buildPlannedExercise(name, baseline, sets, scheme)`，focus 与非 focus top 动作共用：有估算 1RM → 取整(1RM × 目标强度比例)；退化到近期最高重量；两者都无则 `target_weight_kg=null` + "沿用上次重量"。`buildGeneratorInput` 把每个 top 动作的 `estimated_1rm_kg/max_weight_kg` 读进 `NextWeekPlanGeneratorInput.topExercises`。沿用 D23 既有常量（`WEIGHT_ROUNDING_KG` 等），不新增。
- **顺手修掉自重 0 基线**：共享 helper 把 `≤0` 的基线（纯自重动作 `MAX(COALESCE(weight,0))=0`）判为"无基线 → null"，修掉旧 focus 路径在自重动作上会显示 `target 0kg` 的行为。更保守、不编造。
- **守住 D23/D21 的关系**：计划重量仍只挂在 `structured_output.plan`（`NextWeekPlanDraft`），不写进 answer 文本，Slice 1 faithfulness 数字扫描看不到这些派生重量，不会误标。
- **绝不编造重量**：真没有任何重量基线的动作仍保持 `null` + 文案，未变。

DTO 边界：
- weekly report / training summary 的 DTO 是 server 本地类型（不在 `shared/`），客户端读周报走松散解析，agent 读 `top_exercises` 走 `unknown` + `readNumber`，故无前后端 shared 漂移风险。`assistant-orchestrator-service` 里的本地结构视图是只读子集，运行时多出字段不影响类型。

局限 / 未来：
- 估算 1RM 用单组 Epley 的组内最大值，高次低重的耐力组可能高估，仅作起始重量参考；前端把非 focus 动作的具体目标重量渲染出来仍待前端片；依从度尚未按目标重量细粒度比对（仍以动作×组数为粒度，见 D26）。
- **2026-06-17 修订**：`buildPlannedExercise` 的 basis 文案此前直接拼接原始浮点 1RM（实地走查时杠铃深蹲显示「估算 1RM 110.83333333333333 kg」）。修复为用 `formatOneRmForDisplay`（取整到 1 位小数）仅做**展示**取整；目标重量仍用未取整 1RM × 强度比例再 `roundToPlate`，避免复合误差。+1 例防回归单测。

## [D28] Provider seam 审计 + 真实模型上线决策（roadmap §8 Slice 7）

- **Date**: 2026-06-17
- **Status**: Accepted（审计 + 文档；本片不改代码，发现的接缝气味记为后续片）

背景：
- 共识是「暂只用免费 / mock provider 控成本，但保留干净的 provider seam，等接真实大模型时只动一层」。本片做两件事：(1) 审计现有 provider 抽象是否真的「换模型只动一层」；(2) 把「为何暂缓接真实大模型、真接时哪些维度会变」写成可讲的决策记录（PM + AI 工程两边都要能答）。
- 定位锚点：本产品的差异化是「证据绑定、确定性、不是套壳 ChatGPT」。provider 只负责**选意图 / 选工具 / 措辞**，所有**数字与结论都来自确定性计算层**——这条决定了换模型的风险面很小（模型不产出数据，只产出路由与自然语言）。

审计结论 —— 三处独立 LLM/embedding 接缝：
1. **助手轮 provider**（主 tool-calling / 措辞路径）：`AssistantProvider` 接口（`provider-types.ts`）+ `provider-adapter.ts`（按 `ASSISTANT_PROVIDER` 选）+ `provider-config.ts` + `anthropic-provider.ts` / `mock-provider.ts`。**换模型只动一层成立**：加 provider = 1 个新实现文件 + 扩 `ASSISTANT_PROVIDER` enum + adapter switch 一个分支。adapter 还做了 `ensureAllowedTool`（拒绝模型编造的工具名）和统一错误归一化，是干净的防御边界。
2. **训练录入解析**（`workout-intake-llm-parser.ts`）：`WorkoutIntakeLlmRawParser` 工厂按 `WORKOUT_INTAKE_LLM_PROVIDER`（`off`/`mock`/`anthropic`/`gemini`/`groq`）选；返回裸字符串 → 宽松 zod 兜底（`llmWorkoutIntakeOutputSchema`），解析失败回退规则解析器。已有免费 provider（groq/gemini）。
3. **RAG embedding**（`voyage-embedding-client.ts`）：Voyage `voyage-4-lite` / 1024 维，常量固定，独立一层。

发现的接缝气味（不阻塞，记为后续可改进，**本片不改**）：
- **A. 助手轮缺免费 provider**：`ASSISTANT_PROVIDER` 只有 `mock`/`anthropic`，没有 Groq。「暂只用 Groq 免费」其实只覆盖录入解析这一缝；助手轮要真零成本上线需补一个 Groq 实现（OpenAI 兼容 `chat/completions`，工具调用走 `tools`/`tool_choice`）。
- **B. 模型 id + api version 硬编码且重复**：`claude-sonnet-4-20250514` 与 `2023-06-01` 在 `provider-config.ts` 和 `workout-intake-llm-parser.ts` 各写一份。换模型/升级版本要动两个文件，「只动一层」不完全成立。建议收进 env（如 `ANTHROPIC_MODEL`）或共享常量。
- **C.「流式」名不符实**：SSE 推的是**确定性 agent 步骤**（`agent_step_*`、`provider_selected`），`runAssistantProvider` 本身是单次**非流式** fetch。真正的 token 级流式输出 + 流式计费需要 provider 层支持 streaming（`stream: true` + 增量解析）。

Decision（为何暂缓接真实大模型）：
- **成本**：真实模型按 token 计费，开发/eval/demo 高频调用会持续烧钱；mock provider 让全链路、eval、E2E 零成本可复现。
- **确定性 / 可复现**：mock 输出确定，单测与 `pnpm eval` 能断言 intent 路由 / 拒答 / faithfulness；真实模型有随机性，不适合做回归断言的**基线**。
- **风险面已被架构压到最小**：模型不产出用户可见数字（数字来自计算层 + faithfulness 校验），所以「先用 mock 把护栏/闭环做扎实，再换模型」是低风险顺序。

真接真实大模型时，会变的维度（这条是面试可讲的核心）：
- **流式 token 计费**：provider 层加 streaming；observability（D25）补 input/output token 数与成本字段；限流（D25）从「次数」叠加「token / 成本预算」。
- **Prompt caching 经济学**：system prompt + 工具定义是稳定前缀，可用 provider 的 prompt caching 显著降本；意味着 prompt 要稳定、把易变上下文后置。
- **faithfulness / eval 从「锦上添花」变「刚需」**：mock 不会编造，真实模型会——D21 的运行时 faithfulness 校验和 D22 的 eval 门禁此时才真正发挥拦截价值（编造数字会被标注 / 回归会非零退出）。这正是先做 Slice 1/2 的理由。
- **延迟 / 成本遥测**：D25 的每轮 telemetry 补真实延迟分布与每轮成本，用于预算告警。
- **降级链**：真实 provider 故障 / 超预算 → 回退到更便宜模型或 mock / 确定性兜底，保证核心「记录→分析」不依赖外部模型可用性。

与未来的关系 / Out of scope：
- 本片纯文档，不补 Groq 助手 provider（气味 A）、不收编模型常量（气味 B）、不做流式（气味 C）——这些是接真实模型那一片（或独立的小 seam 清理片）的工作。届时按上面的「会变维度」清单逐项落地。

## [D29] LangChain / LangSmith：选择性增强决策（逐方向 verdict + 时机）

- **Date**: 2026-06-20
- **Status**: Accepted（决策记录；现在不动手，时机=Slice 11 接真实模型之后）

背景 / 立场：
- 用户提出的框架定位是「**不是从无到有靠 LangChain 加能力，而是先用原语自己造一遍（RAG / agent / eval / faithfulness），再在框架真能加杠杆处选择性采纳**」。这把 AGENTS §11「刻意不引入 LangChain/LangGraph/MCP」从"排斥"升级为"有判断力的选择性采纳"——对 AI PM / 应用开发岗是更强的叙事（懂原语 + 会判断何时上框架）。
- LangSmith 可独立 SDK / OpenTelemetry 使用，不强依赖 LangChain；故技术上可接。

逐方向 verdict（对照已自研的部分）：
| 方向 | 现有自研 | verdict |
| --- | --- | --- |
| retriever 抽象 | hybrid 0.7 向量 + 0.3 关键词（Voyage + pgvector，`knowledge-retriever.ts`） | 🟡 中——要的是接口可换性，非现成实现（套 LangChain PGVector 仍需重写 hybrid 权重） |
| RAG pipeline | 检索→注入确定性答案（简单） | 🟡 低-中——LCEL 适合复杂多步，本链不复杂；真正能加的是 reranking（Phase 7.0 已记待办） |
| structured output | 自研 JSON schema 校验 + faithfulness（D21） | 🔴 低——LangChain `withStructuredOutput` 只是 provider 原生 tool-use/JSON mode 的薄包装，自研已更强，接了是退步 |
| tracing | 自研每轮 telemetry（D25） | 🟢 接真实模型后值——LangSmith trace UI 加速调 prompt（mock 期无可 trace） |
| agent harness | 自研**确定性** ReAct（D20，刻意不用 LangGraph） | 🔴 最不该换——确定性 / 可审计是产品护城河，换 LangGraph 等于让出差异化 |
| LangSmith eval | 自研 eval 套件 + 门禁（D22） | 🟢 接真实模型后当增强——数据集 + LLM-as-judge UI；核心 eval 仍自研当承重护栏 |

Decision：
- **现在不接**：mock-first 无真实模型调用可 trace/评估；且与"自研护栏"差异化重叠；agent harness / structured output 接了反而退步。
- **接真实模型（Slice 11）之后**，选择性采纳「值」的两类：**tracing + LangSmith eval**（可观测/评估托管 UI）、**retriever 接口 + reranking**（可换性 + 检索质量）；**坚决保留自研**：agent harness（不上 LangGraph）、structured output（provider 原生 + faithfulness）、核心 eval（`assistant-eval.ts` 当承重护栏，LangSmith 只做增强 UI）。
- 接 LangSmith 前确认 trace **不带 PII**（落实 §7.4 脱敏；LangSmith 是云端 SaaS）。
- 每一处采纳都要在本文件补一条"为何引入 / 为何不违背不用 LangChain 初衷"，保持可讲。

与未来的关系：归入 §8.2 总路线的 Phase C（真实模型之后的增强），不早于 Slice 11。

## [D30] 录入鲁棒性：变组 LLM 兜底升级启发式（§8.2 Phase A / Slice 12）

- **Date**: 2026-06-20
- **Status**: Accepted（已落地 + 单测）

背景：
- 用户反馈"一个动作做几组、每组重量/次数不一样时识别不了"。实地核对：规则解析器对**干净**的成对写法（`60x10 65x8 70x6`）能正确出多组；真正断的是口语 filler（"做了 / 加到 / 了"）让 `SET_PAIR_PATTERN` 漏匹配，把"每组不同重量"压扁成更少甚至单组。而 hybrid 的 `shouldUseLlmFallback` 原条件（无有效组 / incomplete / warning / no_candidates）此时**全为假**——结果是"自信但残缺"，LLM 兜底不触发，用户静默拿到错值。
- 确认 UI 不是瓶颈：`workout-intake-to-session-draft.ts` 已把每个解析 set 映射成独立可编辑行，解析器产出 N 组 UI 就显示 N 个可编辑行。

Decision：
- 在 `workout-intake-hybrid-parser.ts` 给 `shouldUseLlmFallback` 加一条触发：`likelyFlattenedVariedSets`——**原文出现 ≥2 个互不相同的重量（带单位 60公斤/27.5kg/135磅，或成对 60x10 的左值），但规则解析捕获到的不同重量更少 → 判定可能被压扁 → 升级 LLM 兜底重解**。
- **比较"不同重量的个数"而非具体数值**：规则解析会把磅换算成 kg、原文不会，比数值会误判；比个数对换算安全。
- 不动规则解析核心（避免回归）、不动 UI（已满足逐组可编辑）。常量 `MIN_DISTINCT_WEIGHTS_FOR_VARIED_SET_CHECK=2`。
- +2 单测：① filler 压扁场景升级 LLM 并还原 3 个不同组；② 规则已捕获全部不同重量时**不**过度触发（仍 `rule_parser`）。

局限 / 依赖：
- 真正解析变组靠 LLM——生产 Vercel 配了 `WORKOUT_INTAKE_LLM_PROVIDER=groq` 故手机端生效；**本地默认 `mock`**（`env.ts`），mock LLM 只产均匀组，本地要真测需配 `GROQ_API_KEY`。
- 只覆盖"重量不同"的压扁；"重量相同但每组次数不同"未被此启发式捕获（确认 UI 可手动改；后续可再加 reps 维度信号）。

## [D31] 是否引入 Python / FastAPI（考虑，暂缓）

- **Date**: 2026-06-20
- **Status**: Considered / Deferred（不现在做；最佳切入点=Phase C 的单一 ML 微服务）

背景：
- 用户问"考虑 Python + FastAPI 的加入"。当前栈是 Node/Express/TS 单仓（client/server/shared），无任何需要 Python 的计算。

判断：
- **现在不加**：FitMind 现有计算是确定性 TS + provider 走 fetch，没有 Python 才擅长的负载；只为"简历有 Python"而引入会把干净单仓拆成两套运行时/部署/CI，是 resume-driven、得不偿失。
- **真正值得切入的位置（都在 Phase C / 真实模型之后）**：把**单一 ML 重活**拆成一个 FastAPI 微服务，Node 端通过 HTTP 调用（干净接缝，呼应 provider seam 哲学）。最佳候选：① RAG **reranker**（cross-encoder，Python 生态成熟）；② **安全分类器**（Slice 10，若用 HF transformer / 微调模型）；③ 离线 **eval / 实验台**（pandas / ragas 等）。
- 若决定做：保持核心单仓 TS 不变，只新增**一个**职责单一的 Python 服务，并在本文件记"为何这块用 Python、边界在哪"。这本身是"按合适工具选型 + 服务化"的好面试叙事，强于到处塞 Python。

与未来的关系：归入 §8.2 Phase C，作为 C2（reranker）或 C3（安全分类器）的可选实现方式，不早于 Slice 11。

## [D32] 对话"不死"的纯确定性止血（§8.2 Phase A / Slice 11a）

- **Date**: 2026-06-21
- **Status**: Accepted（已落地 + 单测 + 真链路验证）

背景：
- 用户反馈"稍微不按规矩问就没了"。根因：意图路由 `classifyAssistantIntent` 是关键词正则，匹配不上即落 `unsupported`。但 `unsupported` 其实混了两类：① 真越界（天气/股票黑名单或空消息）；② 没听懂但可能训练相关。原本两类都给同一条罐头拒答（已是澄清式，但二类被白白浪费）。
- 这是 stopgap（仅缓解）；根治是 Slice 11（真实 LLM 路由）。

Decision：
- **不改分类器返回的 intent**（保证 eval `intent_routing 13/13` + `refusal_regression 12/12` 不动——eval 只看 `classifyAssistantIntent().intent`，不跑 orchestrator）。改在 orchestrator 的 `unsupported` 分支分流：
  - 导出 `isOutOfScopeMessage`（黑名单/空）→ 命中保持原澄清拒答。
  - 否则用 `tokenizeKnowledgeQuery(message).length > 0` 当**相关性闸门**：纯无关查询（"我女朋友生气了"）tokenize 返回空 → 不检索、直接澄清（避免向量模式拿无关 chunk 乱答）；有训练锚点（疲劳/恢复…）→ RAG 检索，命中知识用 `composeKnowledgeAnswer`（带 Sources + 免责），无命中退回澄清。
  - 兜底命中知识时 response.intent 记 `knowledge`（observability/持久化更诚实）。
- **保守扩同义词**（直接修路由，减少落 unsupported）：`KNOWLEDGE_PATTERN` 加 热身/拉伸/组间休息/睡眠；`RECOMMENDATION_PATTERN` 加 练哪；`tokenizeKnowledgeQuery` 词表同步加 热身/拉伸/组间休息/睡眠。改完 eval + 路由测试双绿才留。
- **为何 tokenize 当闸门而非分数阈值**：关键词排序对无锚点查询天然返回空，是个干净的相关性下限；而向量分数语义跨模式不一（归一化 vs 原始 cosine），单一阈值不可靠。这把"不乱答"做成确定性的，符合定位。

验证：
- 门禁全绿（type-check / lint / test:unit 273 / eval 13/13·12/12·3/3）。
- 真链路（node UTF-8 探针，避开 curl 在 Windows 传中文的编码问题）："怎么缓解训练后的疲劳"/"训练后怎么加快恢复"→ unsupported 分类但走 RAG 兜底 → knowledge + sources=3；"我女朋友生气了怎么办"→ 无锚点 → 澄清不乱答；"今天悉尼天气"→ 拒答保留。

局限 / 依赖：
- 闸门词表有限（curated vocab），覆盖窄——这是 stopgap 的本质，泛化靠 Slice 11 的真实 LLM 路由。
- 疼痛/医疗边界查询若带锚点会走知识答（有免责），但**安全硬路由是 Slice 10 的职责**（§8.2 排在真实模型之后）。

- **2026-06-21 修订（前端粘 mode bug，致命 UX，提前修）**：上线后用户在 prod 自由提问仍被误路由（"训练后怎么加快恢复"→ recommendation），排查发现是前端 bug 掩盖了本片：`AssistantChatPanel` 把 `mode` 存在共享 `promptSuggestion` 里且**会粘住**——点过一次快捷问题/洞察卡片（如 `next_training_focus`）后，之后**手输的自由提问继承旧 mode**、发的不是 `auto`，绕过服务端 `classifyAssistantIntent`（本片改的路径）。修复：用户手动改写文本（`onChangeMessage`）与提交后都把 `mode` 重置为 `auto`（`AssistantChatPanel.tsx`）。实地验证：点"本周训练报告"后再输"训练后怎么加快恢复"，请求 `mode=auto` → 后端 `intent=knowledge` + RAG 3 源。**教训**：服务端 classify / eval 全绿 ≠ 用户真用得上——客户端发的 `mode` 决定是否触达该路径。`mode` 双轨（客户端显式 mode vs 服务端 auto classify）应在 Slice 11 收敛。

## [D33] 助手"自信错答"止血：回退过宽词表 + 知识检索相关性下限（A+B，先稳定）

- **Date**: 2026-06-21
- **Status**: Accepted（已落地 + 单测 + 真链路验证；只减不增、更诚实）

背景（稳定性体检发现）：
- 把助手按各类提问跑了一遍发现：① "今天适合练什么" 路由对但 provider 不接 → 兜底文案（路由双轨）；② "睡眠/热身"等**知识库没覆盖**的话题被**自信错答**（向量召回返回"语义最近"的恢复 chunk）；③ RAG 排序逐次抖动（同问时对时错）。其中 ② 是我 Slice 11a 扩词（把 热身/拉伸/组间休息/睡眠 加进知识路由）**放大**的——把原本诚实的"没识别清楚"改成了自信错答，比原来更糟。
- 用户要求"先稳定再拓展"。本片只做最伤信任的 ②，把"自信错答"摁成"诚实没资料"。①③ 的结构性根因（路由双轨/向量打分）留给 Slice 11 真实模型路由收敛。

Decision：
- **A（回退过宽词表）**：撤掉 Slice 11a 加的 `KNOWLEDGE_PATTERN` 词（热身/拉伸/组间休息/睡眠）、`RECOMMENDATION_PATTERN` 的"练哪"、`tokenizeKnowledgeQuery` 词表对应项。效果：这些无知识库内容的词回到 unsupported → 澄清，不再硬路由 knowledge 后被向量乱答。保留 11a 安全部分（`isOutOfScopeMessage` 分流 + 疲劳/恢复 这类**有内容**的兜底）。
- **B（相关性下限 = 词法重叠，而非分数阈值）**：新增纯函数 `filterRelevantKnowledgeChunks(chunks, query)`——只保留**与查询精选 token 有词法重叠**（token 出现在 chunk title/category/text/tags）的召回；无重叠则空。orchestrator 的 knowledge 分支与 11a 兜底分支都先过这层，空了就走诚实回退（`composeKnowledgeAnswer` 空 sources 文案 / 澄清）。
- **为何词法重叠而非向量分数阈值**：知识库很小，纯向量"语义最近"恰恰是错答来源；向量分数跨模式（keyword 计数 / hybrid 归一化 / 纯向量原始 cosine）语义不一、且逐次抖动，阈值既难定又会让边界问题忽对忽错。词法重叠**确定性**、可单测、顺带消除 ③ 在知识路径上的抖动表现。代价：纯语义、无术语重叠的合法问题也会被判"没资料"——对本产品**宁可诚实说不知道，不要自信错答**，可接受；泛化靠 Slice 11。
- 不动检索核心打分（hybrid 0.7/0.3 不变）、不动 agent 的 RAG（只在 orchestrator 答案分支加过滤，规划器 sources 不受影响）。

验证：
- 门禁全绿（type-check / lint / test:unit 276 / eval 13/13·12/12·3/3）；+3 单测（词法重叠保留 / 语义最近无重叠丢弃 / 无术语返回空）。
- 真链路（本地后端=同 Neon+Voyage≈prod）：睡眠/热身 → 诚实澄清 sources=0；渐进超负荷/deload → 精准 1 源；恢复/疲劳 → 命中"训练疲劳和恢复判断"；女朋友/天气 → 澄清/拒答。"自信错答"消除。

遗留（不在本片，Slice 11 处理）：
- ① 路由双轨（classify vs mock-provider）："今天适合练什么"等仍可能 provider 不接 → 收敛路由。
- ③ RAG 排序逐次抖动的根（向量召回非确定）——本片已消除其在知识答上的**可见**抖动（词法过滤后确定性），但底层向量召回顺序仍非确定。

## [D34] Groq 助手 provider 接缝（Slice 11.1，建接缝、零行为变更）

- **Date**: 2026-06-21
- **Status**: Accepted（已落地 + 单测；默认仍 mock，env 可切换/回退）

背景：D28 气味 A——助手轮 provider 只有 `mock`/`anthropic`，没有免费 Groq。Slice 11（真实模型路由）的第一步：先把 Groq provider 接缝建好，**不改任何默认行为**，把风险隔离在"加一个可选 provider"上。

Decision：
- 新增 `groq-assistant-provider.ts`：实现既有 `AssistantProvider` 接口，走 Groq 的 OpenAI 兼容 `chat/completions` + `tools`/`tool_choice`；返回 zod 校验，异常/异形响应 → 干净的 `GROQ_PROVIDER_ERROR`（不抛进 orchestrator）。tool_call → `{kind:"tool_call"}`，content → `{kind:"message"}`，否则 error。
- `provider-config.ts` 加 `getGroqAssistantProviderConfig`（key 必填、模型来自 `GROQ_MODEL` 默认 `llama-3.3-70b-versatile`——**新 provider 模型 id 从一开始就 env 可配**，不重蹈 D28 气味 B；旧 anthropic 硬编码 id 暂未收编，留作后续）；`provider-adapter.ts` switch 加 `groq` 分支；`env.ts` `ASSISTANT_PROVIDER` enum + 类型加 `groq`；`assistant-stream-types.ts` 的 `provider_selected` 事件类型同步加 `groq`（类型传播）。
- **默认仍 `mock`**：不接路由、不改答案，纯接缝；5 例 mock-fetch 单测（tool_call / message / HTTP 错误 / 空响应 / 缺 key 抛错）。
- 系统/用户 prompt 在 groq provider 内自带一份（与 anthropic 对齐）；跨 provider 的 prompt 共享留到 11.3 措辞阶段再抽，避免本片扩面。

与未来的关系：11.2 才让 LLM 真正参与路由（带校验 + 确定性回退 + 扩 eval）；客户端 `provider_selected` 接受 `groq` 的类型放宽留到 11.2（届时才会真的发 groq）。回退：`ASSISTANT_PROVIDER=mock` 一键回到确定性。

## [D35] provider 路径"数据意图必出工具"安全网（Slice 11.2a，确定性、治①）

- **Date**: 2026-06-22
- **Status**: Accepted（已落地 + 单测；provider 无关，默认 mock 也生效）

背景：体检问题①——"今天适合练什么"等数据类提问路由对了（recommendation），但 provider 路径里 mock-provider 选不出工具、返回一句 prose（"我目前更适合回答…"），用户拿到泛泛非答案。核查发现：provider 路径的 intent **全是"要数据"的**，`getAllowedToolDefinitions` 给 provider 多个工具可选；mock 选不准、groq 一般能选准但偶尔也会用 prose 作答。

Decision：
- 新增纯函数 `assistant-provider-fallback.ts` `coerceMessageToEvidenceToolCall(response, tool, args)`：provider 路径若返回 `message`（没调任何工具），就**兜底合成对该 mode 默认工具（`getToolDefinitionForMode`）的 tool_call**，复用既有 tool_call 执行 + 组装路径出确定性答案。仅当所需参数齐备才兜底（exercise_id 缺失的动作类工具保留其"先选动作"提示）。
- **确定性、provider 无关**：不依赖 groq 是否听话——mock 下①也被治好；groq 下作为兜底网（groq 没调工具也不退化）。这让"启用 groq"这一步变安全。
- orchestrator 接线：`runAssistantProvider` 结果过错误闸后,经本函数再进既有 message/tool_call 分支（`rawProviderResponse` → 错误闸 → `coerce` → `providerResponse`）。
- 顺带更正一条过时 smoke 断言（`assistant-mock-turn-smoke.ts`：mode=unsupported 早返回的是 `composeUnsupportedAnswer` 文案，断言改为"这个问题我还没识别清楚"；该断言自 Slice 11a 起就已与行为不符，smoke 不在门禁故未被发现）。

边界 / 未来：
- 仅作用于 provider 路径（数据 intent）；早返回的 unsupported/knowledge/next_week_plan 不受影响。
- 11.2a 让 ① 在 mock 上即被治好；**启用 groq（prod 切 `ASSISTANT_PROVIDER=groq`）的真正增量价值在"自由表达路由"（11.2b）**——groq 在 provider 路径的多工具里挑得更准只是小增益。客户端 `provider_selected` 接受 groq 的类型放宽仍随 prod 切 groq 时一并做。

## [D36] LLM 意图路由：关键词优先 + 落空时 Groq 救场（Slice 11.2b）

- **Date**: 2026-06-22
- **Status**: Accepted（已落地 + 单测；prod 切 `ASSISTANT_PROVIDER=groq` 后生效）

背景：关键词路由对"明天练啥/帮我看看这周咋样"等**自由表达**会落空 → unsupported → 死板。要让 LLM 真正参与路由,但**不能牺牲稳定性/eval 基线**。

Decision（架构：关键词优先 + 落空才调 LLM）：
- `resolveRoutedIntent` 改 async：mode=auto 时先跑确定性 `classifyAssistantIntent`,**确信命中（非 unsupported）直接用**——13 条 eval 不动、无额外延迟、无回归;关键词**只在落空**时才进救场。
- 落空后：**越界（黑名单/空）仍拒答**;否则若有 LLM router → 调 Groq 做**受限分类**（在 12 个已知 intent 里选一,含 unsupported）。
- **校验 + 确定性回退**：新增 `llm-intent-router.ts` `createGroqIntentRouter`,任何失败（缺 key / HTTP 错 / 异形 / 非法 label / 异常）→ `null` → 上层回退 `unsupported`。模型**永不崩、永不强出已知集合外的 intent**。
- **provider 无关的稳态**：router 仅当 `ASSISTANT_PROVIDER=groq` 时默认创建;mock 下 router=null → 落空仍按现确定性澄清（行为不变）。router 可经 `AssistantStreamOptions.intentRouter` 注入（测试注 fake）。
- 路由收敛到**一个决策点**（`resolveRoutedIntent`）：救场得到的 intent 走正常处理流（配合 D35 安全网,recommendation 等自然出工具答案）。
- 客户端 `provider_selected` 类型 + `formatProvider` 放宽到 `groq`（显示"智能回答"），为 prod 切 groq 做好。

验证：
- 门禁全绿（type-check / lint / test:unit 296 / eval 13/13·12/12·3/3）。
- 单测：`llm-intent-router.test.ts`（合法 label / 含标点空白 / 非法→null / HTTP 错→null / 缺 key→null）;`resolve-routed-intent.test.ts`（关键词命中不调 LLM / 落空经 fake router 救场 / router 返 null→unsupported / 越界不调 LLM / 无 router→unsupported / 非 auto mode 直映射）。
- **真实自由表达路由质量靠 prod 验证**（切 groq 后实测"明天练啥"→recommendation）;确定性 fake-router 测试覆盖救场逻辑。

边界 / 未来（11.3）：
- 关键词"自信误判"的罕见情况 LLM 管不到（keyword-first 设计）——留 11.3 LLM 主路由。
- 自由表达的**真实 LLM** 路由 eval 是非确定,留作 opt-in（默认不进门禁,类似 NarrativeJudge）。
- 切 prod groq 后,每个落空轮多一次 Groq 分类调用 + provider 路径一次 → 落空轮 2 次 Groq（落空是少数）;非落空轮仅 provider 路径一次。

## [D37] 周报工具契约对齐 + 混合/平台期相关性闸门补全（Slice 11.3a，Codex 审查止血）

- **Date**: 2026-06-22
- **Status**: Accepted（已落地 + 回归单测；门禁全绿）

背景：Codex 审查 5b46108 后报两条 —— P1 周报工具契约漂移、P2 D33 相关性闸门漏覆盖最重要的两条诊断路径。

Decision：
- **P1**：`input_fields` 的语义就是"工具的必填参数"（`buildGroqTools` 据此发 `required`，`coerceMessageToEvidenceToolCall` 据此判断是否能兜底）。`get_weekly_training_report` 的 `exercise_id` 在真实 `weeklyTrainingReportArgsSchema` 里是 optional，因此**不得**出现在 `input_fields`。修复后：没选动作的"周报"也能被兜底跑真工具；Groq 不再被强迫传 `exercise_id`（避免 `"null"` → uuid 校验失败 → 400/502）。可选的单动作收窄能力被牺牲——周报模式极少带选中动作，且不带也完整，可忽略。
- **P2**：把 D33 的 `filterRelevantKnowledgeChunks`（词法重叠相关性下限）推广到 `mixed_tool_rag` 与 `plateau_diagnosis` —— 这两条带训练 evidence 的诊断路径才是"自信错引用最近 chunk"风险最高处。无相关来源时不附 Sources（composer 显示"暂无训练知识来源"），诊断仍基于确定性工具/进展数据给出。护栏（§3"知识答需词法相关"）现已覆盖全部展示 Sources 的路径。
- **回归测试**：导出 `getToolDefinitionForMode` 并新增 `tool-contract.test.ts`，把"provider 工具定义的 input_fields ⊆ 真实 schema 必填字段"做成门禁断言——堵住 Codex 指出的"端到端测试缺口让 P1 没被门禁抓住"。

边界 / 未影响：
- `next_week_plan` agent 内部的 `retrieve` 回调（query 为 agent 生成、非用户原文）本次不动，Codex 也未圈。
- api-contract.md 早已正确记载周报 `exercise_id` 为 optional —— 本次是 input_fields 与文档/schema 漂移，文档无需改。

## [D38] 收敛单轨路由：mock provider 反映已解析 mode，删除影子分类器（Slice 11.3a）

- **Date**: 2026-06-22
- **Status**: Accepted（已落地 + 单测；门禁全绿）

背景（体检问题①的根）：路由是双轨的——`resolveRoutedIntent`（关键词 + Groq 救场，**轨 1**）定出 `executionMode` 写进 `assistant_context.mode`；但 mock provider 用**另一套正则** `detectIntentFromMessage`（**轨 2**）重新从消息分类、自己挑工具，无视传入的 mode。编排层执行的是 provider 返回的工具（轨 2），可与轨 1 分歧（"路由对却执行别的工具"）。D35 coercion 只兜住"provider 返 prose"，没消除双轨本身。

Decision：
- 把 `getToolDefinitionForMode` 抽到新模块 `assistant-tool-routing.ts`（纯函数，只依赖 provider-types，无循环 import），作为**单一 mode→工具映射源**。
- mock provider 的 `resolveDefaultIntent` 改读 `request.assistant_context.mode`，工具 = `getToolDefinitionForMode(mode).name`；保留两守卫（`get_exercise_progress` 缺 exercise_id → 提示选动作；`unsupported` → 提示文案）。**删除 `detectIntentFromMessage`/`resolveIntent`** —— 轨 2 消失。
- 结果：**全局唯一的消息→意图分类器 = `resolveRoutedIntent`**。groq 在 `allowed_tools` 里选工具是期望行为（受 `ensureAllowedProviderTool` + faithfulness + coercion 约束），不是第二个分类器。

边界 / 不变量：
- 正确路由的用例**行为不变**（mock 现在产出的工具 = executionMode 的工具 = 轨 1 已决定的）；只有过去轨 1↔轨 2 分歧的 bug 用例被纠正。
- **eval 不受影响**：`assistant-eval.ts` 的 intent 用例直接调 `classifyAssistantIntent`、refusal/faithfulness 是离线 fixtures，都不走 provider。
- groq / `ASSISTANT_PROVIDER=mock` 一键回退均不受影响（且现在是单轨）。
- 模拟钩子（`[mock:text]`/`[mock:error]`）保留。
- 未做 11.3b（让模型基于工具输出措辞）——答案仍是确定性 composer 文案。

验证：type-check / 改动文件 eslint / test:unit 303（mock-provider 测试扩为 mode 驱动 + "忽略消息文本"断言）/ eval 13·12·3 全绿。

## [D39] LLM 措辞改写（summary），faithfulness 门控 + 确定性回退（Slice 11.3b）

- **Date**: 2026-06-23
- **Status**: Accepted（已落地 + 单测；env 默认 off，零默认行为变更）

背景：答案文案此前全是确定性 composer 模板，略显死板。想让真实模型参与"措辞"，但**绝不能**动摇核心护城河——数字/结论确定性产生、evidence 绑定、faithfulness 校验。

Decision（最小且安全）：
- **只改写 `answer.summary`**：bullets（硬证据行）/conclusion/recommendation/evidence/sources 全保持确定性。blast radius 最小。
- **双门控**：新增 `ASSISTANT_PHRASING`（布尔，默认 off）+ 仍需 `ASSISTANT_PROVIDER=groq`（`isAssistantAnswerPhrasingEnabled()`）。mock/anthropic 或开关关 → 零行为变更。回退：关 `ASSISTANT_PHRASING` 或切 `mock`。
- **第二次 LLM 调用**（措辞必须在工具执行后，模型才见得到结果）：`runGroqAnswerPhrasing` system prompt 要求"自然中文改写、逐字保留所有数字/单位、不得新增或修改数字、不得加入草稿外事实"，temperature 0.3，max_tokens 256。**graceful**：缺 key / HTTP 错 / 异形 / 空 / 网络异常 → 返回原 draft，永不抛、永不破坏本轮。
- **faithfulness 兜底 + 长度闸门**：`applyFaithfulPhrasing`（纯函数）把改写后的 summary 拼回 answer 跑 `verifyAnswerFaithfulness`；verified **且**长度不超 `draft.length*1.5+16` 才采用，否则回退确定性 draft。空白 / 与 draft 相同 / 超长 → no-op。
- **诚实表述（程序性保证的边界，Codex P2）**：faithfulness 是**数字/引用级**校验（核对数字 + UUID），**不能**识别模型新增的**非数字事实**（如"恢复得很好""可以放心加量"）。所以程序性保证 = "无未验证数字/引用 + 长度受限"，**不等于**"不新增任何事实"。长度闸门只**收窄**（非杜绝）注水空间——故本特性**默认 off、开启需谨慎**。system prompt 里"不得加入草稿外事实"是给模型的指令，不是程序性保证。
- 接缝分层：`runGroqAnswerPhrasing`（groq provider）→ `runAssistantAnswerPhrasing`（provider-adapter 分发，非 groq/异常→draft）→ 编排层 provider 数据路径在 emit 前门控调用。

落地分两小批（守 ≤5 文件）：Batch 1 = env/provider-config/groq/adapter + groq 单测（配置+接缝，不接线，零行为变更）；Batch 2 = `answer-phrasing.ts` 纯函数 + 单测 + 编排层接线。

边界 / 未做：
- conclusion/recommendation 改写、整段对话化——留后续。
- **token/成本 observability**（D25 扩展）：`logAssistantTurnEvent` 尚未接进编排层，需先接线 + 从 groq 响应取 usage，单独片。
- eval 不受影响（intent 直接调 classify、faithfulness/refusal 离线 fixtures，且默认 off 不走措辞）。

验证：type-check / 改动文件 eslint / test:unit 311（groq 措辞 4 例 + answer-phrasing 4 例）/ eval 13·12·3 全绿。真链路（groq + 开关）质量靠 prod 验证。

## [D40] Token/成本 observability：聚合 Groq usage 进每轮 telemetry 日志（C1）

- **Date**: 2026-06-23
- **Status**: Accepted（已落地 + 单测；LangSmith 外部 tracing 暂缓）
- **当前结论（多轮审查后定稿；下方"演进"记历史）**

背景：一条自由表达 turn 最多 **3 次** Groq 调用——① 关键词落空时的**意图救场分类**（`llm-intent-router`）、② provider 路径的**工具选择**、③ 11.3b 的**措辞**。此前完全没记 token/成本，且救场调用根本没被计入。C1 把它做实；LangSmith 外部 tracing 因需引新依赖 + key + PII 去除，单独评估，本片不做。

Decision（定稿）：
- **共享 Groq client**（`groq-chat-client.ts`）：统一 fetch + 排空 body + **核心响应与 usage 分开解析**（usage 用 `int().nonnegative()` 校验，非法只丢 usage、绝不拖垮 tool_call/message）。返回 `{ attempted, provider, model, ok, content, toolCall, usage, errorMessage }`——`attempted` 仅在配置失败（未发请求）时 false；`provider/model` 来自**实际调用配置**，杜绝与真实调用漂移。路由 provider、措辞、意图救场三处都走它。
- **三处调用各报统一 call record**（`AssistantProviderCallTelemetry {attempted, errored, provider, model, usage}`）：意图救场（`LlmIntentClassification {intent, call}`）、措辞（`AssistantPhrasingOutput {summary, call}`）、工具选择（provider 响应**所有 variant 含 error** 都带 `telemetry`）。编排层把三者收成 `AssistantLlmCallRecord[]`，`summarizeTurnLlmCalls(records)` 聚合——**provider/model 直接取自 records（真实 client 结果），不再 re-read env**。救场 usage 在所有路径（含 knowledge/unsupported/agent）都计入。
- **服务端 telemetry 信封（不污染公开 DTO）**：`runMockAssistantTurn` 返回内部 `AssistantTurnExecutionResult { response, telemetry }`；`telemetry.llm` 是服务端运维元数据，**不进** `MockAssistantTurnResponseData` / `structured_output`。客户端不依赖 Groq/OpenAI 的 usage 结构；`telemetry` 后续可扩展 `trace_id`、各调用耗时。
- **日志字段**：`assistant_turn` 单行 JSON 加 `status`（ok/error）、`llm_attempt_count`、`llm_usage_report_count`、`llm_error_count`（三者语义不同：发起数 / 上报 usage 数 / 失败数）、`prompt/completion/total_tokens`、`provider`、`model`、`estimated_cost_usd`。
- **按模型计价，未知→null**：`MODEL_PRICING_USD_PER_1M` 表按模型查价（llama-3.3-70b：$0.59/$0.79 per 1M）；未知/未配模型 → `estimated_cost_usd: null`（绝不输出看似精确的错数）；注明是 list-price 估算，Groq 免费层实际 $0。
- **失败 turn 也落日志且带 LLM telemetry**：provider 调用失败时编排层抛 `AssistantTurnError`（HttpError 子类，带 `turnTelemetry`，**不序列化给客户端**）；控制器在错误分支用它发 `logFailedAssistantTurnEvent({..., llm})`——Groq 429/500 这类失败轮也有 `llm_attempt_count=1 / llm_error_count=1 / model / usage`。
- **空响应保留 usage**：措辞/路由空文本回退 draft 时仍带 `call.usage`（调用已发生、可能有 usage）→ 上报数与成本不漏算。

演进（历史，已被取代）：
- 初版（a8aa58e）把 `token_usage` 放进公开 DTO → API 契约污染 P2 → 改内部 telemetry 信封（dc1265d）。
- 二审（890ccee–95efb43）：救场调用未计（"最多两次"错，实为三次）、成本写死模型、usage 挤主 schema 可拖垮 tool_call、`llm_call_count` 实为"usage 上报数"、失败 turn 不记日志 → 拆 attempt/usage_report/error 计数 + 按模型计价 + 失败轮日志 + 抽共享 client。
- 三审（本次）：失败的 provider 调用仍丢 telemetry（throw 前不带）、provider/model 仍 orchestrator re-read env、空响应丢 usage → 统一成 `AssistantProviderCallTelemetry` call record（所有 response variant 含 error 都带），provider/model 从 records 聚合，`AssistantTurnError` 把 telemetry 带到失败日志，空响应保留 usage。

边界 / 未做：
- **LangSmith 外部 tracing**（C1 的另一半）：需新依赖 + key + PII 去除，单独片。
- anthropic provider 未上报 usage（接口已留可选位，后续补）。
- "救场分类后又做一次工具选择"两次调用能否合并（省延迟/成本）——留作单独优化评估。
- eval 不受影响（离线 + 不走 provider）。

验证：type-check / 改动文件 eslint + Prettier / test:unit 330 / eval 13·12·3 全绿。

## [D41] Slice 10 安全分类器：医疗边界 pre-routing gate

- **Date**: 2026-06-29
- **Status**: Accepted（已落地 + 单测；服务端 telemetry，不进公开 DTO）

背景：B1 后真实模型可自由表达，疼痛/医疗边界不能再靠普通训练路由或 RAG 硬答。安全判定必须先于 `resolveRoutedIntent`、Groq 救场、工具和 RAG。

Decision：
- **独立 pre-routing gate，不扩公开 intent**：`runMockAssistantTurn` 在 session 建立后先跑 `classifyAssistantSafety`。命中后短路到 `composeMedicalSafetyAnswer`，公开响应仍为 `intent: "unsupported"`，不新增 DTO 字段。这样两端点（mock-turn / stream-turn）共享覆盖，也避免前端立刻承担新公开状态。
- **确定性 fail-safe**：规则覆盖急性疼痛、模糊疼痛/症状、红旗症状、诊断/治疗请求、用药请求。tie-break 明确保守：出现真实疼痛/症状 token 且没有“避开/避免/少安排/伤病约束/档案约束”等规划性语义 → `medical_boundary`。
- **当前/复发疼痛赢过慢性历史**：`最近/这几天/这两天/又/还是/复发/开始疼` 等当前或复发标记与疼痛并存时，旧伤/以前/老伤不会豁免；例如“膝盖以前受过伤，最近又开始疼了”会主动短路。
- **DOMS 裸酸痛不误伤**：`酸痛/酸/sore/soreness` 先按 soreness-only 处理；剥离这些词后没有其它疼痛/症状 token，且没有“越来越/加重/严重/持续/无法缓解/剧烈”等严重度标记时，不触发医疗边界。带严重度的酸痛仍走 safety。
- **慢性规划约束不误伤**：明确避开动作/加入伤病约束/少安排某类动作的表达继续走正常训练或档案能力，例如“膝盖以前受过伤，想避开深蹲”“肩旧伤，下周计划少安排推举”。
- **安全文案确定性**：模板只做共情、声明不能诊断/开药/治疗、建议急性或红旗症状优先停止训练并就医、提示急性问题处理后可把稳定伤病限制写进训练档案。不经 LLM，不编造数字。
- **服务端 telemetry 信封**：`AssistantTurnTelemetry.safety` 经 `logTurnTelemetry` 落 `assistant_turn.safety_boundary` / `safety_reason`；C1 LLM 计数完整保留，安全轮是合法的 0 LLM / 0 工具 turn。公开 `structured_output` 不带 safety。
- **回退开关默认安全**：`ASSISTANT_SAFETY_GATE` 默认 on；只有 off/false/0/no 显式关闭。空串、未设、typo 都保持开启；不复用默认 false 的 `booleanFlag`。

已知局限：
- 公开层 Phase 1 无法区分普通 unsupported 和 safety refusal；前端当前只用 unsupported 抑制 saved insights / debug 展示，因此可接受。未来如需安全样式或用户教育，可引入公开 safety 维度。
- 确定性词表会漏掉未预料的急性表述（假阴性是危险方向）。本片用保守 tie-break 和 eval 承重兜底；LLM 辅助召回可作为 Phase 2，但不能成为唯一裁决，失败时必须回到确定性结果。
- 否定式当前疼痛（如“现在不疼了，想继续练腿”）可能仍过度拒答；这是安全方向的假阳性，留待后续用更细的否定检测处理。
- 既有平台诊断里的“疼痛/伤病不是医疗建议”仍作为正常训练答案的被动免责声明；本 gate 是对用户主动报告急性/医疗边界时的主动短路，两者并存。

验证：新增 safety eval 纳入 `pnpm eval`（急性/模糊疼痛正例 + 复发疼痛中段 + DOMS/慢性约束反例）；新增分类器、编排短路、telemetry 单测。门禁结果见 progress 对应条。

## [D42] 学习闭环：上一计划依从度 opt-in 注入 next_week_plan

- **Date**: 2026-06-30
- **Status**: Accepted（已落地 + 单测；env 默认 off，零默认行为变更）

背景：Slice 5 已经能把草案接受成 planned workout，并在读取时计算 planned-vs-performed 依从度；但 `next_week_plan` 生成链路只读训练汇总 + 档案，不读上一计划依从度。产品闭环“记录→分析→计划→依从度→再计划”最后一环未闭。

Decision：
- **opt-in 开关，默认 off**：新增 `ASSISTANT_PLAN_ADHERENCE_CONTEXT`，复用默认 false 的 `booleanFlag`（仅 `1/true/on/yes` 开启），不复用 safety 的 default-on helper。原因：这是会改变计划输出的新功能，先 dogfood / A-B 对比，避免 demo/mock 流悄悄变化；验证 OK 后再考虑默认 on。
- **best-effort 上下文**：orchestrator 仅在 `next_week_plan` 路径、开关开启时读取 `getPlanAdherenceContextForPlanner`；无计划、首周、abandoned、读取失败都返回 `null`，不破坏规划。上一计划定义为最近一份 `active/completed` 且与本次 evidence window 相交的 accepted plan；`abandoned` 排除。
- **读取时计算，不新增模型**：repository 增最近 accepted overlapping plan 查询；service 用该计划自身 `start_date/end_date` 调 `getTrainingSummary`，复用 `computePlanAdherence`，映射成内部 `PlanAdherenceContext`（日期、整体比例、逐动作 done/partial/missed、planned/performed sets、上一计划 target）。
- **确定性调整规则**：先由现有 `progressionMode + profile.goal` 生成基础方案；依从度只做保守调整。`setAdherenceRatio >= 0.8` 保留 mode；`0.5~0.8` 时 `add_frequency → maintain`；`<0.5` 强制 `consolidate`。动作级：done 正常；partial 不加量（sets 不超过上一计划 sets，重量不高于上一计划 target）；missed 降一组（`max(1, min(baseSets, previousSets)-1)`）且重量不高于上一计划 target。partial/missed 且本轮 top/focus 没覆盖的动作会 carry over 到草案（focus 后、top 前，仍受 4 动作上限约束）。
- **faithfulness 不变量**：依从度派生数字（如“完成 2/4 组”）只允许留在结构化 `plan.exercises[].basis` / `plan.notes`，不写入 answer summary/bullets/recommendation/conclusion。strategy mode 变化可以反映到 answer 的无数字策略措辞（如巩固/维持/更保守），但不写依从比例或组数。
- **保守重量取舍**：partial/missed 的 target 上限使用上一计划 target；若用户实际 performed 超过 planned，v1 可能略微 under-prescribe。这里刻意偏保守，先保证“没完成就不加码”，后续若加入 performed 重量粒度再放宽。

边界 / 未做：
- 不改前端卡片、不做 day split、不新增 migration；本阶段只看最近一份计划，不做连续多周历史扫描。
- 依从度粒度仍是动作×组数，不比较 reps/重量/RPE；沿用 D26 的依从度定义。
- 默认 off 下所有现有 next-week-plan 输出应保持不变。

验证：生成器单测覆盖无上下文零回归、done 正常、partial cap、missed 降组、整体低依从强制 consolidate、低整体+missed 复合不退化；service 单测覆盖 active/completed、无计划、summary 失败上抛；orchestrator 单测覆盖默认 off 不加载、opt-in 成功注入、读取失败回退、answer prose 不泄露依从度数字。

## [D43] ENV 级 OpenAI-Compatible BYO 模型（Tier 1）

- **Date**: 2026-07-01
- **Status**: Accepted（已落地 + 单测；默认行为不变）

背景：语音 STT 当前是浏览器 Web Speech API，不调用模型 API；真正的模型接缝是两条文本 LLM seam：训练录入解析和助手（工具选择 / 意图救场 / summary phrasing）。DeepSeek、Qwen/DashScope、Kimi、智谱、OpenAI、Groq 等大多暴露 OpenAI-compatible `/chat/completions`，因此 v1 做一个 ENV 级通用 BYO 适配器，而不是为每家写平行 adapter。

Decision：
- **新增 provider**：`ASSISTANT_PROVIDER=openai_compatible` 与 `WORKOUT_INTAKE_LLM_PROVIDER=openai_compatible`。默认仍是 `mock` / 既有 Groq 行为；未知 provider 继续 `.catch("mock")`，配置错误不让 env load 崩。
- **共享 ENV 三件套**：`OPENAI_COMPAT_BASE_URL`（必须为合法 `https` URL；空/非法视为未配置）、`OPENAI_COMPAT_MODEL`、`OPENAI_COMPAT_API_KEY`。v1 限制：助手和录入解析若都选 `openai_compatible`，共享同一 endpoint/model/key；一个 seam 用 Groq、另一个用 BYO 仍可混用。
- **重命名通用 client**：`groq-chat-client.ts` / `groq-assistant-provider.ts` 泛化并重命名为 `openai-compatible-chat-client.ts` / `openai-compatible-assistant-provider.ts`。Groq 只是 preset（`https://api.groq.com/openai/v1` + `GROQ_API_KEY` + `GROQ_MODEL` 默认），BYO 是另一组 preset。
- **同一 adapter path，不旁路护栏**：Groq 和 BYO 都走同一个 OpenAI-compatible assistant provider，再经过 `provider-adapter` 的 `ensureAllowedTool`、provider fallback、faithfulness、safety、eval 体系；模型不能新增工具名，也不能绕过确定性数字生成。
- **三处助手 LLM 调用统一配置**：工具选择、意图救场、summary phrasing 都走 configured OpenAI-compatible client。`ASSISTANT_PHRASING=on` 现在可配合 `groq` 或 `openai_compatible`，仍由 runtime faithfulness 决定是否采用改写文本。
- **录入解析复用同 client**：Groq intake 不再手写 fetch/model default；`createWorkoutIntakeLlmParser("openai_compatible")` 复用通用 client，解析失败继续由 hybrid/rule fallback 兜底。
- **telemetry 诚实**：provider/model 来自实际 client result；未知 BYO 模型不在价格表时 `estimated_cost_usd: null`，不编成本数字。
- **密钥/URL 卫生**：API key 只进 Authorization header，不进 DTO/log/error；错误消息不回显 Authorization 或 key。base URL 强制 `https`，保护 key 传输。
- **失败降级**：BYO 缺配置、HTTP/shape/network 失败与 Groq 一样返回 provider error + telemetry；助手上层沿用 C1 失败 turn telemetry / fallback 路径，不硬崩、不空答。录入解析失败继续回到 hybrid/rule parser。

Tier 2 backlog（等多用户需求再做）：每用户 BYO 设置 UI + 加密密钥存储。安全门槛包括：密钥加密存储、永不回传/打日志/串户、tenant isolation、用户输入 URL 的 SSRF allowlist、限流、连接校验 UX、密钥脱敏显示和审计。

Out of scope：云端 STT、RAG embedding BYO、Anthropic 原生 schema 收编、每用户密钥 UI/DB 存储。

验证：env 单测覆盖 `openai_compatible` provider、非法/空 BYO URL 不崩；通用 client 单测覆盖 Groq preset、BYO URL/key/model、usage 宽松解析、config failure 不发 fetch；assistant provider/intent router 单测覆盖 BYO telemetry 与工具护栏路径；intake parser 单测覆盖 BYO/Groq 均走通用 client、缺 BYO 配置不发 fetch。最终门禁：type-check / 改动文件 eslint + Prettier / unit / eval。
## [D44] Slice 8 Tier 1 weekly report digests

- **Date**: 2026-07-01
- **Status**: Accepted / implemented

Background: the deterministic weekly report already exists (`getUserWeeklyTrainingReport`). Slice 8 adds proactive delivery without introducing Web Push infrastructure.

Decision:
- Tier 1 is intentionally light: Cloudflare Cron Trigger calls the Vercel API, the server generates weekly digest snapshots for active users, and the client shows a compact in-app digest when the user next opens Assistant.
- No Web Push, VAPID keys, PushManager subscription table, service-worker push handler, notification permission UX, or iOS PWA notification support is implemented in Tier 1.
- No per-user preference table/API/UI in Tier 1. Delivery is guarded by the global `WEEKLY_REPORT_DELIVERY_ENABLED` flag, default off, plus a recent-workout active-user filter. Per-user opt-in moves to Tier 2 with true notification settings.
- Cron host is the existing Cloudflare worker `scheduled()` handler. It reuses `VERCEL_API_ORIGIN` and calls `${VERCEL_API_ORIGIN}/api/cron/weekly-reports` directly with `Authorization: Bearer $WEEKLY_REPORT_CRON_SECRET`.
- The Vercel endpoint is public at the edge, so bearer validation is the security boundary. Missing, wrong, or unconfigured secrets return 401 and never echo the secret.
- Digests are idempotent by `(user_id, iso_year, iso_week)`. Re-running cron refreshes the snapshot and summary but preserves `dismissed_at`, so dismissed digests do not reappear.
- Digest title and summary are deterministic and derived only from the weekly report payload. They do not call an LLM and do not introduce numbers outside the report/range facts.
- v1 uses UTC ISO weeks. The scheduled trigger runs Monday 09:00 UTC and generates the previous Monday-Sunday UTC week. There is no user timezone setting yet, so local week boundaries are a known limitation.

Tier 2 backlog:
- Per-user opt-in/preferences, notification settings UI, Web Push VAPID secrets, push subscriptions, subscribe/unsubscribe APIs, SW `push`/`notificationclick`, permission UX, iOS installed-PWA caveat, dead-subscription cleanup, and OS-level opt-out.

## [D45] C2 RAG reranking seam + in-process Voyage reranker

- **Date**: 2026-07-01
- **Status**: Accepted / implemented

Background: hybrid vector+keyword retrieval is already in place, but candidate order can still be noisy. The safety boundary from D33 is more important than reranking quality: a reranker must never bring back chunks that failed the lexical relevance floor.

Decision:
- Add a `KnowledgeReranker` seam beside the existing repository and embedding seams. It is injectable for tests/eval and has a first in-process Voyage implementation using the existing `VOYAGE_API_KEY`.
- Keep `RAG_RERANKING_ENABLED` default off. Flag off preserves current retrieval behavior and does not call any reranker.
- When enabled, the pipeline is: widened hybrid/keyword candidates (`max(limit * 4, 10)`) -> `filterRelevantKnowledgeChunks` lexical floor -> rerank -> final topK. Rerank only sees candidates that passed the floor.
- Fail safe: missing key, unavailable reranker, timeout, bad response, empty rerank result, or thrown error returns the lexical-floor candidate order. It never returns unrelated chunks and never makes retrieval fail.
- Voyage uses `/v1/rerank`, `rerank-2.5-lite`, `return_documents:false`, `truncation:true`, and topK equal to the requested final limit. The historical `voyage-embedding-client.ts` module now covers both embeddings and rerank to avoid a rename-only churn.
- Observability is server-only: `retrieval_mode:"reranked"` on success, original mode on fallback, and safe rerank metadata (`status/model/candidate_count/total_tokens/estimated_cost_usd:null/fallback_reason`) in retrieval logs. Raw query, raw documents, API keys, and public answer DTOs stay unchanged.
- Eval stays deterministic. RAG eval metrics now include top1, top3, MRR, and expected-source rank. When rerank comparison is enabled, it injects a fixture reranker; CI/gate eval does not hit live Voyage. Live Voyage quality checks are manual opt-in only.

Out of scope:
- Python/FastAPI reranker microservice, LangSmith, embedding/ingestion changes, corpus edits, public DTO changes, and live Voyage eval as a regression gate.

## [D46] hardening-1 T2 LLM chat completion timeout

- **Date**: 2026-07-05
- **Status**: Accepted / implemented

Background: the shared OpenAI-compatible chat client had no abort signal, so a hung provider could consume the full serverless execution window. This client is used by both assistant calls and workout-intake LLM parsing.

Decision:
- Add `CHAT_COMPLETION_TIMEOUT_MS = 20_000` in the shared base client and apply it as the default inside `runOpenAiCompatibleChatCompletion(request, config, options = {})`. The timeout is not only in the assistant wrapper, so direct intake-parser calls inherit the same protection.
- Use `AbortController.signal` for every fetch and clear the timer in `finally` for success, HTTP failure, unexpected response shape, body parse fallback, and thrown fetch paths.
- Timeout/abort returns the existing normalized failure shape: `attempted:true`, `ok:false`, `status:0`, actual `provider/model`, and a sanitized message containing `timeout`. Non-timeout network errors preserve their original `error.message`.
- Chat completion uses 20s, not the RAG rerank 2s timeout, because full chat generation and tool-selection requests commonly take seconds to tens of seconds, while Voyage rerank is a small ranking request with a narrow latency budget.
- Workout-intake retry interaction: timeout returns `status:0`, so it fails fast and does not trigger the existing `status === 429` retry. Only a real 429 quick response waits 2s and retries once; the worst expected intake hang is about `429 fast response + 2s wait + 20s second attempt ~= 22s`.
- `vercel.json` currently has no `functions.maxDuration`. The platform function timeout may still beat the app-level 20s timeout. Raising maxDuration is a future explicit deployment-config batch, not part of T2.
- Boundary: the timeout budget covers the fetch connection, request, and response headers. These calls are non-streaming, so the body normally follows immediately, but the response-body read phase is not separately covered by this fetch-level timeout.

Out of scope:
- Provider-specific timeout tuning, user-visible copy changes, retry-policy changes, `vercel.json` changes, and new telemetry fields.

## [D47] hardening-1 T3 auth endpoint rate limiting

- **Date**: 2026-07-05
- **Status**: Accepted / implemented

Background: register and login were public write endpoints without endpoint-specific throttling. They needed deterministic, zero-network protection before controller execution while preserving existing logout/me behavior.

Decision:
- Add auth route middleware built on the existing fixed-window `createAiRateLimiter` string-key seam. The auth key is `req.ip` plus a fixed route key, so register and login buckets are independent.
- Limits are `POST /api/auth/login = 10/min/IP` and `POST /api/auth/register = 5/min/IP`.
- Blocked requests throw the existing API error shape: `429 RATE_LIMITED` with `error.details.retry_after_seconds`.
- Mount only on `POST /api/auth/register` and `POST /api/auth/login`, before auth controllers. `POST /api/auth/logout` and `GET /api/auth/me` remain unaffected.
- `createApp()` sets `trust proxy` to `1`. On Vercel this trusts the single platform proxy hop so Express derives `req.ip` from the real client-facing forwarded address, without trusting the full leftmost `X-Forwarded-For` chain.
- Tests inject limiter state and clock. App characterization tests use an injected wide limiter so module-level default limiter state cannot accumulate across test cases.

Known boundaries:
- Cloudflare Worker -> Vercel proxy paths can collapse users that traverse the Worker into the Worker egress IP bucket. That is acceptable at the current scale, but it is a documented risk.
- The limiter is in-memory and per serverless instance, so it is partial protection in distributed/serverless deployments. A distributed DB/Redis-backed limiter is a roadmap follow-up.

Review note:
- `trust proxy = 1` is intentionally narrower than trusting all forwarded hops. It accepts the nearest trusted Vercel proxy hop and reduces spoofing exposure from arbitrary leftmost XFF values, but it still depends on Vercel being the direct public ingress. If another proxy tier becomes authoritative, this setting must be revisited with that topology.

Out of scope:
- Global 60/min/IP limiting, Redis/DB counters, Cloudflare edge rate limiting, CAPTCHA, account lockout, and user-visible copy localization.

## [D48] AR-0 provider-error deterministic fallback

- **Date**: 2026-07-05
- **Status**: Accepted / implemented

Background: the OpenAI-compatible assistant provider already normalized provider failures, but the orchestrator still turned them into `502 AI_PROVIDER_ERROR` turns. That made a missing key or provider outage user-visible and caused SSE to terminate with `error`, even though the same intent had a deterministic default-tool path available.

Decision:
- Treat four normalized failure classes as provider errors at the fallback boundary: missing or unusable provider configuration; provider HTTP errors; timeout/abort failures normalized with `status:0`; and malformed or unexpected provider response shapes.
- Use one of two deterministic completion paths. When all required default-tool arguments are available, synthesize the default tool call, execute the real FitMind tool, assemble the evidence-bound answer, and run faithfulness validation. When a required argument is missing, do not invent it or call the tool; return the deterministic guidance message that asks for the missing input. Both paths persist a normal structured response and emit SSE `done`, never `error` merely because the provider failed.
- Preserve an explicit server-side telemetry marker set on every provider-error fallback: `provider_error_fallback:true`, the original `provider_error_code`, the adapter-sanitized `provider_error_message_sanitized`, `fallback_provider:"mock"`, and `fallback_reason:"provider_error"`. Normal traffic logs `provider_error_fallback:false` and the other four fields as `null`, so provider fallback rate is independently monitorable and cannot be confused with ordinary mock-mode traffic.
- Skip optional LLM answer phrasing whenever provider-error fallback is active. A failed routing provider must not trigger another provider call; the fallback answer remains deterministic.
- Keep the public DTO unchanged. Fallback details stay in the internal turn telemetry / `assistant_turn` log and are not added to `MockAssistantTurnResponseData`, `structured_output`, or other client contracts.

Remaining boundaries:
- This is a safety net, not evidence that DeepSeek is healthy. Before AR-2 changes production provider settings, run a local live DeepSeek conversation and live validation against the real provider; deterministic unit/eval coverage alone is insufficient.
- `provider_error_status` is not yet carried as an independent numeric structured telemetry field. If operations need status-based aggregation distinct from the sanitized message and provider error code, add that explicit numeric pass-through in a separately reviewed change; this remains the AR-0b review backlog.
- Provider outages can still consume the configured provider timeout before fallback completes. Timeout tuning remains a separate deployment/runtime decision.

## [D49] AR-1 cost and abuse guardrail policy

- **Date**: 2026-07-11
- **Status**: Accepted / implemented; AR-1a through AR-1d complete

Background: the existing per-user AI limiter does not bound real-provider spend
for a whole server instance, and cheap account creation can bypass a user-only
abuse boundary. AR-1 adds an always-on wallet policy before AR-2 can make an
OpenAI-compatible provider the public default.

Decision:

- The emergency flag is `ASSISTANT_REAL_PROVIDER_KILL_SWITCH`. **Unset means
  live-provider calls remain eligible.** Explicit true tokens (`1`, `true`,
  `on`, `yes`, case-insensitive) engage the switch. Explicit false tokens (`0`,
  `false`, `off`, `no`) leave calls eligible. Blank, malformed, or otherwise
  uncertain values engage the switch and force deterministic mock fallback.
  This is intentionally different from budget parsing: the kill-switch is a
  normally-unset emergency stop, so AR-2 only needs
  `ASSISTANT_PROVIDER=openai_compatible` plus valid provider configuration to go
  live.
- Wallet budgets are always enabled. Missing or malformed
  `ASSISTANT_REAL_PROVIDER_DAILY_CALL_BUDGET` and
  `ASSISTANT_REAL_PROVIDER_DAILY_COST_BUDGET_USD` fall back to `500` calls and
  `$1.00` respectively; invalid values never mean unlimited spend.
- Per-instance call and cost counters reset at UTC midnight. The implementation
  remains in-memory and per-process for the AR-1 MVP. The call counter reuses
  the existing `createAiRateLimiter` string-key seam with
  `ai:instance:real-provider:calls`; no Redis or DB counter is introduced.
- Call count is the pricing-independent hard floor. Every allowed real-provider
  attempt consumes one call before provider execution. Known estimated cost is
  recorded after usage is available and blocks the next attempt once accrued
  daily cost reaches the limit. `estimated_cost_usd:null` does not advance the
  cost counter, but it never disables the call budget or the later per-IP cap.
- Every routing, tool-selection, and phrasing provider attempt must pass the
  guard independently. A later call cannot reuse an earlier allow decision or
  bypass budget already consumed by the same turn.
- AR-1d mounts the assistant turn routes in the fixed order
  `auth -> per-user limiter -> per-IP limiter -> controller`. Saved-insight and
  other assistant routes that do not call a provider do not consume the per-IP
  allowance. The per-IP guard is turn-scoped: a fallback decision locks the
  whole turn before any real routing, tool-selection, or phrasing call and does
  not consult or consume the per-instance guard.
- The per-IP limiter consumes once at HTTP entry for every request that is
  eligible for a real configured provider. This intentionally includes turns
  that later finish through a purely deterministic path, the safety short
  circuit, or another early return. Therefore
  `budget_fallback:true, budget_scope:"ip"` means **the IP was over its
  allowance when that turn reached the entry guard**; it does not claim that a
  specific paid provider call would otherwise have occurred or was blocked.
  This conservative turn-level accounting is the deliberate public-demo abuse
  boundary.
- After an IP allow, the per-instance guard is call-scoped and runs separately
  immediately before each real routing, tool-selection, and phrasing call. The
  first instance denial locks the remaining turn, so later call sites neither
  re-check/re-consume the instance counter nor create a second user-visible
  fallback. This separates one IP count per eligible turn from one instance
  count per allowed real-provider call.
- Both guard layers reuse D48/AR-0's deterministic default-tool or
  missing-argument guidance core. Budget fallback does not fabricate a provider
  error, persists the normal success-shaped response, and completes SSE with
  `done` rather than a billing `429` or `error`.
- After each provider call returns, AR-1d prices that call from its actual
  model/usage telemetry and passes the known estimate or `null` to
  `recordCost`. Provider failures that return usage are still recorded; unknown
  pricing leaves the cost counter unchanged while the already-consumed call
  count remains effective.
- Turn telemetry and the structured `assistant_turn` log expose independent
  budget fields (`budget_fallback`, `budget_reason`,
  `budget_scope:"instance"|"ip"`, plus nullable scope-specific counters).
  They coexist with D48's `provider_error_fallback` fields without overwriting
  them. Normal traffic records `budget_fallback:false` with all other budget
  fields `null`. No public DTO field is introduced.
- With `ASSISTANT_PROVIDER=mock`, the IP middleware consumes nothing and the
  orchestrator bypasses the instance guard and cost recorder. AR-1d therefore
  changes no default production behavior; the guards become active when AR-2
  selects a reviewed real provider.

Remaining boundaries:

- The per-IP middleware uses `getConfiguredAssistantProvider()`, consumes quota
  only for real-provider-eligible turns, records its allow/fallback decision in
  response locals, and never returns a public 429. Both JSON and SSE controllers
  pass that same request-scoped decision into the orchestrator.
- The `30/day` per-IP cap is the effective daily ceiling for a user whose
  requests come from one IP, even though the existing per-user quota remains
  `50/day`. Multiple users behind the same NAT share that 30-request allowance;
  this conservative aggregation is an intentional public-demo tradeoff and a
  known boundary, not exact per-person accounting. Current assistant endpoints
  authenticate before AI limiting, so unauthenticated requests return 401 and
  do not consume the IP allowance; the IP layer prevents account churn from
  multiplying paid-call eligibility behind one address.
- AR-1b creates one default guard and counter when its module loads. All future
  request and provider call sites must reuse that process-level singleton;
  rebuilding it per request would reset accounting and defeat the guard. A
  factory remains available only for isolated test injection.
- Because the default policy is parsed from `process.env` once at module load,
  kill-switch and budget threshold changes require a process restart to take
  effect. On Vercel that means an environment change followed by redeployment;
  the kill-switch is not a no-redeploy, real-time stop for already-running
  instances. This is an accepted constraint of the per-instance MVP.
- A priced call can take accrued spend slightly above the limit because actual
  usage-based estimated cost is known only after the call completes. The next
  real-provider attempt is blocked. Call-count and per-IP caps remain the
  pre-request hard bounds.
- Serverless instances each maintain their own call/cost and IP counters, so
  limits are partial rather than globally exact across warm instances. NAT and
  proxy egress can also aggregate unrelated users into one IP bucket.
  Distributed exact accounting, edge limiting, CAPTCHA, and reputation remain
  backlog items.
