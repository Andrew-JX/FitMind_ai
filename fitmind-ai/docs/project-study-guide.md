# FitMind AI 项目学习指南

## 1. 一句话定位

FitMind AI 是一个以证据为基础的 AI 训练分析系统，将真实训练日志、确定性计算工具、Tool Calling、SSE 流式传输和移动优先的 React 助手 UI 串联为一条完整链路。

## 2. 简历标题

**FitMind AI - 以证据为基础的训练分析助手**

## 3. 项目是什么 / 不是什么

### 是

- 带用户认证数据的训练记录系统。
- 用于训练总览、动作进展和推荐上下文的确定性计算层。
- 具有后端工具执行器和 provider adapter 边界的受控 Tool Calling 架构。
- 基于 SSE 的助手流式传输流程，前端有助手状态机。
- 移动优先的中文 React UI，呈现以证据为基础的分析和助手回答。

### 不是

- 通用聊天机器人。
- RAG 系统。
- MCP 系统。
- 多工具 agent 循环。
- 医疗建议系统。
- 生产级健身教练系统。

## 4. 简历三句话版本

- 构建了一个以证据为基础的 AI 训练分析系统，将训练日志、确定性分析、Tool Calling、SSE 流式传输和移动优先 React 界面整合为一条完整链路。
- 设计了后端计算层，以可追溯的证据（而非依赖 LLM 直接推断）计算训练总览、动作进展和推荐上下文。
- 实现了受控 assistant 架构，包含工具参数校验、provider 抽象和前端流式状态管理，以降低幻觉风险并提升可解释性。

## 5. 简历四句话技术版本

- 用 React、TypeScript、Vite、Node.js、Express、PostgreSQL、Zod、JWT 和 SSE 构建了全栈训练分析产品。
- 实现了确定性后端服务，用于训练总览、动作进展和推荐上下文，并附带 `workout_ids`、`set_ids`、`calculation_rules` 等证据字段。
- 构建了受控 Tool Calling 路径，包含 Zod 参数校验、服务端持有的认证上下文、工具执行日志记录，以及支持 `mock` 和 Anthropic 路径集成的 provider adapter。
- 完成了 SSE 驱动的助手体验，包含明确的生命周期事件、增量答案渲染、会话连续性，以及用于训练、分析和助手工作流的移动优先中文 UI。

## 6. 架构概述

高层链路如下：

React 客户端  
-> API 客户端  
-> Express 路由/控制器  
-> 服务层  
-> 仓库层  
-> PostgreSQL  
-> 确定性工具  
-> assistant 编排器 / provider adapter  
-> SSE 流  
-> 前端 assistant 状态机

重要的架构要点是：数据访问、确定性计算、工具执行、provider 集成和流式 UX 是分离的，不是全部混在一个聊天接口里。

## 7. 核心数据流

核心产品流程如下：

训练日志  
-> 存储的训练和组数  
-> 确定性总览 / 进展 / 推荐上下文 API  
-> 封装这些确定性能力的内部工具  
-> 可以调用这些工具的助手流  
-> 前端状态机和答案渲染

这意味着 AI 层不是直接对原始训练表进行推断，而是在已经有边界、可追溯的后端结构化输出上工作。

## 8. 核心模块

### 训练日志模块

- 支持训练 CRUD，包括创建、列表、详情和删除流程。
- 支持带动作选择、次数、重量、RPE、热身和备注的组记录。
- 提交前在客户端按 `exercise_id` 分组处理 `set_index` 逻辑。
- 创建/删除后刷新训练列表、总览、推荐上下文和已选动作进展。
- 将认证 token 保存在前端内存中，不写入 `localStorage`、`sessionStorage` 或 cookie。

### 确定性计算层

这是项目最重要的信任基础。

当前能力：

- `training summary`（训练总览）
- `exercise progress`（动作进展）
- `recommendation context`（推荐上下文）

重要性：

- 数字结果来自确定性后端逻辑，而非模型推断。
- 响应包含 `workout_ids`、`set_ids`、`calculation_rules` 等证据字段。
- 日期输入使用 `YYYY-MM-DD`，内部采用半开区间过滤（`performed_at >= start_date` 且 `performed_at < end_date + 1 day`），避免当天结束的差一错误，同时保持用户的日历心理模型。
- `estimated_1rm_kg` 使用 Epley 公式（`weight × (1 + reps / 30)`）作为近似训练信号，不构成医疗建议，不是保证的真实最大值。

### 工具执行器

- 注册受控的内部工具白名单。
- 执行前用 Zod 校验工具输入参数。
- 不接受工具参数中的 `user_id`。
- 始终从已认证的后端上下文中派生 `userId`。
- 记录工具执行元数据（user_id、工具名、脱敏参数、状态、耗时），不暴露密钥或原始 provider 载荷。

当前内部工具：

- `get_training_summary`
- `get_exercise_progress`
- `get_recommendation_context`

### Provider Adapter

provider adapter 不让模型直接拥有系统权限，而是将 provider 置于受控边界之后。

当前状态：

- 支持 `mock` provider。
- 支持 Anthropic provider adapter 路径。
- 使用 `ASSISTANT_PROVIDER` 进行切换。
- 将 provider SDK 细节隔离在控制器之外。
- 真实 provider 路径目前仍是非流式 provider 调用。

Provider 输出规范化为：

- `message`
- `tool_call`
- `error`

Provider 不直接查询数据库、不绕过工具执行器、不决定用户所有权。

### SSE 助手流

当前 SSE 事件序列包括：

- `state`
- `provider_selected`
- `tool_call_started`
- `tool_call_finished`
- `answer_delta`
- `session`
- `done`
- `error`

