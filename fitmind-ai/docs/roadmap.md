# FitMind AI 路线图（roadmap.md）

> 前瞻文档：记录"接下来要做什么"。与 `docs/progress.md`（回顾，逐批次记录已做的事）配成一对。
> 阶段编号沿用 `PROJECT_BRIEF.md §7` 与 `docs/progress.md` 的 Phase 体系。
>
> Last updated: 2026-08-10

---

## 1. 现状速览（截至 2026-08-10）

主线 100% + RAG 扩展 100% + 一层产品化已上线：<https://fitmind-ai-psi.vercel.app/>

已完成（对照 `PROJECT_BRIEF.md §7`）：

- 阶段 0–5 主线：训练日志 CRUD、确定性计算层（summary / exercise-progress / muscle-load / recommendation-context）、Tool Calling 循环、SSE + 前端四态状态机、结构化输出 + Evidence/Sources 卡片。
- 扩展 A（RAG）：DB 知识 chunk + Voyage `voyage-4-lite` + pgvector + 混合打分 + 确定性 eval。
- 计划外产品化：自然语言 / 语音训练录入（LLM 结构化兜底）、PWA + 移动端打磨、动作详情与历史、教练化（周报 / 平台期诊断 / 下周计划）、收藏洞察、产品反馈。
- FitMind UI 优化：语音 / 文本 / 手动三类录入，历史 / 分析双视图与训练月历，个人页经期记录、身体数据、RM 计算器和训练备忘录。腾讯云邀请制实例已经上线，但新个人工具版本尚需按迁移优先顺序更新。

尚未完成（本路线图的目标）：

- 扩展 B（MCP Server）——刻意推迟，未做。
- 扩展 C（多步 ReAct 训练计划）——只做了单轮版本，缺多步循环 + trace 可视化。
- 打磨阶段——`§11` 性能精确数字未回填（主观达标）。
- ~~语音录入"记录页内"入口 + 手势 FAB~~ ✅ 2026-06-13 完成（待办 B，见 §1.5 / `progress.md`）。
- **发布硬化 P0**：个人工具迁移与 repository 已在专用本地 PostgreSQL 通过真实 SQL 持久化验收，13 个端点已过 Express HTTP 契约测试；剩余门禁是发布时在目标 Neon 执行迁移与 live smoke。Vercel 迁移必须在 `main` push 前执行，腾讯云必须通过目标库身份检查。
- **发布硬化 P1**：把每次 repository 调用新建 / 销毁 `pg.Pool` 改成进程级共享池，并为 Neon 连接上限建立可观测指标。
- **维护性 P2**：拆分 `BodyMeasurementsView` 与 `WorkoutCalendar`；个人工具上线稳定后删除仅用于迁移窗口的 `42P01` 兼容分支。
- **隐私卫生决策**：当前 `design-qa.md` 已移除微信内部账号路径；远端旧提交仍含历史路径。只有仓库确定公开且协作者同意时才单独评估历史重写，不能把 force-push 混进普通功能修复。

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
- **E. Prettier 格式欠债（~118 文件）** ✅ 2026-07-04 完成
  - 已用 formatting-only 豁免批执行 `npx prettier --write .`，并加 `.gitattributes` + `git add --renormalize .` 一次性清理格式与行尾欠债；从 T1 起 `pnpm format:check` 全仓绿是常规硬门禁。
- **F. 中期方向**：Phase 6.0 多步 Agent、6.1 MCP（见下）。
- **G. 助手自然语言日期范围解析 → ER-2（计划已批准，待 ER-1 完成后实施）**：已纳入 [`ER 助手实体解析弧线`](./er-arc-plan.md)。设备时区、周起始日=周日、显式日期优先级、精确 range eval、无法识别时间词的诚实默认范围均在 ER-2 固定；当前线上仍只保证回答与实际 `result.range` 一致。
- **H. ER-1C 排查文本解析路径的 Evidence 空卡片**：线上观察到自由文本动作解析成功后，Evidence 卡片可能渲染 4 个空 bullet。优先检查客户端 `assistant-structured-output` 到消息 Evidence 字段的映射与历史消息归一化；本项不属于服务端重量精度修复，纳入 ER-1C 单独复现、测试和修复。

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

