# FitMind AI 路线图（roadmap.md）

> 前瞻文档：记录"接下来要做什么"。与 `docs/progress.md`（回顾，逐批次记录已做的事）配成一对。
> 阶段编号沿用 `PROJECT_BRIEF.md §7` 与 `docs/progress.md` 的 Phase 体系。
>
> Last updated: 2026-06-13

---

## 1. 现状速览（截至 Phase 5.2A.1）

主线 100% + RAG 扩展 100% + 一层产品化已上线：<https://fitmind-ai-psi.vercel.app/>

已完成（对照 `PROJECT_BRIEF.md §7`）：

- 阶段 0–5 主线：训练日志 CRUD、确定性计算层（summary / exercise-progress / muscle-load / recommendation-context）、Tool Calling 循环、SSE + 前端四态状态机、结构化输出 + Evidence/Sources 卡片。
- 扩展 A（RAG）：DB 知识 chunk + Voyage `voyage-4-lite` + pgvector + 混合打分 + 确定性 eval。
- 计划外产品化：自然语言 / 语音训练录入（LLM 结构化兜底）、PWA + 移动端打磨、动作详情与历史、教练化（周报 / 平台期诊断 / 下周计划）、收藏洞察、产品反馈。

尚未完成（本路线图的目标）：

- 扩展 B（MCP Server）——刻意推迟，未做。
- 扩展 C（多步 ReAct 训练计划）——只做了单轮版本，缺多步循环 + trace 可视化。
- 打磨阶段——`§11` 性能精确数字未回填（主观达标）。
- ~~语音录入"记录页内"入口 + 手势 FAB~~ ✅ 2026-06-13 完成（待办 B，见 §1.5 / `progress.md`）。

---

## 1.5 近期增量（Phase 5.3 之后，2026-06-12~13）

已完成并上线（详见 `progress.md` 对应条目）：

- **鉴权持久化**：HttpOnly cookie 会话，刷新/重开保持登录；修复 cookie 恢复会话后 `token=null` 导致"训练记录没了、助手用不了"的回归（`use-auth` 哨兵 token）。
- **登录崩溃修复**：空字符串 env（如空 `ANTHROPIC_API_KEY`）→ `optionalSecret` 视为未设置；provider 枚举 `.catch("mock")`，配置错误不再整站崩。
- **语音多动作解析**：逗号/`和`·`还有`·`以及`连接词分隔、`磅`→kg、"先报清单再分述"按动作合并去重、词典外的第二个动作不再被吞、`isSetOnlyFragment` 只回填纯组数碎片。
- **录入 LLM 兜底**：新增 `gemini` 与 `groq` provider（OpenAI 兼容），schema 改宽容、失败原因回传 `fallback_warnings`、429 重试 + 模型可配（`GEMINI_MODEL`/`GROQ_MODEL`）。
- **候选确认移到语音页**：未匹配/多候选动作在语音页先确认（选候选或移除），只有已匹配的才进 composer；词典外垃圾进不了训练。
- **记录页内语音（手势 FAB · 速拨）**：composer 右下 FAB 长按"细胞分裂"成放射菜单（中=收起、上=语音、左=动作库），滑动松手或点卫星均可；静止时脉冲光环 + "长按"提示，快速轻点仍开动作库。语音结果**追加**到当前 draft（合并同动作组 / 新动作追加 / id 重排），复用 `WorkoutIntakePanel` 候选确认流。

---

## 1.6 待办任务清单（开新窗口优先接手）

> 新窗口先读 `AGENTS.md`（含当前状态 + 文档同步规则），再按需读领域文档。部署 = push 到 `main`，Vercel 自动部署。线上验证可用 curl 注册取 token 再打 `/api/training/workout-intake/parse`，看返回的 `evidence.source`。

- **A. 配置 Groq 让自由口语 LLM 解析生效** ✅ 2026-06-13 用户已在 Vercel 配好
  - 已设 `WORKOUT_INTAKE_LLM_PROVIDER=groq` + `GROQ_API_KEY`（console.groq.com 免费 key）并 Redeploy。
  - 之前 Gemini 免费层对该账号持续 429，故改用 Groq。线上探测自由口语应见 `source: llm_structured_fallback`（仍建议 curl 复测一次确认）。