SSE 的重要性：

- 用户可以看到请求已被接受。
- UI 可以显示系统是在思考、调用工具还是在回答。
- 前端可以增量渲染 `answer_delta`。
- 流程更易于演示，也更易于在面试中解释。

### 前端助手状态机

当前前端助手状态：

- `idle`（空闲）
- `thinking`（思考中）
- `tool_calling`（调用工具中）
- `answering`（回答中）
- `done`（完成）
- `error`（错误）

前端职责：

- 从 `answer_delta` 增量渲染答案。
- 根据 SSE 生命周期事件显示当前活动工具调用。
- 展示已选择的 provider。
- 复用后端的 `sessionId`。
- 支持重试、停止和清空对话行为。

## 9. UI 设计

当前 UI 可以用三个中文产品 Tab 来描述：

- `训练`：训练记录、训练历史和基础统计。
- `分析`：确定性分析和证据预览。
- `AI 助手`：基于工具的助手解释，带 SSE 流式传输。

设计特点：

- 中文 UI。
- 移动优先的工作台设计。
- 产品化的卡片、标签和状态面板，不是纯调试界面。

## 10. 安全与边界设计

本节在面试中很重要，因为它解释了项目如何限制幻觉和数据泄露风险。

当前边界：

- 认证中间件拥有鉴权权限。
- 前端 token 保存在内存中。
- `user_id` 不接受来自前端或模型的输入。
- Zod 校验约束工具参数。
- 工具白名单限制可执行内容。
- UI 不暴露密钥或原始 provider 载荷。
- 模型被视为受约束的语言层，而非系统拥有者。

## 11. 当前限制

这些边界应如实说明：

- 无 RAG。
- 无 MCP。
- 无多工具 agent 循环。
- 无真实 Anthropic token 级流式传输。
- 工具执行后无第二次 provider 调用。
- 无已完成的浏览器 E2E 测试。
- 推荐上下文是确定性预览，不构成医疗建议。

当前系统是一条 AI 应用链路，但仍然是受控的单轮、单工具优先 assistant，而非完整的 agent 系统。

## 12. 30秒中文介绍

FitMind AI 不是一个通用聊天机器人，而是一个围绕真实训练日志构建的 AI 训练分析系统。它先通过 workout CRUD 把用户训练数据结构化存下来，再由后端 deterministic calculation layer 计算训练总览、动作进展和 recommendation context，并附带 evidence。然后这些能力被包装成内部 tools，由 tool executor 和 provider adapter 控制调用边界，最后通过 SSE 把 assistant 状态和回答流式推给前端。这个项目的重点不是让模型自由发挥，而是让 AI 回答建立在可验证、可追溯的训练数据之上。

## 13. 60秒中文介绍

FitMind AI 的核心不是"做一个聊天框"，而是先把训练分析这件事拆成可信的工程链路。底层先有 workout CRUD，把用户真实训练记录写入数据库；然后 deterministic calculation layer 负责训练总览、单动作进展和 recommendation context，这些结果都带 evidence，比如 `workout_ids`、`set_ids` 和 `calculation_rules`。接着这些确定性能力被封装成内部 tools，由 tool executor 做参数校验和安全执行，`user_id` 只能来自认证上下文，不能从前端或模型注入。模型层被放在 provider adapter 后面，目前支持 mock provider 和 Anthropic path，但真实 provider 仍然不能直接查数据库。最后后端通过 SSE 把 `thinking`、`tool_calling`、`answering`、`done` 这些状态流式推给前端，前端再用状态机和增量渲染把整个 AI 回答过程展示出来。所以这个项目强调的是 deterministic data、tool boundary 和 streaming UX，而不是一个无边界的 AI agent。

## 14. 两分钟技术深度讲解

如果从技术链路讲，两分钟可以这样说：

FitMind AI 先从真实训练日志出发，而不是从 LLM prompt 出发。第一层是训练记录系统，包含认证、workout CRUD、动作搜索和 set 编辑，保证数据源是真实用户训练行为。第二层是 deterministic calculation layer，它把训练总览、动作进展和 recommendation context 做成独立后端能力，所有关键数字都来自后端计算而不是模型推断，同时返回 evidence 字段，方便追溯结果来自哪些 workout、哪些 set、用了什么 calculation rules。

第三层是 Tool Calling 架构。我们没有让模型直接访问数据库，而是先把这些确定性能力包装成受控 tools，再通过 tool executor 做 Zod 参数校验、工具白名单控制和执行日志记录。这里一个很关键的边界是 `user_id` 永远来自认证上下文，工具参数本身不允许带 `user_id`，这样可以避免跨用户数据泄露风险。

第四层是 provider adapter 和 assistant orchestration。assistant 请求进入后，后端先决定 provider 路径，再由 provider 返回规范化的 `message`、`tool_call` 或 `error`。当前已经有 mock provider，也有 Anthropic adapter path，但还没有 real token-by-token streaming，也没有 tool 执行后的第二次 provider call。第五层是 SSE streaming UX，后端会发 `state`、`provider_selected`、`tool_call_started`、`tool_call_finished`、`answer_delta`、`session`、`done`、`error` 这些事件，前端用状态机和增量渲染把 assistant 过程展示出来。

所以这个项目真正证明的不是"我接了一个模型 API"，而是我把训练数据、确定性计算、工具边界、provider abstraction 和前端流式交互串成了一条可解释、可验证、可演示的 AI application chain。

## 15. 面试问答

### Q1. 为什么不把原始训练数据直接放进 prompt？

原始训练表不是最适合模型处理的抽象层。如果把原始训练和组数全部塞进 prompt，模型就必须自己决定如何聚合、如何过滤日期、哪些动作重要——这既浪费 token，也增加幻觉风险。更好的设计是让后端先生成确定性的总览、进展和上下文，再让模型解释这些稳定的结果。