**2026-06-20 更新**：§8 Slice 1–7 + 前端 FE-1~4 均已落地，产品功能层已相对完整。下一档推荐主线是 **§8.1 理解层升级（real-LLM seam）**——把对话路由 / 录入解析这两个"听懂用户"的环节从死正则换成真实（免费 Groq）模型，同时治"对话死板"和"录入变组识别不了"两个长期体验痛点，并让 Slice 1/2 护栏真正承重。建议顺序见 §8.1 末。

---

## 8. 产品蓝图 backlog（ROI 排序，2026-06-14 与用户共定）

> 定位锚点：本产品的核心论点是「证据绑定、确定性、不是套壳 ChatGPT 的 AI 教练」。下面每一片都要么**强化这条论点**，要么**合上产品闭环**，且成本可控、面试能讲（PM + AI 应用开发两边都顾）。
>
> 共识约束：
> - 两类岗位**均衡**：Track 1（AI 工程：评估/护栏/可观测）与 Track 2（产品：闭环/目标/留存）交替推进。
> - **默认仍用 mock/Groq 免费 provider**，但已支持 ENV 级 OpenAI-compatible BYO（DeepSeek / Qwen / Kimi / OpenAI 等；见 Slice 7.1 / D43）。每用户密钥 UI/存储等到多用户需求出现再做。
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
  - 后续：前端「接受计划」按钮 + 依从度卡片；✅ 2026-06-30：依从度已可 opt-in 纳入 agent 上下文（下次规划参考上次依从）。

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

- **Slice 7.1 — ENV 级 OpenAI-compatible BYO 模型　✅ 2026-07-01 完成（Tier 1）**
  - 落地：新增 `openai_compatible` provider，助手（工具选择 / 意图救场 / summary phrasing）和录入解析共享 `OPENAI_COMPAT_BASE_URL` / `OPENAI_COMPAT_MODEL` / `OPENAI_COMPAT_API_KEY`；Groq 被收编为 OpenAI-compatible preset，通用 client/provider 已重命名为 `openai-compatible-*`；telemetry provider/model 来自实际调用，未知 BYO 模型成本为 `null`。决策见 `ai-decisions.md` D43。
  - 边界：语音 STT 仍是浏览器 Web Speech API；RAG embedding、Anthropic 原生 schema、每用户密钥 UI/存储不做。
  - **Tier 2 backlog**：每用户 BYO 设置 UI + 加密密钥存储，门槛=出现多用户需求。安全要求：密钥加密存储、永不回传/打日志/串户、tenant isolation、用户输入 URL 的 SSRF allowlist、限流、连接校验 UX、密钥脱敏显示和审计。

- **Slice 8 — 主动周报推送**（定时任务 + PWA 通知）：留存 / agent 主动性。🟢
- ~~**Slice 9 — MCP Server（原 6.1）**：确定性工具暴露给 Claude Desktop。~~　**❌ 取消（2026-06-30）**：纯产品镜头下产品价值低、不再考虑面试镜头，故砍掉，不做。
- **Slice 10 — 安全分类器**（疼痛 / 医疗边界 → 安全路由）：责任 AI；依赖 Slice 4 的伤病字段。✅ 2026-06-29（D41）

---

### 8.1 理解层升级（real-LLM seam）— 2026-06-20 与用户共定方向