- **B. Batch C：记录页手势 FAB（让"记录页内"也能语音）** ✅ 2026-06-13 完成（含速拨重设计）
  - composer 右下"+"：长按"细胞分裂"成放射菜单（中=收起/×、上=语音、左=动作库），可滑动松手选或点卫星；静止时脉冲光环 + "长按"提示告知可长按；快速轻点保留开动作库。
  - 语音解析结果**追加到当前 draft**（合并同动作组 / 新动作追加 / id 重排），复用 `WorkoutIntakePanel` 候选确认流。
  - 余项（可选后续）：上滑即自动录音（给 `WorkoutIntakePanel` 加 `autoStart`）。
- **C. 录入确认页：未匹配动作支持"搜动作库替换"** ✅ 2026-06-13 完成
  - 未匹配分支加"搜动作库替换"、多候选分支加"都不是？搜动作库"，复用 `ExerciseLibraryScreen`（`mode="replace"`，portal 全屏）选词典动作即确认为 matched。
- **D. 性能精确数字回填** 🟢
  - 按 `production-smoke-checklist.md` 的 Lighthouse/远程调试流程实测 `§11`，回填结果表 + README + 面试稿。
- **E. Prettier 格式欠债（~118 文件）** ⚪
  - `pnpm verify` 的 `format:check` 红是历史欠债；`npx prettier --write .` 统一修复并加 `.gitattributes`/`endOfLine` 防复发（注意 Windows CRLF）。
- **F. 中期方向**：Phase 6.0 多步 Agent、6.1 MCP（见下）。

---

## 2. Phase 5.3 — 生产健壮性收口　🔴 进行中 / 高优先 / 低风险

把"已上线但欠债"的部分补扎实。建议按批次推进（遵守 AGENTS.md「单次改动 ≤ 5 文件」）：

- **Batch 1 — 鉴权持久化　✅ 已完成（2026-06-11）**：内存 token → HttpOnly + SameSite=Lax cookie 会话，刷新不掉线，兑现 `PROJECT_BRIEF §10.2`。中间件优先 cookie、回退 Bearer（smoke 脚本仍可跑），新增 `POST /api/auth/logout`，前端 `credentials:"include"` + 加载时 `/me` 恢复会话。决策见 `ai-decisions.md` D19。
- **Batch 2 — 浏览器 E2E　✅ 已完成（2026-06-11）**：引入 Playwright（mock 后端，无需 DB/密钥），固化鉴权会话流程（cookie 恢复 / 刷新保持 / 登录 / 登出 / 无会话）为自动化用例，浏览器验证了 Batch 1。`pnpm test:e2e`。训练·分析·助手的全流程 E2E 留作后续。
- **Batch 3 — 性能实测　🟢 主观达标收尾（精确数字待回填）**：测试流程已写入 `production-smoke-checklist.md`（Lighthouse 移动端 / 安卓远程调试 / 纯手机粗测三法 + 结果表）。真机主观体验在 `§11` 目标范围内；精确数字留待有空用 Lighthouse / 远程调试回填结果表，再同步 README 与面试稿。

完成标准：刷新不掉线 ✅；E2E 主流程绿灯 ✅；`§11` 指标主观达标 ✅（精确数字待回填）。

**Phase 5.3 整体收尾 ✅（2026-06-11）**。

---

## 3. Phase 6.0 — Agent / 多步 ReAct 训练计划　✅ 2026-06-14 完成

原计划"扩展 C"。把单轮 next-week-plan 升级为多步 ReAct 循环（查容量 → 找弱项 → 查进展 → 检索知识 → 生成计划），并提供 trace 可视化。是项目从 "Tool Calling" 跨到 "Agent" 的关键一跃。

分批推进：