### Q2. 为什么要做确定性计算层？

核心训练指标应该是可复现、可测试、可追溯的，不依赖模型行为。这让用户有更高的信任感，也让系统更容易调试。在这个设计里，模型是解释层，而不是数据来源。

### Q3. 为什么要用 Tool Calling？

Tool Calling 约束模型只能请求受控的后端能力，而不是直接查数据库或自己发明聚合逻辑。这让边界清晰，也让系统更容易扩展到其他 provider。

### Q4. 为什么 `user_id` 必须来自认证上下文？

用户所有权的权威性必须保留在服务端。如果允许 `user_id` 从前端或模型传入，系统就会有跨用户数据泄露的风险。在当前设计里，`user_id` 始终来自认证中间件，工具 schema 不接受它作为输入。

具体保护：`user_id` 只来自认证中间件；客户端和 provider 都不传递 `user_id`；工具 schema 不接受 `user_id`；在 assistant 消息持久化或流复用之前检查 session 所有权；确定性服务仍然按认证用户上下文过滤。

### Q5. 为什么用 SSE？

单个阻塞式 HTTP 响应会让 AI UX 感觉不透明。SSE 让前端可以显示 `thinking`、`tool_calling`、`answering`、`done`，改善用户理解，也让 assistant 链路更容易演示。用户能区分：系统在思考、工具调用还在运行、答案正在生成、还是请求卡住或失败了。

### Q6. 为什么要有 provider adapter？

Provider SDK 细节属于基础设施，不属于控制器或核心产品流程。adapter 让系统先定义自己的请求和响应契约，再把不同 provider 插入该边界之后。切换 provider 不需要重写控制器；provider 失败在到达路由/控制器层之前就已经规范化。

### Q7. 前端状态机怎么工作？

前端发送 `POST /api/assistant/stream-turn`，消费 SSE 事件，从 `state` 更新状态，从 `tool_call_started` 和 `tool_call_finished` 更新当前活动工具卡片，从 `answer_delta` 追加助手文本，从 `session` 和 `done` 保持会话连续性。`error` 会把 UI 切换到失败状态。前端还跟踪活动工具调用、逐步追加流式回答、支持停止和重试、为后续轮次保留 `session_id`。

### Q8. 如何降低幻觉风险？

项目并不宣称完全消除幻觉。它通过确定性计算、工具白名单、校验后的工具参数、服务端持有的用户身份，以及以证据为基础的结构化输出（而非原始 prompt 即兴发挥）来压缩风险。

### Q9. 这个项目里的"证据"是什么？

证据是结果或回答的可追溯支撑，比如 `workout_ids`、`set_ids`、`calculation_rules`，以及工具调用元数据。它把一条回答从"一个陈述"变成"一个可以追溯回具体训练和计算规则的陈述"。

### Q10. 下一步你会做什么改进？

最合理的后续步骤：

- 加入真实的 provider 流式传输路径。
- 加入工具执行后的第二次 provider 调用，使模型可以将工具输出转化为 provider 生成的最终答案。
- 在同一个受控架构内加入有边界的多步工具循环。
- 改善聊天历史和 session 浏览。

只有在以上核心边界稳定之后，才会评估 RAG、MCP 或更多类 agent 工作流这类更大的扩展。每个下一步都应该保留围绕确定性数据、认证范围执行和证据可见性的现有边界。

---

## 16. 按阶段讲法（Phase-by-Phase 面试讲稿）

这一节是每个构建阶段的独立讲法，适合面试官问"这个模块是怎么做出来的"时按阶段展开。

---

### 16.1 Phase 1 — 训练日志 CRUD

#### 这一阶段的价值

Phase 1 建立了基础产品闭环：注册和登录、纯内存 MVP 认证、搜索和选择动作、创建带组数的训练、浏览训练列表和详情、删除训练。

Phase 1 的价值不在于 CRUD 本身。价值在于产品现在拥有了真实的用户训练数据，并有清晰的用户边界。没有这一层，后面的 summary、progress 和 AI explanation 都没有可信基础。

---

### 16.2 Phase 2 — 确定性计算层

#### 这一阶段的价值

Phase 2 在不改变训练 CRUD 契约或数据库 schema 的前提下，新增了确定性只读计算 API。

**`GET /api/training/summary`** 回答：
- 某个时间范围内有多少次训练、多少组、累计了多少次数和总训练量
- 哪些动作贡献了最多训练量

**`GET /api/training/exercise-progress`** 回答：
- 某个动作出现在多少次训练中，包含多少组
- 该动作的总次数、总训练量、观测到的最大重量
- 近似估算的最大单次力量（1RM），以及按训练场次的汇总数据

#### 设计细节——为什么 Phase 2 面板是只读的

Phase 2 前端面板有意设计为只读。重点是计算正确性和稳定显示，而非复杂的分析 UI。这使职责清晰：后端拥有计算逻辑，前端拥有只读渲染和刷新行为，数据修改仍然通过训练 CRUD 进行。

---

### 16.3 Phase 2.1 — 推荐上下文构建器

#### 这一阶段做了什么

推荐上下文构建器是 Phase 2.1 的核心。它不是 AI 推荐功能，而是一个确定性的后端上下文包构建器，用于为未来的 Tool Calling 或 LLM 解释预先组装结构化上下文。

上下文包当前包含：`summary`（总览）、`focus_exercises`（重点动作）、`recent_workouts`（最近训练）、`evidence`（证据）。

#### 为什么在 AI 聊天之前先构建上下文

