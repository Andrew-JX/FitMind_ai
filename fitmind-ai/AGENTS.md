# AGENTS.md — AI 编码助手必读规则

> 你（AI 助手）在开始任何任务前必须读完这份文件。 这里写的是**硬规则**，违反就是 bug。

------

## 0. 任务开始前必读清单

本文件是**唯一入口**。开工前只需读两层：

1. 本文件（AGENTS.md）—— 项目定位、分层规则、当前状态、文档同步规则都在这里。
2. **与本次任务直接相关的那一份领域文档**（按需，不要全读）：
   - 改后端路由 / API → `docs/api-contract.md`
   - 改数据库 → `docs/db-schema.md`
   - 涉及 AI / Tool Calling / RAG → `docs/ai-decisions.md`
   - 改前端 UI → `docs/UI_SPEC.md`
   - 需要历史背景 → `docs/PROJECT_BRIEF.md`、`docs/architecture.md`

不需要每次都把 docs/ 通读一遍，也不需要先写"5 条总结"。直接读相关文件 + 看目标代码附近的现有实现和测试，然后动手。不确定再问。

------

## 1. 项目定位（一句话提醒）

FitMind AI = 训练日志 + 计算层 + Tool Calling + 可解释 AI 建议。

- **不是**聊天机器人
- **不是**套壳 ChatGPT
- **核心卖点**：所有 AI 建议绑定真实数据，通过 evidence 字段可追溯

------

## 2. 目录结构与分层规则

```
fitmind-ai/
├── client/                      # React 前端
│   ├── src/
│   │   ├── components/          # 纯 UI 组件，不直接 fetch
│   │   ├── features/            # 业务功能模块（chat / training / dashboard）
│   │   ├── hooks/               # 复用逻辑（useStreamChat、useToolCallState 等）
│   │   ├── services/            # 接口请求封装（唯一发请求的地方）
│   │   ├── store/               # Zustand 全局状态
│   │   ├── types/               # TS 类型定义（与后端共享部分放 shared/）
│   │   ├── utils/               # 纯函数工具
│   │   └── constants/           # 常量
│   └── ...
├── server/                      # Express 后端
│   ├── src/
│   │   ├── routes/              # 路由定义
│   │   ├── controllers/         # 请求处理（薄）
│   │   ├── services/
│   │   │   ├── analytics/       # 计算层（fatigue/volume/progress/plateau）
│   │   │   ├── ai/              # AI 相关（anthropicClient、toolLoop、structuredOutput）
│   │   │   ├── rag/             # RAG（扩展阶段）
│   │   │   ├── mcp/             # MCP Server（扩展阶段）
│   │   │   └── agent/           # ReAct Workflow（扩展阶段）
│   │   ├── db/                  # DB 连接、迁移、查询封装
│   │   ├── middleware/          # 鉴权、限流、错误处理
│   │   ├── types/               # TS 类型
│   │   ├── utils/               # 纯函数
│   │   └── constants/           # 常量（含算法阈值如 FATIGUE_TAU）
│   └── ...
├── shared/                      # 前后端共享类型（DTO、tool schemas）
├── docs/                        # 所有项目文档
├── AGENTS.md                    # 本文件
└── README.md
```

### 分层硬规则（违反即 bug）

**前端**：

- `components/` 中的组件**禁止直接调用 fetch / axios**
- `components/shared/` 下的共享组件**禁止 import store**；只通过 props 接收数据
- `features/<domain>/components/` 下的业务组件**只能通过同 feature 的 hook 间接使用 store**，不能直接 import store
- 所有接口请求只能通过 `services/` 发起
- `services/` 不能 import `components/`
- 业务功能模块必须放在 `features/`，而不是塞在 `components/`
- Zustand store 只放跨组件共享的状态；组件内部状态用 `useState` / `useReducer`

**后端**：

- `controllers/` 必须薄（< 30 行）：解参数、调 service、返结果
- 所有业务逻辑放在 `services/`
- `services/analytics/` **禁止 import** `services/ai/`（计算层不依赖 AI 层）
- `services/ai/` **可以** import `services/analytics/`（AI 层调用计算层）
- 数据库查询统一走 `db/` 层，不在 controller 里写 SQL

**共享层**：