> **诊断（实地走查 + 代码核对得出）**：FitMind 的链路是「理解层（听懂用户）→ 确定性工具/计算 → faithfulness 校验 → 回答」。后三段（计算·证据·护栏）扎实，是底牌。两个长期体验痛点其实**同根**——理解层目前没有真实模型，是写死的关键词正则：
> - **对话死板**：`assistant-intent-router.ts` 的 `classifyAssistantIntent` 是 `/进步|停滞|平台/` 一类正则，**匹配不上即 `unsupported`**。且路由在 provider 之前，**换不换真实 provider 都不解决**——模型没机会理解意图。
> - **录入变组识别不了**：`workout-intake-parser.ts` 规则解析要求固定措辞/语序；"每组不同重量"换个说法（"做了/加到"）就断。hybrid 的 LLM 兜底（`workout-intake-hybrid-parser.ts` `shouldUseLlmFallback`）**只在规则解析'什么都没解出来'时触发**，规则"自信解错成均匀组"时不兜底，用户静默拿到错值。
>
> **共识**：接缝已全部就绪（见 D28 审计：provider 适配器支持 tool_use；LLM 录入 schema 本就支持每组不同重量；hybrid 兜底框架在）。下一档价值不在加功能，而在**把理解层从死正则换成真实（免费 Groq）模型，保留确定性工具 + faithfulness 当缰绳**。这一跳同时治两个痛点，并把 Slice 1/2 的护栏从"mock 不编造所以闲置"变成"真实模型会编造所以承重"——也是面试最强叙事（"我用确定性工具 + faithfulness 把模型拴住"）。与 Phase 7.0（泛指的"接真实流式 Anthropic"）的关系：8.1 是其**具体化、免费优先、先攻路由层**的落地版，按 D28 的"会变维度"清单推进。

- **Slice 11 — Groq 真实模型接入意图路由 + 工具选择（理解层核心，治"对话死板"）　🟠 高 ROI / 中风险**
  - 做什么：补 Groq 助手 provider（D28 气味 A），让模型基于 `allowed_tools` 做意图路由 + 选确定性工具（适配器 `ensureAllowedTool` 已是防线），答案措辞由模型基于工具输出生成；正则分类器降级为"快路径/离线 eval 基线"，不再是唯一裁决。faithfulness（D21）+ eval（D22）作为承重护栏验证。
  - 价值：产品↑↑↑ / AI 面试↑↑↑｜成本：中（Groq 免费，但要 prompt 设计 + 护栏验证 + 可能的延迟）｜依赖：D28 接缝、Slice 1/2 护栏。
  - 风险：模型路由错调工具 / 编造 → 靠 `ensureAllowedTool` + faithfulness 标注 + eval 回归门禁兜底；需扩 eval 数据集覆盖"自由表达"。先 mock 与 Groq 双跑对比，再灰度。
  - 模型 id 收编（D28 气味 B）顺手做。

- **Slice 12 — 录入鲁棒性：每组不同重量 + 兜底放宽 + 确认 UI（治"变组识别不了"）　🟢 中 ROI / 低风险**
  - 做什么：① 放宽 `shouldUseLlmFallback`——不止"解不出"才上 LLM，"多组但疑似被压成均匀组 / 出现多个权重-次数对却只产出一组"也上；② 确保 `WORKOUT_INTAKE_LLM_PROVIDER=groq` 本地也配（线上已配）；③ 确认 UI（`WorkoutIntakePanel`）确保对"多组不同重量"逐组可编辑——这是兜底安全网，解析不完美也能改对再存；④（次要）规则解析器补"reps 在前 / 每组 RPE 不同"语序变体。
  - 价值：产品↑↑（录入是高频入口，错一次很劝退）｜成本：低｜依赖：无（hybrid + LLM schema 已支持每组不同重量）。

- **Slice 11a — 对话"不死"的纯确定性止血（可先于 Slice 11 抢跑）　🟢 极低成本 / 零风险**
  - 做什么：`unsupported` 不再死给——兜底走一次 RAG 知识检索 + "你是不是想问 X/Y"澄清 + 扩充正则同义词。
  - 价值：体验↑｜成本：极低｜依赖：无。**注意这只是缓解，不是根治**（根治是 Slice 11）。

- **建议顺序（ROI×风险）**：Slice 12（小、稳、高频痛点）→ Slice 11a（极便宜止血）→ Slice 11（质变，但要 Groq key + 护栏验证，单独认真做一片）。Slice 8/9/10 维持原优先级，按需穿插。

---

### 8.2 优化总 Slice（执行总路线，2026-06-20 与用户共定）

> 一次看清后续全序列。**常设规则**：① **UI 打磨放最后**（Phase E）；② **但优化过程中发现"致命" UI 问题（阻断核心流程 / 误导数据 / 明显坏体验）立即提前改，不排队**（如 2026-06-17 已修的浮点 1RM、「本月 vs 30 天」属此类）；③ 每片开工先读 `AGENTS.md` + 相关领域文档，先出实现计划等用户确认再写；④ 一次只动一片，守"单次 ≤ 5 代码文件 + 文档同步"。

