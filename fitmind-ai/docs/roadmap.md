# FitMind AI 路线图（roadmap.md）

> 前瞻文档：记录"接下来要做什么"。与 `docs/progress.md`（回顾，逐批次记录已做的事）配成一对。
> 阶段编号沿用 `PROJECT_BRIEF.md §7` 与 `docs/progress.md` 的 Phase 体系。
>
> Last updated: 2026-06-11

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
- 打磨阶段——`§11` 性能数字未实测；无浏览器 E2E。
- 生产健壮性欠债——鉴权仍是内存 token（刷新掉线），与 `§10.2` 的生产方案不一致。

---

## 2. Phase 5.3 — 生产健壮性收口　🔴 进行中 / 高优先 / 低风险

把"已上线但欠债"的部分补扎实。建议按批次推进（遵守 AGENTS.md「单次改动 ≤ 5 文件」）：

- **Batch 1 — 鉴权持久化　✅ 已完成（2026-06-11）**：内存 token → HttpOnly + SameSite=Lax cookie 会话，刷新不掉线，兑现 `PROJECT_BRIEF §10.2`。中间件优先 cookie、回退 Bearer（smoke 脚本仍可跑），新增 `POST /api/auth/logout`，前端 `credentials:"include"` + 加载时 `/me` 恢复会话。决策见 `ai-decisions.md` D19。
- **Batch 2 — 浏览器 E2E　✅ 已完成（2026-06-11）**：引入 Playwright（mock 后端，无需 DB/密钥），固化鉴权会话流程（cookie 恢复 / 刷新保持 / 登录 / 登出 / 无会话）为自动化用例，浏览器验证了 Batch 1。`pnpm test:e2e`。训练·分析·助手的全流程 E2E 留作后续。
- **Batch 3 — 性能实测**：补齐 `PROJECT_BRIEF §11` 的 TTFT / Tool 端到端 / 列表加载真实数字，写回 README 与面试稿。

完成标准：刷新不掉线；E2E 主流程绿灯；`§11` 指标有真实测量值。

---

## 3. Phase 6.0 — Agent / 多步 ReAct 训练计划　🟠 中期 / 高面试价值

原计划"扩展 C"。把单轮 next-week-plan 升级为多步 ReAct 循环（查容量 → 找弱项 → 查进展 → 生成计划），并提供 trace 可视化。是项目从 "Tool Calling" 跨到 "Agent" 的关键一跃。

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
