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

5.3（夯实已上线）→ 6.0（多步 Agent，面试杀手锏）→ 6.1（MCP 轻量补充）→ 7.x（按需）。