如果推荐上下文不先存在，未来的 LLM 就需要自己决定读哪些表、如何聚合、哪些训练重要、如何解释时间范围边界——这使系统更难测试、更难审计、更容易幻觉。Phase 2.1 在引入任何模型层之前消除了这种歧义。

清晰的层次划分：
- **原始日志**：原始的 `workouts` 和 `sets` 事实
- **计算端点**：对一个具体问题的确定性回答
- **推荐上下文**：将多个确定性输出组合成一个可解释上下文对象的确定性后端包
- **未来 LLM 解释**：在该包之上的语言层解释，而非确定性层的替代品

#### 30秒讲法

"Phase 2.1 我做的不是 AI 推荐生成，而是 Recommendation Context Builder。它新增了一个后端 API，把某个日期范围内的总训练量、重点动作进展、最近 workout 摘要、evidence 和 calculation rules 组装成一个结构化 context package。它是确定性的，不调 LLM，不生成建议，主要目的是为未来 Tool Calling 和 AI 解释提供一个已经整理好、可验证、可回溯的后端上下文。"

#### Phase-specific Q&A

**Q: 为什么在 Tool Calling 之前先构建上下文？**

第一个问题不是"模型能调工具吗？"第一个问题是"在模型说任何话之前，应该存在什么精确的后端上下文？"推荐上下文构建器首先锁定了这一点。如果提供商集成先到来，模型行为就会与未完成的后端编排决策混在一起，让系统更难测试、更难解释。

**Q: 为什么不让 LLM 直接查询所有表？**

那会把数据访问、聚合逻辑、计算规则和语言生成混在一起，让系统更难测试、更难审计，更容易跨用户泄露或产生幻觉。

---

### 16.4 Phase 3.0 — Tool Calling 骨架

#### 这一阶段做了什么

Phase 3.0 新增了一个 Tool Calling 骨架，但它仍然是后端架构步骤，而不是完成的 AI 能力。工具层是内部后端基础设施，还不是真正的聊天产品、不是模型集成，也不是面向用户的 Tool Calling 体验。

工具执行时的 `user_id` 来自认证上下文，不允许从参数里传，参数也会先做 Zod 校验。这样未来无论接哪个模型 provider，模型调用的都是一层已经稳定、可测试、可审计的内部工具接口，而不是直接碰数据库。

#### 为什么 provider 无关的工具层在真实模型集成之前

这个顺序很重要，因为它首先锁定了困难的后端决策：工具名称和输入契约在引入任何模型 SDK 之前就变得稳定；确定性行为可以在不归咎于模型行为的情况下进行测试；用户隔离和参数验证在允许模型请求任何内容之前就已解决。

#### 30秒讲法

"Phase 3.0 我做的不是把大模型真正接进来，而是先把 Tool Calling 的后端骨架搭好。现在后端已经有三个内部工具：训练总览、单动作进展、推荐上下文。它们本质上都是对现有确定性服务的包装，不调 LLM，不做聊天，也不生成建议。工具执行时的 user_id 来自认证上下文，不允许从参数里传，参数也会先校验。这样未来无论接哪个模型提供商，模型调用的都是一层已经稳定、可测试、可审计的内部工具接口，而不是直接碰数据库。"

#### Phase-specific Q&A

**Q: 为什么不让模型直接调用数据库？**

那会把数据访问、权限边界、聚合规则和语言生成混在一起，让系统更难测试、更难审计、更容易跨用户泄露，更容易幻觉——因为模型要同时决定查什么和如何解释它。

**Q: 为什么要验证工具参数？**

模型生成的或调用者提供的工具输入默认不可信。验证确保工具只接收预期的字段和格式，比如 `YYYY-MM-DD` 日期和有效的 `exercise_id`。这在允许未来 provider 集成之前同时保护了正确性和安全性。

**Q: `tool_call_logs` 中记录什么？**

后端记录执行元数据：认证的 `user_id`、工具名称、脱敏的输入参数、执行状态、持续时间、以及支持时的紧凑错误或输出元数据。重要的访谈点不是精确的存储格式，而是工具执行可以被观察和审计，不依赖模型层。

---

### 16.5 Phase 3.1 — Assistant 编排骨架

#### 这一阶段做了什么

Phase 3.1 新增了 assistant 编排骨架。后端现在有一个 `POST /api/assistant/mock-turn`，但它不是真正的 AI 对话，也不调大模型。它是一个确定性的 assistant 层：先根据 mode 选择要调的内部 tool，然后再用模板化方式把工具结果组装成 assistant 响应。如果提供 `session_id`，还会把 user message 和 assistant message 存到 `chat_sessions` 和 `messages` 表里。

这个阶段的目标不是生成 AI 回答，而是先把 assistant 的后端编排、证据返回、会话持久化这些基础能力做稳。

#### 为什么在真实 LLM 之前使用确定性模拟

第一个问题不是模型能否自然地说话，而是后端 assistant 工作流是否正确：请求是否正确验证、是否选择了正确的内部工具路径、用户隔离是否得到保持、证据是否携带进了响应、轮次是否可以安全持久化。确定性模拟行为让你可以验证这些决策，而不必归咎于或依赖模型行为。

层次区分：
- **工具执行器**：低层内部后端层，验证工具参数并运行一个具名的确定性工具
- **assistant 编排器**：高层后端层，接受 assistant 风格的请求，按模式选择工具路径，格式化确定性答案，并可选地持久化聊天消息
- **模型 provider**：未来的外部 LLM 依赖，将决定或帮助决定调用哪些工具以及如何生成最终语言
- **未来流式聊天**：未来面向用户的交互模型，将添加 token/chunk 流式传输、中间状态转换和多步工具/模型循环