| 阶段 | Slice | 内容 | 依赖 | 状态 |
| --- | --- | --- | --- | --- |
| **A 鲁棒性打底**（真实模型前先把高频入口/对话稳住，低风险） | A1 = **Slice 12** | 录入鲁棒性：放宽 hybrid LLM 兜底触发（变组被压扁→升级 LLM，D30）。确认 UI 已逐组可编辑、无需改 | 无 | ✅ 2026-06-20（变组兜底 + 2 单测；变组解析靠生产 Groq，本地 mock 不产变组） |
| | A2 = **Slice 11a** | 对话"不死"纯确定性止血：`unsupported` 分流——越界保持拒答；带训练锚点（tokenize 闸门）走 RAG 兜底→知识答，否则澄清。决策见 D32 | 无 | ✅ 2026-06-21（兜底 + 4 单测；前端粘 mode bug 已修；**A+B 修订 D33：回退过宽词表 + 知识相关性下限，消除"自信错答"**） |
| | A3 = 稳定性体检 + A/B 止血 | 体检发现 3 类问题（路由双轨 / 无相关性下限 / RAG 抖动）；本批先做 B 类止血（回退扩词 + `filterRelevantKnowledgeChunks` 词法重叠下限），把"自信错答"→"诚实没资料"。①路由双轨 ③向量召回非确定 留 Slice 11。决策见 D33 | 无 | ✅ 2026-06-21 |
| **B 理解层质变**（核心一跳，计划见 §8.3） | B1 = **Slice 11** | 接 Groq 真实模型做意图路由 + 工具选择 + 措辞；正则分类器降级为快路径/eval 基线；faithfulness(D21)+eval(D22) 当承重护栏 | D28 接缝、Slice 1/2 护栏、Groq key | 🟠 进行中：**11.1 接缝 ✅ 06-21（D34）**；**11.2a 数据意图必出工具 ✅ 06-22（D35，治①）**；**11.2b LLM 自由表达路由 ✅ 06-22（D36，关键词优先+Groq 救场，待切 prod groq 生效）**；**11.3a 收敛单轨路由 ✅ 06-22（D38）**；**11.3b summary 措辞 ✅ 06-23（D39，env 默认 off）**；**token/成本 observability ✅ 06-23（C1/D40）** |
| **C 真实模型后的增强**（全部依赖 B1） | C1 | tracing + LangSmith eval（选择性，独立 SDK 不引 LangChain；trace 去 PII） | B1 | 🟠 **token/成本 observability ✅ 2026-06-23（D40）**：三处 Groq 调用（意图救场+工具选择+措辞）的 usage 经共享 client 聚合进 `assistant_turn` 日志（`llm_attempt/usage_report/error_count` + provider/model + 按模型计价、未知→null），走**服务端 telemetry 信封**不进公开 DTO，失败 turn 也落日志；**LangSmith 外部 tracing 待做**（需新依赖 + key + PII 去除，单独评估）。见 D29 |
| | C2 | retriever 接口可换性 + RAG reranking（原 Phase 7.0 + D29）；in-process Voyage rerank 默认 off，eval 用确定性 fixture reranker，不进 live API；决策见 D45 | B1 | ✅ 2026-07-01 |
| | C3 = **Slice 10** | 安全分类器（疼痛/医疗边界→安全路由）；真实模型能自由表达后，安全路由的必要性才真正抬升 | B1、Slice 4 伤病字段 | ✅ 2026-06-29：确定性 pre-routing gate（急性/模糊疼痛、红旗症状、诊断/治疗/用药请求→安全模板），服务端 telemetry 标记，不进公开 DTO；见 D41 |
| **D 叙事 / 彩蛋**（面试向，按需） | ~~D1 = Slice 9~~ | ~~MCP Server~~ | 无 | ❌ 取消 2026-06-30（纯产品镜头、价值低，不做） |
| | D2 = **Slice 8** | 主动周报推送（定时任务 + PWA 通知） | 无 | 🟢 |
| **E 收尾**（UI 最后） | E1 | `frontend-current-state.md §1–12` 全量重写到现状（大修，已加止血横幅） | 无 | ✅ 2026-07-27：542→82 行。删掉 2026-05-07 快照（§1–12）与已废止的 §9/§11/§12；§10 不只是过时而是**有害**（要求"不得把 token 写 cookie"，与 D19 的 cookie 会话直接冲突，而 `UI_SPEC §8` 正引用它当权威），已重写为仍成立的约束 + 诚实性条款；保留增量决策记录。文档改为只记"代码看不出来的东西"，不再镜像代码 |
| | E2 | UI 打磨：系统性走查空/错/加载态 + 边界数据（零数据 / 超长名 / 断网），统一体验 | 视前序改动 | ⚪ |