- 所有 DTO（数据传输对象）、Tool 参数 / 返回 schema 写在 `shared/`，前后端都从这里 import
- 这样前后端类型不会漂移

------

## 3. 命名规范

| 对象        | 规则              | 示例                                  |
| ----------- | ----------------- | ------------------------------------- |
| 文件名      | kebab-case        | `fatigue-score.ts`                    |
| 组件文件    | PascalCase        | `WorkoutForm.tsx`                     |
| 变量 / 函数 | camelCase         | `getFatigueScore`                     |
| 类型 / 接口 | PascalCase        | `TrainingSet`                         |
| 常量        | UPPER_SNAKE_CASE  | `FATIGUE_TAU`                         |
| 数据库表    | snake_case 复数   | `exercise_muscles`                    |
| 数据库字段  | snake_case        | `contribution_weight`                 |
| API 路径    | kebab-case        | `/api/training-logs`                  |
| 环境变量    | UPPER_SNAKE_CASE  | `DATABASE_URL`                        |
| 枚举值      | snake_case 字符串 | `'tool_calling'`, `'recovery_status'` |

------

## 4. TypeScript 规则（严格）

- `tsconfig.json` 必须开启 `"strict": true` 和 `"noUncheckedIndexedAccess": true`
- **禁止使用 `any`**。如果真的需要，用 `unknown` 然后做类型守卫
- \- **禁止类型逃逸**：禁止 `as any`、`as unknown as Xxx`、`@ts-ignore`、`@ts-nocheck` 
- **允许的类型操作**：  - `as const` —— 字面量类型收窄  - `satisfies Xxx` —— 校验类型但保留字面量类型  - Zod / class-validator 等运行时校验后的类型收窄  - 第三方库返回 `unknown` 后经过类型守卫（`isXxx`）的转换 
- **优先用类型守卫函数**而不是 `as Xxx`，例如 `if (isUser(x)) { x.email }` 而不是 `(x as User).email`
- 所有公开函数必须有 JSDoc，至少包含 `@param` 和 `@returns`
- 类型定义优先 `interface`（可扩展），临时联合类型用 `type`
- 数据库 row 类型与 API DTO 类型分开（`UserRow` vs `UserDTO`），不要混用

### JSDoc 模板

```typescript
/**
 * 计算指定肌群在最近 N 天的疲劳分数（0-10 归一化）
 *
 * @param userId - 用户 ID
 * @param muscleGroupId - 肌群 ID（来自 muscle_groups 表）
 * @param days - 回溯天数，默认 7
 * @returns 疲劳分数（0=完全恢复，10=高度疲劳）
 *
 * @remarks
 * 公式：Σ (volume × rpeFactor × muscleContribution × decay(daysAgo))
 * 衰减常数 τ 在 constants/training.ts 中定义
 */
export async function getFatigueScore(
  userId: string,
  muscleGroupId: string,
  days = 7
): Promise<number> { ... }
```

------

## 5. 算法层硬规则

- 所有算法阈值必须从 `constants/` 读取

  ，不能写死在公式里

  - 例：`FATIGUE_TAU = 3.5`、`PLATEAU_SLOPE_THRESHOLD = 0.005`

- **所有算法函数必须有单元测试**（`*.test.ts`）

- **测试必须覆盖边界情况**：空数据、单条数据、跨年、未来日期

- **算法不直接打 console.log，使用 logger**

------

## 6. AI 集成规则

### 6.1 Tool 定义

- 所有 tool 的 schema 写在 `shared/tools.ts`
- 工具参数用 Zod schema 校验，不信任模型传过来的任何参数
- 工具返回**结构化结论**，不返回原始数据列表（防幻觉）

### 6.2 Prompt 管理

- System prompt 不能硬编码在业务代码里，统一放 `server/src/services/ai/prompts/`
- Prompt 改动必须在 `docs/ai-decisions.md` 留版本记录

### 6.3 Tool Calling 循环

- Tool 循环必须有最大轮数限制（默认 5），防止死循环
- 每次 tool_use → tool_result 都记录到 `tool_call_logs` 表
- 工具执行抛错要捕获并返回 `tool_result` 中的 error 字段，让模型能看到

### 6.4 模型输出