- **Batch 6.0-1 — 后端 agent 核心　✅ 2026-06-14**：新增 `server/src/services/agent/`：`react-planner-types.ts`（trace / step / 事件类型）+ `next-week-plan-agent.ts`（确定性 ReAct 策略，注入 `runTool`/`retrieve`/`onStep`/`now`，可单测）+ 4 例单测。策略基于观察分支：空数据第一步即停（`no_data`）；无指定动作则跳过单动作进展；按周频率给"巩固/加量/维持"建议；证据跨步聚合。尚未接入 orchestrator。
- **Batch 6.0-2 — 接线 + SSE 契约　✅ 2026-06-14**：`assistant-stream-types.ts` 加 `planning` 状态 + `agent_step_started/finished` 事件；`assistant-orchestrator-service.ts` 把 `next_week_plan` 改走 agent（早返回分支，注入 `executeAiTool`/`retrieveKnowledgeChunks`+log/`onStep→SSE`），trace 进 `structured_output` 并持久化，删掉旧单轮 `buildNextWeekPlanAnswer`；客户端 `assistant-types.ts`/`use-assistant-chat.ts` 接事件累积 trace + 未知事件忽略（向前兼容），`AssistantStatusRail` 加 planning 文案；`api-contract.md` + `ai-decisions.md`（D20）已更。
- **Batch 6.0-3 — 前端 trace 可视化　✅ 2026-06-14**：新增 `AssistantAgentTrace.tsx` 垂直时间线（节点 + 连接线 + kind 图标 + 状态色 chip + thought/工具/耗时/观察），`AssistantMessageBubble` 在答案上方渲染 `message.agentTrace`（默认展开），状态色复用 `getToneColors`。

---

## 4. Phase 6.1 — MCP Server 封装　🟠 中期 / 面试价值

原计划"扩展 B"。把确定性训练工具暴露成 MCP server，可被 Claude Desktop 调用。工作量小、话题性强，可与 6.0 并行或二选一。

---

## 5. Phase 7.0 — 真实 Provider 上线 & RAG 进阶　🟢 按需

- 默认 `mock` provider → 接 Anthropic 真实流式，实测成本 / 限流（验证 `§10.4` 每日 50 次上限）。
- RAG 语料变大时再上 ANN 索引（HNSW / IVFFlat）+ reranking；当前小语料精确余弦足够。

---

## 6. Phase 7.x — 产品打磨　⚪ 长期

saved-insight 分享链接、知识管理后台、离线编辑 / 同步。优先级最低，视是否长期运营而定。

---

## 7. 优先级建议

5.3（夯实已上线）→ 6.0（多步 Agent，面试杀手锏）→ §8 产品蓝图 backlog（按 ROI 逐片）→ 6.1 / 7.x（按需）。

---

## 8. 产品蓝图 backlog（ROI 排序，2026-06-14 与用户共定）

> 定位锚点：本产品的核心论点是「证据绑定、确定性、不是套壳 ChatGPT 的 AI 教练」。下面每一片都要么**强化这条论点**，要么**合上产品闭环**，且成本可控、面试能讲（PM + AI 应用开发两边都顾）。
>
> 共识约束：
> - 两类岗位**均衡**：Track 1（AI 工程：评估/护栏/可观测）与 Track 2（产品：闭环/目标/留存）交替推进。
> - **暂只用 Groq 免费 provider**，但保留干净的 provider seam + 文档说明（见 Slice 7）。接真实大模型推迟，理由是成本。
> - **慢慢做、按投入产出比从高到低、每片最小杠杆**；一次只动一片，遵守 AGENTS「单次改动 ≤ 5 代码文件 + 文档同步」。

执行顺序（ROI 高→低）：

- **Slice 1 — 运行时 faithfulness 校验　✅ 2026-06-14 完成**
  - 做什么：助手返回结构化答案前，确定性校验答案 summary/bullets/conclusion/recommendation 里出现的**数字与引用**都能在本轮工具输出里找到；找不到则标注（`unverifiedClaims`），dev 下可选抛出，并在 `structured_output` 上挂一个 `faithfulness` 结果。
  - 落地：新增 `server/src/services/assistant/answer-faithfulness.ts`（`verifyAnswerFaithfulness` + `enforceFaithfulnessInDev`，宽松可接受集合：原始值 + 数组长度 + 字符串内嵌数字 + ratio×100，带容差）+ 单测（含编造 999kg 被抓、toLocaleString/percent 不误报、UUID 引用校验）；`assistant-orchestrator-service.ts` 常规工具路径与 `next_week_plan` agent 路径（包 `runTool` 捕获聚合结果集）均接线，response 加 optional `faithfulness` 字段随 structured_output 持久化。决策见 `ai-decisions.md` D21。
  - 为什么排第一：纯后端、可单测、零预算、最自包含，直接把"证据绑定"从设计口号变成**被强制校验的不变量**。PM 和 AI 工程都能讲。
  - 价值：信任↑ / AI 面试↑↑｜成本：低｜依赖：无。
  - 验收：✅ 新增校验器 + 单测（含"编造数字被抓到"用例）；✅ `structured_output` 带 faithfulness 字段；✅ 门禁全绿（type-check / lint / 200 单测）；✅ 不改既有答案文案逻辑（只增校验）。
  - 后续：前端"✓ 数据已核对"徽章展示（留给后续片）。