> **坚决保留自研、不让框架替换**（D29）：agent harness（不上 LangGraph）、structured output（provider 原生 + faithfulness）、核心 eval（`assistant-eval.ts` 当承重护栏，LangSmith 只做增强 UI）。这是"证据绑定、确定性"差异化的护城河。

---

### 8.3 Slice 11 实现计划（草案，2026-06-21，待用户确认后再写代码）

> 目标：把"理解层"从死正则换成真实（免费 Groq）LLM 做**意图路由 + 工具选择 + 措辞**，并**收敛路由双轨**（体检问题 ①：classify vs mock-provider 各判各的，"今天适合练什么"路由对却不被接住）。**数字与结论仍只来自确定性工具 + faithfulness 校验**——模型只负责"听懂 + 选工具 + 说话"，不产出数据。这是把 Slice 1/2 护栏从闲置变承重的一跳。

**设计原则（安全边界）**
- 模型**不产出用户可见数字**：所有数值/结论来自确定性工具输出，faithfulness（D21）运行时校验，编造即标注。
- 模型路由/选工具**必须落在已知集合**：返回非法 intent / 不在 `allowed_tools` 的工具 → `ensureAllowedTool` 拒绝 + **回退确定性 classify**。永不因模型故障而崩或乱答。
- **全程可回退**：用 env 开关（`ASSISTANT_PROVIDER` + 路由开关）一键切回 mock/确定性。
- **eval 门禁先行**：扩 golden 覆盖"自由表达"（同义改写），mock 与 Groq 双跑对比，回归非零退出。

**分阶段（每阶段 ≤5 代码文件、各自可回退、各自过门禁）**

- **11.1 Groq 助手 provider（建接缝，零行为变更）　✅ 2026-06-21 完成（D34）**
  - 新增 `groq-assistant-provider.ts`（OpenAI 兼容 `chat/completions` + `tools`/`tool_choice`，zod 校验，异常→`GROQ_PROVIDER_ERROR`）；`provider-config` 加 `getGroqAssistantProviderConfig`（模型 `GROQ_MODEL` 默认 `llama-3.3-70b-versatile`，env 可配）；`provider-adapter` switch 加 groq；`env.ts` enum/类型 + `assistant-stream-types` 事件类型加 groq。
  - 默认仍 `mock`，**零用户可见行为变更**；5 例 mock-fetch 单测。门禁全绿（type-check / test:unit 281 / eval）。
  - 顺带：新 provider 模型 id 从一开始 env 可配（不重蹈 D28 气味 B）；旧 anthropic 硬编码 id 未收编（留后续）；客户端 `provider_selected` 接受 `groq` 的类型放宽留 11.2（默认 mock 暂不会发 groq）。
- **11.2a provider 路径"数据意图必出工具"安全网　✅ 2026-06-22 完成（D35）**
  - 治体检问题①："今天适合练什么"等数据 intent 不再退化成 mock-provider 的泛泛 prose。新增纯函数 `coerceMessageToEvidenceToolCall`：provider 返回 message（没调工具）→ 兜底跑该 mode 默认工具。**确定性、provider 无关**——mock 下①即被治好,groq 下作兜底网,让"启用 groq"安全。+4 单测;顺带更正一条过时 smoke 断言。门禁全绿（type-check / 285 单测 / eval）。
  - 注意：① 已在 mock 上修好;切 groq 的真正增量在 11.2b（自由表达路由）。