#### 30秒讲法

"Phase 3.1 我做的是 Assistant Orchestration Skeleton。后端现在有一个 `POST /api/assistant/mock-turn`，但它不是真正的 AI 对话，也不调大模型。它是一个确定性的 assistant 层：先根据 mode 选择要调的内部 tool，比如训练总览、单动作进展、推荐上下文，然后再用模板化方式把工具结构组装成 assistant 回应。如果提供 session_id，还会把 user message 和 assistant message 存到 `chat_sessions` 和 `messages` 表里。这个阶段的目标不是生成 AI 回答，而是先把 assistant 的后端编排、证据返回、会话持久化这些基础能力做稳。"

#### Phase-specific Q&A

**Q: 这一阶段证明了什么？**

证明后端已经可以支持 assistant 形状的产品工作流：一个经过认证的 assistant 端点存在、内部工具可以在该端点后面被编排、工具结果可以转化为 assistant 风格的摘要和证据、可选的聊天 session/消息持久化可以捕获轮次历史。

**Q: 真实模型集成后如何替换模拟选择？**

后来，确定性模式切换可以被 provider 支持的编排路径替换：请求仍然通过产品自有的 assistant 接口进入；认证上下文和验证规则仍然保留在后端；未来模型层可以决定调用哪个内部工具；同一个执行器仍然可以安全运行这些工具；最终模型响应可以替换今天的模板响应，同时保持证据和持久化期望不变。关键架构点是真实模型集成应该只替换选择和语言层，而不是确定性数据、验证或所有权边界。

---

### 16.6 Phase 3.2 — Provider Adapter

#### 这一阶段做了什么

Phase 3.2 是后端从只是确定性模拟 assistant 停止，开始证明真实 provider 可以插入而不放弃后端控制的时刻。

现在后端可以通过 `ASSISTANT_PROVIDER` 在 `mock` 和 `anthropic` 之间切换，assistant orchestrator 仍然负责验证请求、决定允许哪些内部工具、执行工具、组装最终响应、以及持久化消息。Provider 本身只能返回 `message`、`tool_call` 或 `error` 这三种规范化结果，不能直接查库，也不能绕过 tool executor。

重要的是 provider 集成不等于"AI 聊天完成了"。它只是证明编排契约足够强大，可以接受真实模型依赖，而不破坏用户隔离或工具边界。

#### 30秒讲法

"Phase 3.2 我做的是把真实 model provider 通过 Provider Adapter 接进后端，但不是直接做成聊天产品。现在后端可以通过 `ASSISTANT_PROVIDER` 在 `mock` 和 `anthropic` 之间切换，assistant orchestrator 仍然负责验证请求、决定允许哪些内部工具、执行工具、组装最终响应、以及持久化消息。Provider 本身只能返回 `message`、`tool_call` 或 `error` 这三种规范化结果，不能直接查库，也不能绕过 tool executor。这样面试时可以清楚说明：我们不是把模型 SDK 散落到 controller 里，而是先把 provider 边界、数据权限边界、和 tool execution 边界都收紧，再逐步往 streaming chat 演进。"

#### Phase-specific Q&A

**Q: 为什么添加 provider adapter 而不是直接在 assistant 服务中调用 Anthropic？**

适配器将 provider 特定的载荷格式和传输规则隔离开来。assistant 服务应该拥有产品行为，而不是 SDK 繁文缛节。切换 provider 不应该需要重写控制器。

**Q: env 切换证明了什么？**

`ASSISTANT_PROVIDER=mock` 和 `ASSISTANT_PROVIDER=anthropic` 使用相同的编排器接口，这意味着 provider 切换不再只是理论，而是真实的架构接缝。

**Q: 这个阶段最重要的边界是什么？**

最重要的边界是 provider 可以影响工具选择，但后端仍然拥有工具执行、数据访问、验证、持久化和最终响应策略。

---

### 16.7 Phase 3.5 — 完整 Assistant 流程总结

至此，项目可以被解释为完整的 AI 应用管道，而非孤立功能的集合。

当前端到端的 assistant 流程是：
1. 用户在前端 assistant 面板中输入消息
2. 前端 hook 进入 `thinking` 状态
3. 前端使用 `fetch` 加 `ReadableStream` 打开 `POST /api/assistant/stream-turn`
4. 后端 assistant 编排器验证请求并解析经过认证的 session 所有权
5. provider adapter 返回一个规范化结果：`message`、`tool_call` 或 `error`
6. 如果 provider 请求工具，后端执行器验证工具名称、验证参数 schema，并注入认证的用户上下文
7. 确定性工具返回带证据支持的结构化数据
8. 编排器塑造最终 assistant 响应并发出项目自有的 SSE 事件
9. 前端 hook 消费这些事件并在 `tool_calling`、`answering`、`done` 或 `error` 之间转换状态

重要的访谈点：用户可以看到 assistant 在回答之前查询工具。系统不会把工具支持的推理呈现得好像凭空而来。

#### 这条线路是面试时应该强调的主线

- 真实训练日志
- 确定性计算层
- 工具注册表和执行器
- provider adapter
- SSE assistant 流
- 前端聊天状态机

正确的框架是："这已经是一个完整的 AI 应用链路，但它仍然是受控的单轮、单工具、证据优先的 assistant，而不是完整的类 agent 训练系统。"
## 17. 涓轰粈涔堢幇鍦ㄤ笉鍋氭垚鑷敱鑱婂ぉ鏈哄櫒浜?