- **Slice 2 — Eval 套件 + 回归门禁　✅ 2026-06-14 完成**
  - 做什么：golden 数据集（问题 → 期望 intent / 必引证据 / 该不该拒答），离线跑 intent 路由准确率 + faithfulness 通过率 + 关键回归，`pnpm eval` 命令；先本地可跑，再考虑进 CI。叙述类可选 LLM-as-judge（可关、默认 off 保持零成本）。
  - 落地：新增 `server/src/services/assistant/assistant-eval.ts`（13 条 intent golden + 3 条 faithfulness fixtures + 三个纯函数评测器 + NarrativeJudge seam）+ 单测；`server/scripts/run-eval.ts` runner，根 `pnpm eval` 委托到 server，打印分项报告、回归非零退出。复用 Slice 1 的 `verifyAnswerFaithfulness` 做 faithfulness 打分。决策见 `ai-decisions.md` D22。
  - 价值：AI 面试↑↑↑（"你怎么知道它对/不回归"的标准答案）｜成本：低-中（主要是写数据集）｜依赖：复用 Slice 1 的校验器作为 faithfulness 打分。
  - 验收：✅ `pnpm eval` 产出可读报告（每项通过/失败 + 汇总分）；✅ mock 可复现数据集（无 DB）；✅ 回归非零退出；✅ 门禁全绿（209 单测）。

- **Slice 3 — 可执行下周计划·生成器（产品 #1，闭环第一步）　✅ 2026-06-14 完成**
  - 纯函数 `weekly + progress (+ 档案) → 具体方案（动作 × 组 × 次 × 目标重量）`，先在助手答案 / agent synthesis 里结构化展示，**先不落库**。可单测。
  - 落地：新增 `server/src/services/agent/next-week-plan-generator.ts`（`generateNextWeekPlan` 纯函数：sets 由策略定、6~10 次、focus 目标重量=取整(估算1RM×72%)到2.5kg、无基线给 null 不编造、最多 4 动作，全命名常量）+ 6 例单测；接入 `next-week-plan-agent.ts` synthesis，`NextWeekPlanDraft` 经 agent 输出 → `MockAssistantTurnResponseData.plan` → structured_output 持久化（结构化、不内联进答案文本，故不触发 Slice 1 faithfulness 误标）。决策见 `ai-decisions.md` D23。
  - 价值：产品↑↑ / PM 面试↑｜成本：中｜依赖：6.0 agent 已有。
  - 后续：前端结构化渲染草案卡片；档案注入（Slice 4）；落库 + 依从度（Slice 5）。

- **Slice 4 — 运动员档案（薄）+ 注入 agent　✅ 2026-06-14 完成（3 批）**
  - 目标 / 每周天数 / 器械 / 伤病约束，持久化 + CRUD + 注入 agent 上下文。
  - 落地：Batch 1 数据层（`athlete_profiles` 表 + repository + service + 单测）；Batch 2 HTTP CRUD（`GET/PUT /api/athlete-profile` + controller 单测）；Batch 3 注入（orchestrator best-effort 加载档案 → `PlanProfileContext` → 生成器按 goal 选 `GOAL_SCHEMES` 次数/强度方案、伤病/每周天数进 notes，无档案退回 hypertrophy 默认）。决策见 `ai-decisions.md` D24。
  - 价值：产品↑↑、个性化 + 安全｜成本：低-中｜依赖：喂给 Slice 3 更准。
  - 后续：前端档案编辑表单 + DTO 提升到 `shared/`；伤病→动作硬过滤；落库依从度（Slice 5）。