- 用户面向的最终回答必须是 **JSON Schema 校验过**的结构化输出
- 必须包含 `disclaimer` 字段（健康建议风险提示）
- 必须包含 `evidence` 字段（引用了哪个 tool 的哪个数据）

------

## 7. 安全规则

### 7.1 认证

- MVP 用 JWT Bearer Token；生产化切 HttpOnly Cookie + CSRF
- **绝对不允许**把 token 存 localStorage（XSS 风险）

### 7.2 输入校验

- 所有 API 入参用 Zod 校验
- SQL 必须用参数化查询（pg 的 `$1, $2` 占位符），**禁止字符串拼接**
- 用户输入不能直接拼到 system prompt（Prompt Injection 防御）

### 7.3 限流

- 全局限流：每 IP 每分钟 60 次
- AI 接口限流：每用户每分钟 20 次
- 每用户每天最多 50 次 AI 调用

### 7.4 日志脱敏

- `tool_call_logs` 不记录用户的身高 / 体重 / 真实姓名
- 错误日志不打印完整 request body（可能含敏感数据）

------

## 8. 提交规则

### Commit Message 格式

```
<type>(<scope>): <subject>

<body 可选>
```

- type: `feat` / `fix` / `refactor` / `docs` / `test` / `chore` / `style`
- scope: `client` / `server` / `db` / `ai` / `docs`
- subject: 用动词开头，不超过 50 字

例：

- `feat(server): add fatigue score calculation in analytics layer`
- `fix(client): handle SSE chunk parsing edge case`
- `docs: update ai-decisions with embedding provider choice`

### Pre-commit 必须通过

- `npm run lint`
- `npm run type-check`
- `npm test`

------

## 9. 面对 AI 助手的元规则

这一节是给 AI 看的，不是给人看的。

### 9.1 不假装看懂

- 如果文档冲突或不清楚，**立刻指出，不要猜**
- 如果用户的需求模糊，**回问澄清，不要硬上**

### 9.2 先 Plan 再写

- 用户没有明说「直接写代码」之前，**先给执行计划**
- Plan 包含：步骤、涉及文件、关键决策、风险点、不确定点
- 用户确认 plan 后再写

### 9.3 单次改动控制

- **一次改动不超过 5 个文件**
- 如果任务需要改 5+ 文件，先拆分，告诉用户拆分方案

### 9.4 改完必须自检

每次改完代码，最后输出一份简短报告：

```
本次改动总结：
- 改动文件：X 个
- 主要逻辑：...
- 风险点：...
- 用户需要重点 review 的地方：...
- 是否需要更新文档（ai-decisions / troubleshooting）：是/否
```

### 9.5 禁止行为

- 禁止偷偷修改本任务范围外的文件
- 禁止删除注释（除非是过时注释）
- 禁止跳过用户已写好的 TODO
- 禁止用 `as any` / `@ts-ignore` 绕过类型错误（让用户决定）
- 禁止 import 未在 package.json 声明的依赖（如需新依赖，提议给用户确认）

------

## 10. 这份文档的更新

- 项目规则发生变化时，**先更新本文件**，再让 AI 用新规则工作
- 如果你（AI 助手）发现规则有矛盾或缺失，**主动提出**，让用户更新本文件

## 11. 当前状态与部署（current state）

> 这一节是项目的"现状快照"，改动较大的能力时同步更新这里。

