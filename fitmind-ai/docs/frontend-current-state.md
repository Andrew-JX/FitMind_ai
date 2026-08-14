# FitMind AI 前端现状

> 本文档记录**代码看不出来的东西**：结构性事实、重构不可破坏的约束、以及每批改动背后的决策。
>
> 它**不再逐组件镜像代码** —— 上一版正是因为这样写才在三个月里烂成负资产：542 行里 505 行描述的是重构前形态，而 `UI_SPEC` 又把其中一节当作权威约束清单引用，导致照它执行会去"修"现行的正确实现。要看某个组件当前长什么样、有哪些 props，**读 `client/src/` 的代码**；要看它该长什么样，读 `UI_SPEC.md`。

本次重写：2026-07-27（roadmap §8.2 E1）。

## 1. 现状速览

只列变化慢的结构性事实。

- **形态**：React + Vite 单页，无路由库。`client/src/App.tsx` 是唯一页面级编排，按 `activeTab` 切换四个区块（训练 / 分析 / 助手 / 个人），全部渲染在 `AppShell` 内（居中、`max-width: 430`、深色优先 + 浅色主题）。
- **鉴权**：**HttpOnly cookie 会话**（`ai-decisions.md` D19），刷新保持登录。`use-auth.ts` 的 `bootstrap()` 通过 `/api/auth/me` 恢复会话，并在内存里存一个哨兵 token（`COOKIE_SESSION_TOKEN`），只为让"token 为真才发请求"的数据 hook 继续工作；真正的凭据在 cookie 里。服务端 `auth-middleware` **cookie 优先于 bearer**。
- **设计来源**：`UI_SPEC.md` 是唯一 UI 权威，源自 `design_handoff_fitmind_ui` 的第 2 轮原型。三个主 Tab 与登录页均已按设计稿还原（main `2ac9411`）。
- **主题**：`theme/tokens.ts` 是唯一色值来源。品牌荧光绿走 `BRAND_NEON` / `brandAlpha()`（**两主题相同**，设计稿要求），跟随主题的强调色走 `theme.colors.ac` / `accentAlpha()`。`client/src` 内硬编码品牌色由 ESLint `no-restricted-syntax` 拦截。
- **本地运行**：`pnpm dev:server` + `pnpm dev:client`；本机连不上 Neon 时用 `FITMIND_DEV_API_TARGET=<线上域名> pnpm --filter @fitmind/client dev` 代理线上 API。demo 账号见 `local-run-guide.md`。

## 2. 重构不可破坏的约束

`UI_SPEC §8` 引用本节。可以重做视觉与组件拆分，但以下语义必须保留或做等价迁移。

**契约层**

- 不改后端 API 路径。
- 不改 SSE event contract（`assistant-types.ts` 的 `AssistantStreamEvent` 联合）。
- 不改 `http-client` 的错误处理约定：响应信封解包、`HttpClientError` 携带 `code`/`status`/`message`。
- 不改 workout create / list / detail / delete 的数据流与 `set_index` 前端提交约定。
- 不改 quick prompt 的 `mode` / payload 语义。

**助手状态机**

- 不改 `use-assistant-chat` 的状态语义：`idle` / `thinking` / `tool_calling` / `answering` / `done` / `error`。
- 不改 `sessionId` 的跨轮复用。
- `activeToolCall` 与 `providerSelected` 必须继续来自 SSE 生命周期事件，不得由前端推断。

**联动**

- 创建 / 删除训练后必须刷新：训练列表、训练汇总、分析页（`analysisRefreshSignal`）、助手（`assistantRefreshSignal`）。
- 分析页选中的动作必须继续驱动助手的动作相关 quick prompt（`selectedProgressExerciseId`）。

**诚实性**（与 `ai-decisions.md` 的 D 系列同源，违反即为缺陷）

- 任何文案不得命名数据未覆盖的时间窗口；范围标签必须回显服务端实际使用的范围。
- 失败的操作不得报告成功；错误不得被替换成不透明的固定文案。
- 设计稿里存在但后端不支持的功能不做假实现（当前记账：递减组、洞察卡的「☆ 保存」）。

> ⚠️ 已废止的旧约束：上一版本节要求"token 只存内存、不得写 cookie"，与 D19 的 cookie 会话直接冲突；另有三条在保护已删除的东西（`TrainingSummaryPanel`、分析页的 `RecommendationContextPanel`、点选动作驱动 quick prompt 的旧跨页联动）。均已随本次重写移除。

## 3. 增量记录

### 认证表单状态隔离（2026-08-07，fitmind-drl）

- 登录与注册分别持有邮箱、密码 state；「记住邮箱」只初始化登录邮箱，注册表单不继承登录凭据。
- `AuthScreen` 用 `submittedMode` 记录服务端错误由哪次实际提交产生。切换标签撤销错误归属，禁止
  把一次登录 500 仅因当前标签变化显示为「注册失败」。本地表单校验错误仍只在当前标签显示。