- **Slice 5 — 接受计划 → planned workout 模型 + 依从度　✅ 2026-06-14 完成（3 批）**
  - 一键把生成的计划接成 app 里的「计划训练」，记录 planned vs performed，给依从度反馈。真正合上 记录→分析→计划→再记录。
  - 落地：Batch 1 依从度计算器（`plan-adherence.ts` 纯函数：planned vs performed 动作名匹配 → done/partial/missed + 动作级/组级比例，封顶 100%、除零安全，6 例单测）；Batch 2 持久化（`planned_workouts` 表 jsonb 快照 + repository + service：`acceptPlan` / `getCurrentPlanWithAdherence`（读取时用 `getTrainingSummary` 算依从度）/ `setPlanStatus`，注入 fake 单测）；Batch 3 HTTP（`POST /api/planned-workouts` 接受、`GET /api/planned-workouts/current` 带依从度、`PATCH /api/planned-workouts/:id` 改状态 + controller 单测）。决策见 `ai-decisions.md` D26。
  - 价值：产品↑↑↑｜成本：中-高（新数据模型）｜依赖：Slice 3 + 4。
  - 后续：前端「接受计划」按钮 + 依从度卡片；依从度可纳入 agent 上下文（下次规划参考上次依从）。

- **前端集中片（点亮 Slice 3/4/5/1/6）　✅ 2026-06-14 完成**
  - 目标：把后端已落地、UI 仍"隐形"的能力点亮。按用户选择分批：
  - **FE-1 — 计划草案卡片（Slice 3）　✅ 2026-06-14**：助手消息带结构化 `plan` 时渲染 `AssistantPlanCard`（策略 chip + 动作×组×次×目标重量 + basis + notes，目标重量 null 显示"沿用上次重量"不编造）。`assistant-types`/`assistant-structured-output`（`normalizePlan`）/ bubble 接线 + 单测。
  - **FE-2 — 接受计划 + 依从度卡片（Slice 5）　✅ 2026-06-14**：心智模型=本周「目标动作集」（接受一次设为本周目标，常驻卡片哪天打开都在，真实训练按周自动匹配依从度，不强排到具体某天）。FE-2a：`planned-workout-api`（accept/current/abandon + 纯 denormalize/forward-week helper + 单测）+ `use-current-plan` hook + 常驻 `AssistantCurrentPlanCard`（助手页顶部，计划 + 逐动作 done/partial/missed + 依从比例 / 空态）。FE-2b：草案卡片「设为本周计划」按钮，drill 过 panel→list→bubble→plan card 接到 hook.accept，成功后顶部卡片刷新。
  - **FE-3 — 运动员档案编辑（Slice 4）　✅ 2026-06-14**：Header 加「训练档案」user IconButton（`AthleteProfileButton`）→ `AthleteProfileSheet`（ActionSheet 表单：目标 select / 每周天数 select / 器械 chip 多选 / 伤病约束逗号输入），开表单时 `GET /athlete-profile` 预填、保存 `PUT`。新增 `athlete-profile-api`（含纯 `parseInjuryTags` + 单测）；`http-client` method 联合补 `PUT`。
  - **FE-4 — faithfulness 徽章 + 限流友好提示（Slice 1+6）　✅ 2026-06-14**：FE-4a 助手消息头渲染 faithfulness 徽章（`structured_output.faithfulness` → message.faithfulness，verified="✓ 数据已核对"/flagged="⚠ N 处待核"）。FE-4b 限流友好文案：`use-assistant-chat` 把 `RATE_LIMITED`/`AI_QUOTA_EXCEEDED` 映射成中文提示（带 retry_after_seconds），`AssistantChatPanel` 错误提示改为展示真实 errorMessage。
  - 已知局限（与用户共识）：~~非点名动作无重量目标（"沿用上次重量"，需周报回传单动作最高重量的后端小增强）~~ **✅ 2026-06-17 由 Slice 3.1 修复**；计划是扁平周目标、未按训练日拆分（day-split 是更大的后端改动，暂不做）。

