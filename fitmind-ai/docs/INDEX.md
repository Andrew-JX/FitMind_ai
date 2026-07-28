# 文档索引（INDEX.md）

> 按**"我想干什么"**组织，不按文件名罗列。先在这里定位，再只读需要的那一份 —— 全部文档合计约 1.4 万行，不要通读。

## 我要动代码

| 我要做的事 | 先读 | 为什么 |
| --- | --- | --- |
| 写/改任何前端组件 | [`UI_SPEC.md`](./UI_SPEC.md) | UI 唯一权威，源自设计交接稿。**动手前必读**（`AGENTS.md` 规则） |
| 改前端但怕破坏既有行为 | [`frontend-current-state.md`](./frontend-current-state.md) §2 | 不可破坏的契约、状态机、联动，以及诚实性条款 |
| 加/改 API 端点 | [`api-contract.md`](./api-contract.md) | 契约之记录。有测试门禁：路由与文档不一致会红（`server/src/routes/api-contract.test.ts`） |
| 改数据库 | [`db-schema.md`](./db-schema.md) | 表结构与关系 |
| 改确定性计算（容量/依从度/肌群权重） | [`calculation-layer.md`](./calculation-layer.md) | 公式与口径。改口径等于改所有历史数字的含义 |
| 改助手编排 / 工具 / RAG | [`architecture.md`](./architecture.md) + [`ai-decisions.md`](./ai-decisions.md) | 前者是结构，后者是"为什么这么定"的决策记录 |
| 本地跑起来 | [`local-run-guide.md`](./local-run-guide.md) | 含 demo 账号与种子数据 |
| 跑不起来 | [`troubleshooting.md`](./troubleshooting.md) | 已踩过的坑 |

## 我要了解这个项目

| 目的 | 读 |
| --- | --- |
| 30 秒知道这是什么 | [`PROJECT_BRIEF.md`](./PROJECT_BRIEF.md) |
| 系统怎么搭的 | [`architecture.md`](./architecture.md) |
| 演示给别人看 | [`demo-script.md`](./demo-script.md) |
| 系统性学习整个项目 | [`project-study-guide.md`](./project-study-guide.md) |

## 我要知道下一步做什么

| 目的 | 读 |
| --- | --- |
| 待办与优先级 | [`roadmap.md`](./roadmap.md) |
| 已经做了什么（当前季度） | [`progress.md`](./progress.md) |
| 更早的批次记录 | [`archive/`](./archive/) 下的 `progress-<年>-Q<季>.md` |

**进行中的弧线**（每份都是可执行规格，含批次拆分与审查清单）：

- [`er-arc-plan.md`](./er-arc-plan.md) — 助手实体解析（动作/日期/拒答文案）。ER-1 已封板，ER-1C 起待做
- [`assistant-usability-plan.md`](./assistant-usability-plan.md) — 计划卡生命周期。PL-1/PL-3 已完成，PL-2 休眠，PL-4 待做
- [`ar-arc-plan.md`](./ar-arc-plan.md) — 让 AI 真实活过来 + 成本护栏。AR-0/1/2 已封板
- [`color-token-consolidation-plan.md`](./color-token-consolidation-plan.md) — 色值 token 收口。已完成，留作分类依据

## 我要上线 / 排查线上

| 目的 | 读 |
| --- | --- |
| 上线前自查 | [`production-smoke-checklist.md`](./production-smoke-checklist.md) |
| AR-2 的回滚路径 | [`archive/ar-2-flip-checklist.md`](./archive/ar-2-flip-checklist.md) |

## 这些文档为什么会烂，以及怎么防

2026-07-27 一次性修了三份**互不相干但烂法完全相同**的文档，值得记住这个模式：

> 某时刻写下快照 → 后续变化以"增量"追加在文末 → **旧内容从不撤下** → 文档同时包含正确的新内容和错误的旧内容，而读者无法分辨。

三个案例的严重度递增：

1. `ar-2-flip-checklist.md` 状态行写着"尚未执行"，实际已于 2026-07-16 上线 —— 只是过期。
2. `api-contract.md` 有 **9 个从未实现的端点**（含标着"重点"的 `/api/chat`），同时**漏记了分析 Tab 全靠的 3 个真实端点** —— 把人指向 404。
3. `frontend-current-state.md` §10 被 `UI_SPEC §8` 当作权威约束清单引用，里面写着"不得把 token 写入 cookie"，而现状正是 HttpOnly cookie 会话 —— **会让人动手去"修"正确的实现**。

已建立的三道门禁（都演示过会拦，不是摆设）：

- **API 契约**：`server/src/routes/api-contract.test.ts` 双向断言路由与文档一致。
- **色值 token**：ESLint `no-restricted-syntax` 禁止 `client/src` 内出现品牌色字面量。
- **编辑原则**：`frontend-current-state.md` 顶部声明它**不镜像代码** —— 镜像代码的文档必然再烂一次。

写文档时的判据：**这句话代码能不能自己说清楚？** 能，就别写；不能（决策理由、口径约束、踩过的坑），才值得写。