- **11.2b LLM 路由（关键词优先 + 落空 Groq 救场）　✅ 2026-06-22 完成（D36）**
  - `resolveRoutedIntent` 改 async：关键词确信命中直接用（13 条 eval 不动、无延迟）;**只在落空**时调 Groq 受限分类（已知集合内选一）+ 校验 + 失败回退 unsupported。越界仍拒答;mock 下 router=null 行为不变。新增 `llm-intent-router.ts`（任何失败→null）;router 可注入。客户端 `provider_selected`/`formatProvider` 放宽到 groq。
  - +11 单测（router mock-fetch + resolve-routed-intent fake-router 逻辑）;门禁全绿（type-check / 296 单测 / eval）。真实自由表达路由质量靠 prod 验证。
  - **prod 切 `ASSISTANT_PROVIDER=groq` 后生效**（救场 + D35 工具选择一起上线）。eval 自由表达"golden"（真实 LLM）非确定,留 opt-in。
  - 遗留：关键词自信误判 LLM 管不到（留 11.3 LLM 主路由）。
- **11.3a 收敛单轨路由　✅ 2026-06-22 完成（D38）**
  - mock 路径不再自分类：`getToolDefinitionForMode` 抽到 `assistant-tool-routing.ts` 作单一 mode→工具映射源，mock provider 改读 `assistant_context.mode`（即 `resolveRoutedIntent` 已解析的 mode），删除 `detectIntentFromMessage`/`resolveIntent` 影子分类器。**全局唯一消息→意图分类器 = `resolveRoutedIntent`**，彻底消除 classify↔mock-provider 双轨。eval 不受影响（直接调 classify / 离线 fixtures，不走 provider）；groq 不受影响；env 一键回退仍在。门禁全绿（type-check / 303 单测 / eval 13·12·3）。
- **11.3b summary 措辞　✅ 2026-06-23 完成（D39，env 默认 off）**
  - 让模型**只改写 `answer.summary`** 的措辞（bullets/conclusion/recommendation/evidence/sources 保持确定性）。双门控 `ASSISTANT_PHRASING=on` + `ASSISTANT_PROVIDER=groq`，默认全关 → 零行为变更；运行时 faithfulness 校验改写文本，未验证数字即回退确定性 draft；第二次 LLM 调用任何失败 → 回退 draft，永不破坏本轮。两小批落地（Batch 1 配置+接缝零行为变更；Batch 2 决策纯函数+接线）。门禁全绿（type-check / 311 单测 / eval 13·12·3）。
  - 遗留（11.3b-后续）：conclusion/recommendation 改写、整段对话化。（**token/成本 observability 已完成** —— C1/D40：三处 Groq 调用 usage 经共享 client 聚合进 `assistant_turn` 日志，含失败轮；详见 D40。）

**前置条件（需你确认）**
- **Groq key 在助手轮的 Vercel 后端可读**：你之前配的 `GROQ_API_KEY` 是给"录入解析"那条 seam 的，助手轮要确认同一 key 可用（同一环境变量即可）。
- **模型选型**：默认拟用与录入一致的 `llama-3.3-70b-versatile`（支持 tool calling、免费），可换。
- **成本/限流**：Groq 免费层有每分钟限流；沿用 D25 的 AI 限流 + 失败回退确定性。

**遗留/顺带**：体检问题 ① 在 11.2 收敛路由时一并解决；③ 向量召回非确定属 RAG 层，本片不动（已被 D33 词法过滤遮住可见抖动）。

**验收**：每阶段 type-check/lint/test:unit/eval 全绿；11.2 起新增"自由表达"eval 集；mock vs groq 双跑对比；env 可一键回退；真链路验证（自由提问不再死板、"今天适合练什么"被正确接住）。