褰撳墠鐗堟湰鍒绘剰娌℃妸 AI 鍔╂墜鍋氭垚瀹屽叏鑷敱鑱婂ぉ銆傜幇闃舵鐨勭洰鏍囦笉鏄硾鍖栭棶绛旓紝鑰屾槸鎶?AI 鍥炵瓟寤虹珛鍦ㄥ彲瑙ｉ噴銆佸彲澶嶇幇銆佸彲杩芥函鐨勮缁冭褰曡В閲婁箣涓娿€傚鏋滅幇鍦ㄧ洿鎺ュ線“鑷敱鑱婂ぉ”鎺ㄨ繘锛岀郴缁熷氨闇€瑕佸悓鏃惰В鍐冲杞?tool loop銆乽nsupported intent 鍏滃簳銆佸畨鍏ㄨ竟鐣屻€佹洿澶嶆潅鐨?provider orchestration锛屼互鍙婃洿楂樼殑娴嬭瘯鎴愭湰銆?

鎵€浠ヨ繖涓€鐗堥€夋嫨鐨勬槸 deterministic insight dashboard锛屽厛璁╃敤鎴锋墦寮€椤甸潰灏辫兘鐪嬪埌绋冲畾鐨勫缓璁€佸亸绉戞彁閱掋€佹仮澶嶆彁閱掑拰鍔ㄤ綔杩涘睍锛屽啀閫夋嫨鏄惁缁х画杩芥姇銆傝繖鏍峰仛鐨勫ソ澶勬槸锛氬欢绁?AI 鍔╂墜鐨勪骇鍝佸彲瑙佹€э紝鍚屾椂淇濇寔寤鸿鏈夋潵婧愩€佹湁璇佹嵁銆佹湁杈圭晫锛屾洿閫傚悎婕旂ず锛屼篃鏇撮€傚悎闈㈣瘯鏃惰娓呮“涓轰粈涔堢幇鍦ㄥ仛鎴愯繖鏍凤紝鑰屼笉鏄洿鎺ュ仛鎴愪竴涓棤杈圭晫鑱婂ぉ鏈哄櫒浜?銆?

## 18. 娴嬭瘯涓庨獙璇佽娉?

闈㈣瘯鏃跺彲浠ユ妸褰撳墠楠岃瘉绛栫暐璇存垚涓夊眰锛?

## 19. Muscle Load Analysis UI 面试讲法

Phase 4.3 的重点是把“偏科/肌群集中”从文案判断推进到可解释计算。后端先通过 `/api/training/muscle-load` 按 `exercise_muscles.contribution_weight` 把每组 `weight_kg * reps` 分摊到肌群，并在同一动作内归一化 contribution weight，避免字典权重总和不是 1 时造成容量膨胀或丢失。

Analysis Tab 展示的是这层 deterministic evidence，而不是 AI 生成建议。用户可以看到最近 30 天的 weighted volume、contribution ratio、主要贡献动作、top muscle groups 和 low-volume muscle groups。这里的 low-volume 只表示最近记录或当前返回结果中占比较低，不等于训练不足、医疗风险或必须补练。

这个设计让职责边界更清楚：Analysis Tab 负责展示原始、可追溯、可复现的计算结果；AI Assistant 后续可以消费同一套 muscle-load evidence，把它转成更自然的解释和建议。这样面试时可以说，项目没有让模型直接猜“你是不是偏科”，而是先建立确定性肌群负荷层，再让 assistant 在证据之上表达。

## 20. Assistant Insights Backend Endpoint 面试讲法

Phase 4.3 Batch 3 把 Assistant Insight Dashboard 的业务判断从前端 builder 收回后端。前端不再同时拉 training summary、recommendation context 和 exercise progress 后自己拼卡片，而是调用 `GET /api/training/assistant-insights`，直接渲染后端返回的 view-model。

这个 endpoint 仍然不是 LLM 生成内容。它组合已有 deterministic services：training summary、recommendation context、muscle load，以及可选的 selected exercise progress。这样做的好处是业务判断集中在后端，AI Assistant、未来 mock provider 或真正 provider tool 都可以复用同一套 insight 口径。

面试时可以这样讲：我没有让前端承担“偏科提醒/今日建议/判断依据”的业务规则，也没有让模型直接猜答案。后端先生成可测试、可复现、带 evidence summary 的 insight cards，前端只负责产品化渲染。这个阶段证明的是 deterministic insight orchestration，而不是 RAG、MCP 或多工具 Agent。

- unit tests锛氱敤鏉ヨ瘉鏄庤矾鐢便€丆ontroller銆乷ervice 杈圭晫鍜岀函閫昏緫鍚堝悓
- backend smoke scripts锛氱敤鏉ヨ瘉鏄庣湡瀹?app + DB 鏈鍒版湯閾捐矾
- browser demo / manual smoke锛氱敤鏉ヨ鏄庝骇鍝佹紨绀鸿矾寰勶紝浣嗗綋鍓嶄笉 overclaim 瀹屾暣 E2E

褰撳墠 root `pnpm test` 琛ㄧず鐨勬槸 unit-test lane锛屼笉绛変簬鈥滅湡瀹炴暟鎹簱璺緞鍏ㄩ儴閫氳繃鈥濄€傜湡瀹炵殑 auth銆乤ssistant mock-turn銆乼raining summary銆乺ecommendation context 鍜?exercise progress 閮芥槸閫氳繃鐙珛 smoke scripts 鍦ㄦ彁鏉冪幆澧冧笅楠岃瘉鐨勩€?

濡傛灉闈㈣瘯瀹橀棶涓轰粈涔堣鎻愭潈杩愯锛屽彲浠ョ洿鎺ヨ锛氬綋鍓嶅伐浣滃尯鐨?sandbox 璁块棶鎺у埗浼氭嫤鎴?DB egress锛屾墍浠ユ湁涓€浜?DB-backed smoke 闇€瑕佺敤 elevated run 鎵嶈兘璇佹槑浜у搧閫昏緫鏄惁姝ｅ父銆傝繖鏄幆澧冮檺鍒讹紝涓嶆槸 app bug銆?