- **Slice 3.1 — 周报回传单动作最高重量（补 Slice 3 局限）　✅ 2026-06-17 完成**
  - 目标：让非 focus 的 top 动作也能给出具体目标重量，而不是恒为 null。
  - 落地：`training-summary` 的 `by_exercise` 聚合 SQL 增 `max_weight_kg` + Epley `estimated_1rm_kg`（与单动作进展同款规则）→ 周报 `top_exercises` 透传 → agent `buildGeneratorInput` 读进每个 top 动作 → 生成器把 focus/非 focus 的重量推导统一成共享 `buildPlannedExercise`（有 1RM 用 1RM×强度%、退化到 max、再无则 null）。顺手修掉自重 0 基线会显示 `target 0kg` 的旧行为。计划重量仍只挂 `structured_output.plan`、不进答案文本（守 faithfulness）。决策见 `ai-decisions.md` D27。
  - 价值：产品↑（闭环更实，非点名动作也有可执行目标重量）｜成本：低｜依赖：Slice 3。
  - 已知局限：前端把非 focus 动作的具体目标重量渲染出来仍待前端片（卡片已支持 null/数值两态，数据现在带上了）；估算 1RM 用组内 Epley 最大值，仅作起始重量参考。

- **Slice 6 — 可观测 + 配额落实　✅ 2026-06-14 完成（2 批）**
  - 每轮延迟 / 步骤耗时 / 调用计数；落实 AGENTS §7.3 承诺的 50 次/天 + 每分钟限流；token 成本待接真实模型。
  - 落地：Batch A 每轮可观测（`assistant-turn-observability.ts`：intent/总延迟/工具数+耗时/faithfulness 状态/agent 步数/有无 plan，单行结构化 JSON，两个 turn controller 各一处接入）；Batch B AI 限流（`ai-rate-limiter.ts` 纯固定窗口 20/分→`RATE_LIMITED`、50/天→`AI_QUOTA_EXCEEDED`，注入 store+clock 可单测；`ai-rate-limit-middleware.ts` 挂在 mock-turn / stream-turn 两个 AI 端点）。token 成本待 Slice 7 接真实模型。决策见 `ai-decisions.md` D25。
  - 价值：运维 / AI 面试↑｜成本：低｜依赖：token 成本部分待 Slice 7。
  - 已知限制：限流为单进程内存计数，多实例/Serverless 各自计数；分布式需 Redis/DB 计数（接口 seam 不变）。

- **Slice 7 — provider seam 审计 + 决策文档　✅ 2026-06-17 完成（纯文档）**
  - 核对 provider 抽象足够干净（换模型只动一层）；在 `ai-decisions.md` 记："为何因成本暂用 Groq 免费、接真实大模型会变什么"——流式 token 计费、prompt caching 经济学、faithfulness 校验/eval 变得更必要（真实模型会编造，mock 不会）、延迟/成本遥测、降级链。
  - 落地：审计三处接缝（助手轮 `AssistantProvider`/adapter、录入解析 `WorkoutIntakeLlmRawParser` 工厂、RAG `voyage-embedding-client`），结论是三处都「换模型只动一层」成立；记录 3 个接缝气味为后续片（A 助手轮缺 Groq 免费 provider、B 模型 id+api version 硬编码且两处重复、C「流式」实为 SSE 推确定性步骤而非 token 级流式）。决策见 `ai-decisions.md` D28。纯文档，零代码改动。
  - 价值：AI 面试↑｜成本：极低（文档为主）｜依赖：无。
  - 后续：接真实模型那一片按 D28「会变维度」清单逐项落地，并可顺手清掉气味 A/B/C。

- **Slice 8 — 主动周报推送**（定时任务 + PWA 通知）：留存 / agent 主动性。🟢
- **Slice 9 — MCP Server（原 6.1）**：确定性工具暴露给 Claude Desktop。面试话题强、产品价值低（诚实标注为面试彩蛋）。⚪
- **Slice 10 — 安全分类器**（疼痛 / 医疗边界 → 安全路由）：责任 AI；依赖 Slice 4 的伤病字段。⚪

> 接手提示：每片开工先读 `AGENTS.md`，再读该片涉及的领域文档（Slice 1/2 主要是 `ai-decisions.md` + `assistant-*`/`agent` 代码；Slice 3-5 涉及 `db-schema.md` / `api-contract.md` / `UI_SPEC.md`）。每片完成更新 `progress.md` 并把本节对应 Slice 标进度。