> 接手提示：每片开工先读 `AGENTS.md`，再读该片涉及的领域文档（Slice 1/2 主要是 `ai-decisions.md` + `assistant-*`/`agent` 代码；Slice 3-5 涉及 `db-schema.md` / `api-contract.md` / `UI_SPEC.md`）。每片完成更新 `progress.md` 并把本节对应 Slice 标进度。
**2026-07-01 update**: Slice 8 Tier 1 is implemented as scheduled in-app weekly report digests only. Tier 2 remains backlog: per-user opt-in/preferences, notification settings UI, VAPID/Web Push, push subscription storage, service-worker push/notificationclick handlers, permission UX, iOS installed-PWA caveat, unsubscribe/dead-subscription cleanup, and OS-level opt-out.

**2026-07-05 hardening update**: T3 auth endpoint rate limiting is implemented for register/login (`5/min/IP` and `10/min/IP`) using the existing in-memory limiter seam. Follow-up backlog: replace per-instance memory counters with a distributed DB/Redis-backed limiter when traffic or abuse patterns require cross-instance enforcement.

## 9. AR arc - make the AI genuinely live (2026-07-05)

The next arc moves the public demo from "deterministic by default, real provider
available by config" toward "real DeepSeek by default" through the existing
OpenAI-compatible provider. The deployment constraint is strict: AR-2 must not
flip the public default until AR-0 fallback hardening and AR-1 cost/abuse
guardrails are implemented, reviewed, and merged. A public default means every
visitor can create paid calls, so wallet protection ships before the default
changes.

Detailed AR-0/AR-1 implementation design lives in `docs/ar-arc-plan.md`. It is a
pre-decision plan for later D48/D49 work and does not consume a formal decision
number by itself.

Batch order:

1. **AR-0 - provider fallback hardening**: first characterize the current
   provider-error behavior (`502 AI_PROVIDER_ERROR`), then change key-missing,
   HTTP-error, timeout, and malformed-response paths to fall back through the
   deterministic mock/default-tool path. Fallback must be observable in
   telemetry and SSE must finish with `done`, not `error`.
2. **AR-1 - cost and abuse guardrails**: add per-instance daily call/cost
   budgets, a fail-safe real-provider kill-switch, and anonymous/per-IP AI call
   hard limits. Existing per-user AI limits remain. Per-IP or budget block means
   deterministic mock fallback before any real provider request.
3. **AR-2 - public default switch**: after AR-0 and AR-1 are reviewed, switch the
   public demo to `ASSISTANT_PROVIDER=openai_compatible` plus DeepSeek
   `OPENAI_COMPAT_*` env. Codex provides local live validation and a production
   checklist; the user performs the Vercel environment change and deployment.
4. **AR-3 - real end-to-end streaming**: start by splitting the orchestrator
   boundary so streaming can be reasoned about and tested incrementally, then
   wire true real-provider streaming end to end. Do not combine orchestrator
   extraction and streaming behavior changes into one batch.
   - **Boundary-splitting prerequisite ✅ 2026-08-11**: frozen, independently
     tested focus-area, display-metrics, deterministic-answer, and turn-routing
     modules now sit outside the orchestrator. The corresponding training
     composer split owns time logic, save orchestration, and draft-set state;
     neutral AI transport/config/types also removed the temporary
     training-to-assistant dependency.
   - **True provider token streaming ⚪**: still not implemented. Session,
     provider execution, tool/planning lifecycles, and the composer's exercise
     selection/rest-timer UI remain explicit future boundaries; the completed
     split must not be reported as end-to-end streaming.
5. **AR-4 - real-link eval**: add a reviewed live DeepSeek smoke/eval path after
   local real conversations are stable. The committed gate remains deterministic
   and zero-network unless a later review explicitly promotes a live-provider
   check.

AR-2 readiness checklist:

- AR-0 telemetry can distinguish real DeepSeek success from provider-error mock
  fallback, so a broken production key is monitorable instead of silently hidden.
- AR-0 provider-error fallback returns a real deterministic answer from tools and
  faithfulness, not an error wrapper.
- AR-1 budget config fails closed: missing or malformed values keep limits
  enabled rather than allowing unlimited spend.
- Call-count budget remains active even when model pricing is unknown and
  `estimated_cost_usd` is `null`.
- A local DeepSeek run has completed a full conversation plus approved eval smoke
  before the user changes Vercel production env.