- Playwright 的失败登录回归同时检查 DOM 空值与请求计数：登录 500 后切到注册，三个注册凭据
  为空且 `POST /api/auth/register` 调用数为零。

### 核心 UI 状态走查（2026-08-14，fitmind-drl）

- 训练历史、分析、助手本周计划和个人工具的成功空态、加载态与读取错态由 HTTP 边界 Playwright 回归固定；错误态不得同时渲染同一卡片的成功空态。
- 身体数据、经期记录、训练备忘录与本周计划的读取失败均提供就地重试，重试会发起新的真实客户端请求并在成功后清除错误。
- 慢注册政策、补同意 mutation、训练列表和本周计划请求保留明确 pending UI；补同意按钮 pending 期间禁用且保持单请求。
- 320×800 与 390×844 的认证、历史、助手和个人路径使用 `scrollWidth <= clientWidth` 作页面级横向溢出门禁；键盘回归通过 Tab 记录实际焦点，并以 Enter / Space 激活关键控件。

### 计划草案卡片（AssistantPlanCard，2026-06-14，roadmap §8 FE-1）

助手消息带结构化 `plan`（`next_week_plan` 草案）时，在消息气泡内渲染 `AssistantPlanCard`：策略 chip + 动作行（名称 / 目标重量 / "N 组 × a~b 次" / basis）+ notes。`plan` 由 `mergeStructuredOutputIntoMessage` 的 `normalizePlan` 从 `structured_output.plan` 归一化。目标重量为 null 时显示"沿用上次重量"（不编造）。详见 `UI_SPEC §4.3.3`。

### 本周计划：接受 / 归档 / 放弃（2026-06-14；2026-07-27 PL-3）

心智模型=本周「目标动作集」：接受一次设为本周目标，常驻卡片哪天打开都在，真实训练按周自动匹配依从度（不强排到具体某天）。

- `planned-workout-api.ts`：`getCurrentPlannedWorkout` / `acceptPlannedWorkout`（周期=接受当天起 7 天）/ `abandonPlannedWorkout` / `archivePlannedWorkout`。**归档写 `completed`，放弃写 `abandoned`，两者语义不合并** —— `getLatestAcceptedPlannedWorkoutForUser` 只认 `active`/`completed`，把归档并进放弃会把训练历史从 D42 学习闭环的输入里删掉。
- `assistant-plan-lifecycle.ts`：纯 date-only 分类器，注入 `today` 后字典序比较；`endDate < today` 为 expired，结束当天仍 active。today 复用 `assistant-date-range.ts` 的设备本地日期，不做 `Date` 毫秒运算，因此无时区 / DST 漂移。
- `use-current-plan.ts`：暴露 `accept` / `abandon` / `archive` / `refresh`，四者均返回 `Promise<boolean>`。**mutation 的成功信号包含后续 refresh**，刷新失败不会发成功 toast；缺 token/plan 的早退也会写 `actionError`。所有路径保留 `HttpClientError` 的 HTTP 状态与服务端 message，非 HTTP 错误才用中文 fallback。
- `AssistantCurrentPlanCard.tsx`：常驻助手页顶部。active 显示「本周计划」；expired 显示「计划回顾」+「已过期」，保留真实周期、依从度与展开明细，主操作为「归档」且仍可放弃。结算后才弹 toast，失败不报成功；mutation 期间所有操作与展开/收起同时禁用。
- 接受入口在 `AssistantPlanCard` 底部「设为本周计划」，handler 在 `AssistantChatPanel`，drill 路径同 `onSaveInsight`（panel → list → bubble → plan card）。

### 训练档案编辑（2026-06-14，roadmap §8 FE-3）

- `athlete-profile-api.ts`：`getAthleteProfile`(GET) / `saveAthleteProfile`(PUT) + 纯 `parseInjuryTags`（逗号/空格分隔、trim、小写、去重、≤10 个 / ≤40 字）。
- `AthleteProfileSheet.tsx`：ActionSheet 表单（目标 / 每周天数 / 器械 chip 多选 / 伤病输入），开表单 GET 预填、保存 PUT。
- 入口随设计稿改版**从页头移进了个人 Tab**（`ProfileView.tsx`）。`AthleteProfileButton.tsx` 因此已无人引用，属待清理死代码。
- `http-client.ts` 的 `method` 联合含 `PUT`（本接口使用）。

### faithfulness 徽章 + 限流提示（2026-06-14，roadmap §8 FE-4）

- `structured_output.faithfulness` 经 `normalizeFaithfulness` 归一化到 `message.faithfulness`（只认 `verified` / `flagged`）。
- `AssistantMessageBubble` 在气泡下方渲染徽章（verified=✓ 数据已核对 / flagged=⚠ N 处待核），流式期间不显示。该徽章是护栏叙事在 UI 上的**唯一可见出口**，重构时不得顺手删掉。
- `use-assistant-chat` 的 `getReadableErrorMessage` 把 `RATE_LIMITED` / `AI_QUOTA_EXCEEDED` 映射成中文提示（含 `retry_after_seconds`）。