## 21. Natural Language Workout Intake Backend

Phase 4.4 Batch 1 adds a low-friction logging entry point: `POST /api/training/workout-intake/parse`.

The important product boundary is that natural-language intake is not the analysis layer and not an AI reasoning feature. It converts a user's rough training description into a structured workout draft, then a future UI can ask the user to confirm or edit before saving through the existing workout API.

Interview framing:

> I did not let the model directly write workout records. The backend first parses natural language into a validated draft, matches exercises against the existing dictionary, returns ambiguous candidates instead of guessing, and only a later user-confirmed step can save the workout. This lowers logging friction while keeping the deterministic analysis chain trustworthy.

Current Batch 1 boundaries:

- Text input only; no voice capture or speech-to-text.
- Rule-based deterministic parser only; no LLM structured output.
- Draft generation only; no `workouts` or `sets` persistence.
- Exercise matching uses the existing exercise dictionary and returns `matched`, `ambiguous`, or `unresolved`.
- Ambiguous names such as broad bench-press terms are not silently mapped to the first candidate.

## 22. Exercise Alias & Matching Layer

Phase 4.4 Batch 2 separates exercise matching from the natural-language parser. The parser still handles text normalization, exercise segmentation, and set extraction; the new matching layer handles standard names, system aliases, broad aliases, candidate ordering, confidence, and unresolved results.

Interview framing:

> Natural-language workout logging is only useful if user phrases can be mapped safely to standard exercise IDs. I added a deterministic alias layer for common gym terms, but broad terms like "row" or "press" still return candidates instead of being silently saved. This preserves data quality while lowering logging friction.

Current Batch 2 boundaries:

- System aliases are code-defined and keyed by canonical exercise code.
- No database migration or user-custom alias table yet.
- Alias matching only improves draft generation; it still never creates workouts.
- Future confirmation UI will let users resolve ambiguous candidates before saving.

## 23. Natural Language Workout Intake UI

Phase 4.4 Batch 3 turns the draft parser into a usable Training-tab flow. The frontend now has a "quick text logging" panel that sends natural-language text to `POST /api/training/workout-intake/parse`, renders the returned draft, and only saves after the user has confirmed every remaining exercise.

Interview framing:

> I kept natural-language intake as a confirmation workflow, not an auto-save workflow. The backend parser and alias layer still only generate a draft; the frontend blocks save for ambiguous or unresolved exercises, lets the user choose candidates or delete unresolved rows, and then reuses the normal create workout API. That keeps low-friction logging connected to the same deterministic analysis chain without polluting training data.

Current Batch 3 boundaries:

- Quick text intake is separate from the manual training composer.
- Ambiguous rows require candidate selection before save.
- Unresolved rows can be deleted; manual exercise-library selection is a future improvement.
- Saving uses the existing `createWorkout` contract and refresh path.
- No voice capture, speech-to-text, LLM structured output, RAG, MCP, Agent behavior, provider loop change, or medical / rehab advice.

## 24. Intake Draft Manual Resolution

Phase 4.4 Batch 4 closes the biggest usability gap before voice input: unresolved and ambiguous draft rows can now be resolved manually through the exercise dictionary instead of forcing the user to delete them.

Interview framing:

> Before adding voice, I made the confirmation step robust. If the parser cannot identify an exercise, or returns candidates that do not include the user's intent, the user can choose the correct standard exercise from the dictionary. The parser still never writes workout data directly; it produces a draft, the user resolves uncertainty, and only then does the frontend reuse the normal workout create API.

Current Batch 4 boundaries:

- ExercisePicker supports optional selection mode, but the normal dictionary browser remains browse-only.
- Manual resolution changes only the draft's matched exercise fields; it preserves original input text and parsed sets.
- Ambiguous rows can use backend candidates or a manual library override.
- Unresolved rows can use manual library selection or be deleted.
- Set editing is intentionally deferred; this batch only resolves exercise identity.
- Voice capture can now reuse the same transcript -> parse -> review -> manual resolution -> save flow later.

## 25. Voice Workout Capture

Phase 4.4 Batch 5 adds a lightweight browser voice entry point on top of quick text intake. The browser turns speech into transcript text, the user can edit that text, and only then does the app reuse the existing parser, draft review, manual resolution, and save flow.

Interview framing:

> I did not build voice as a separate data-writing path. Voice only creates a transcript in the frontend. That transcript still becomes a workout draft, ambiguous or unresolved exercises still require confirmation or manual resolution, and the final save still uses the normal workout create API. This keeps voice low-friction without weakening data quality.

Current Batch 5 boundaries:

- Uses browser `SpeechRecognition` / `webkitSpeechRecognition` when available.
- Unsupported browsers fall back to text intake.
- No audio is uploaded, stored, or sent to a backend STT provider.
- No Whisper / OpenAI speech API integration.
- Voice does not auto-parse or auto-save; the user must review transcript text first.
- Future production STT could replace transcript capture without changing the parser -> draft confirmation -> save chain.

## 26. Voice Intake UX & Parser Guardrails

Phase 4.4 Batch 5B is a repair batch based on real browser/manual testing. The quick intake UI is no longer a large always-visible panel in the Training tab. Instead, the main training row stays focused: `+ 记录训练` keeps the manual composer path, while lightweight text and microphone triggers open the same transcript confirmation modal.

Interview framing:

> I treated voice as an input source, not a trusted data source. Press-and-hold voice only creates editable transcript text. The user still checks the transcript, parses it into a draft, resolves ambiguity, and confirms before save. When the deterministic parser sees an incomplete oral phrase like "高位下拉十组，每组70公斤", it does not invent reps or generate `kg x 0`; it returns incomplete draft metadata and blocks save until the user corrects the text.

Current Batch 5B boundaries:

- Press-and-hold microphone UX uses browser SpeechRecognition only; no audio upload or backend STT.
- The transcript modal does not auto-parse or auto-save.
- Parser output now separates complete `sets` from review-only `incomplete_sets`.
- `incomplete_sets` blocks save and explains missing fields such as reps or weight.
- Context words such as back/chest/training/today/yesterday/filler are ignored instead of becoming unresolved exercise rows.
- Chinese exercise display is preferred for intake results when a known Chinese name exists; a full app-wide language preference remains future work.
- This is still deterministic parser work, not LLM structured output, RAG, MCP, Agent behavior, or medical / rehab advice.

## 27. LLM Structured Workout Intake Fallback

Phase 4.4 Batch 6 upgrades natural-language intake from pure rules to a hybrid parser. The deterministic parser still runs first for cheap, stable formats. If that result is low quality, the backend can call a structured LLM fallback that returns JSON draft data, then the existing Zod validation and exercise matching layers take over.

Interview framing:

> I did not let the model save workouts or choose database exercise IDs. The model only helps convert messy oral text into a structured draft shape. The backend validates that JSON with Zod, rejects unsafe fields like `exercise_id`, runs deterministic exercise matching, and still requires user confirmation before using the normal create workout API.

Current Batch 6 boundaries:

- Rule parser remains the first path.
- LLM fallback is automatic only for low-quality parses: missing sets, incomplete sets, or unresolved-heavy output.
- Mock fallback is the default so tests and smoke do not need a real model key.
- Real Anthropic fallback is env-gated through `WORKOUT_INTAKE_LLM_PROVIDER=anthropic` and the existing API key infrastructure.
- No backend STT, audio upload/storage, RAG, MCP, Agent loop, User Training Profile, or medical / rehab behavior.

## 28. Hybrid Parser Fallback Reliability

Phase 4.4 Batch 6B is a repair batch from real voice/manual testing. It tightens the quality gate around the hybrid intake parser: if a rule parse recognizes an exercise but cannot produce valid sets, the backend treats that as low quality and attempts the structured fallback instead of returning a matched-but-unsaveable draft.

Interview framing:

> I learned from manual voice testing that "matched exercise" is not enough. If the system identifies 高位下拉 but fails to parse 3 sets, 70kg, and 10 reps, that is still a failed intake. I tightened the hybrid parser so no-valid-set rows trigger fallback, expanded the deterministic mock fallback for realistic Chinese oral phrases, and kept all output as draft-only data that still goes through Zod validation, deterministic exercise matching, and user confirmation.

Current Batch 6B boundaries:

- The endpoint remains `POST /api/training/workout-intake/parse`; the frontend contract and save flow are unchanged.
- User-facing parser warnings are Chinese product copy, not raw English implementation messages.
- Mock fallback covers realistic local demo phrases without requiring a real API key.
- Real Anthropic fallback remains opt-in through environment configuration.
- No backend STT, audio upload/storage, direct workout creation by LLM, LLM-selected exercise IDs, RAG, MCP, Agent/provider loop, User Training Profile, or medical / rehab behavior.

## 29. Date-Aware Workout Intake

Phase 4.4 Batch 6C fixes a data correctness issue in natural-language and voice intake: a user can say "昨天" or "五月二十九号", and the draft now uses that training date instead of blindly saving everything as today.

Interview framing:

> I treated date parsing as part of workout data correctness, not a UI nicety. The transcript can contain relative dates like 昨天 / 前天 or absolute dates like 5月29号 / 2026-05-29. The backend resolves those deterministically against a local reference timestamp from the frontend, stores the result in `draft.performed_at`, and the frontend shows a date input so the user can confirm or correct it before saving.

Current Batch 6C boundaries:

- Text date hints take priority over request `performed_at`.
- If no text date exists, the frontend-provided local reference datetime is used.
- If the request also omits a date, the server current time remains the fallback.
- The LLM fallback path does not decide final dates; it reuses the same deterministic date parser result.
- The frontend save path still uses the existing `createWorkout` contract.
- No Training Profile, RAG, MCP, Agent/provider loop, backend STT, or direct parser persistence was added.

## 30. Intake Modal Responsiveness + Exercise Dictionary Expansion

Phase 4.4 Batch 6D closes two practical usability gaps from manual testing: the intake modal must fit mobile viewports, and the exercise dictionary must recognize common Chinese workout phrases such as 哑铃推肩 and 引体向上.

Interview framing:

> The natural-language parser can only feel useful if the review UI is usable and the dictionary contains real gym movements. I changed the transcript modal into a bounded viewport dialog with a scrollable body and sticky footer actions, then expanded the deterministic exercise dictionary, alias map, and muscle-load mappings. Broad phrases still return candidates, so the system does not silently choose an exercise ID just because the model or parser heard a vague term.

Current Batch 6D boundaries:

- Modal responsiveness is a frontend layout fix; it does not change the parse or save contract.
- Standard exercise IDs still come only from the system dictionary and deterministic alias/matching service.
- Expanded muscle mappings are deterministic approximations for load analysis, not medical precision.
- Broad aliases such as 推肩 / 划船 / 夹胸 / 飞鸟 / 下拉 / 弯举 remain ambiguous.
- No user-custom aliases, admin dictionary editor, RAG, MCP, Agent/provider loop, backend STT, audio storage, or medical / rehab judgment was added.