- **线上地址**：`https://fitmind-ai-psi.vercel.app/`
- **部署**：Vercel 托管 app/API 合并运行时；PostgreSQL 存用户、训练、消息、知识 chunk、saved insights、feedback。客户端走相对 `/api`，Vercel 上 `VITE_API_BASE_URL` 可留空。
- **已落地的主流程**：训练日志 CRUD + 自然语言录入、确定性训练分析（summary / progress / muscle-load / recommendation-context / weekly-report）、SSE 助手（intent 路由 + 确定性工具 + RAG + 周报/平台期诊断）、saved insights、产品反馈、可安装 PWA 壳。
- **多步 Agent（Phase 6.0）**：`next_week_plan` intent 走 `server/src/services/agent/` 的确定性 ReAct 规划器（查容量→找弱项→查进展→检索知识→生成草案），发 `agent_step_*` SSE 事件 + `state:"planning"`，`agent_trace` 进 `structured_output` 持久化。前端 trace 时间线可视化为 Batch 6.0-3。
- **RAG**：DB 存知识 chunk，Voyage `voyage-4-lite` + pgvector `vector(1024)`，有 embedding 时用 `0.7*向量 + 0.3*关键词` 混合打分，否则关键词兜底。
- **鉴权**：HttpOnly + SameSite=Lax 会话 cookie（`fitmind_token`，7 天），刷新不掉线；中间件优先读 cookie、回退 Bearer（保留给 smoke 脚本）。详见 `ai-decisions.md`。
- **语音/文本录入**：规则解析器（多动作 / 连接词 / 磅→kg / 先报后述合并）+ 可选 LLM 兜底（`WORKOUT_INTAKE_LLM_PROVIDER`= `mock`/`off`/`gemini`/`groq`/`anthropic`）；未匹配/多候选动作在语音页先确认（可"搜动作库替换"选词典动作，或移除），已匹配才进 composer。**记录页内**也可语音：composer 右下 FAB 长按"细胞分裂"成放射菜单（中=收起、上=语音、左=动作库），可滑动松手或点卫星选择；静止时脉冲光环 + "长按"提示，快速轻点仍开动作库。语音解析结果合并/追加进当前 draft，不覆盖（`use-fab-gesture.ts` 速拨手势 + `appendIntakeExercisesToDraft`）。
- **测试**：单测 Vitest（`pnpm test:unit`）；浏览器 E2E 用 Playwright + mock 后端覆盖鉴权会话流程（`pnpm test:e2e`，见 `client/e2e/`）；DB 后端链路靠 `server/scripts/*-smoke.ts`。训练·分析·助手的全流程 E2E 仍待补。
- **当前限制**：无 saved-insight 分享链接；无离线编辑/同步；无知识管理后台；无 ANN 索引；**刻意不引入** LangChain / LangGraph / MCP / 多 Agent。

验证命令以 `README.md` 为准；docs-only 改动跑 `pnpm format:check`，完整门禁跑 `pnpm verify`（E2E 需另跑 `pnpm test:e2e`）。

**后续待办清单见 `docs/roadmap.md §1.6`**（开新窗口接手时先读那里）。

------

## 12. 文档同步规则（每次改动必做）

文档不是事后清理。**每次任务在收尾前都要做一次"文档影响审查"**：代码、行为、数据结构、流程或运维方式变了，就在同一次改动里更新对应文档；如果确实不用更新，在最终回复里说明原因。不要等用户单独说"顺便更新文档"。

按改动区域对照下表，更新命中的文档（`docs/progress.md` 几乎总是要追加一条）：

| 改动区域 | 需要检查/更新的文档 |
| --- | --- |
| 产品定位 / 范围 / 阶段计划 / 重大能力 | `docs/PROJECT_BRIEF.md`、`README.md`、本文件第 11 节 |
| API 路由 / 请求 / 响应 / 错误 / 鉴权 / SSE 事件 | `docs/api-contract.md`、受影响的 `shared/src/**` |
| 数据库表 / 列 / 索引 / 迁移 / seed / 归属 | `docs/db-schema.md` |
| 助手 intent / 工具 / provider / prompt / 结构化输出 / Evidence·Sources 语义 | `docs/ai-decisions.md`、`docs/api-contract.md`、`docs/demo-script.md`、`docs/production-smoke-checklist.md` |
| RAG 检索 / 知识导入 / embedding / eval | `docs/ai-decisions.md`、`docs/db-schema.md`、`docs/production-smoke-checklist.md` |
| 前端 UI / 交互 / tab / 布局 / 工作流耦合 | `docs/UI_SPEC.md`、`docs/frontend-current-state.md`、`docs/demo-script.md` |
| 本地运行 / env / 端口 / 验证 / 部署 / smoke 命令 | `docs/local-run-guide.md`、`docs/production-smoke-checklist.md`、`README.md` |
| 阻塞性或反复出现的故障 | `docs/troubleshooting.md` |
| Agent / 流程 / 规则本身 | 本文件（AGENTS.md） |

最终回复里带一行文档结论，例如：

```text
文档：已更新 <files>；未更新 <files>，因为 <原因>。
```

------

## 前端开发规则

1. 开始写任何前端组件前，先读 `docs/UI_SPEC.md`
