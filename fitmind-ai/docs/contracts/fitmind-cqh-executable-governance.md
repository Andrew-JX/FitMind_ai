# fitmind-cqh — 可执行仓库治理契约

contract SHA：本文件首次提交所在的 commit；提交后记录到 Beads，后续 candidate 不得修改。

baseline SHA：`e14c610d8f179601f31a6d96d4d9d06d2571a2a4`

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/AGENTS.md`
- `fitmind-ai/server/src/repo-governance.test.ts`
- `fitmind-ai/docs/production-smoke-checklist.md`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/contracts/fitmind-cqh-executable-governance.md`

## 冻结决策

1. Beads 流程重新启用，不删除：当前修复批次已真实使用 claim、冻结 acceptance 和独立复核关闭边界；团队同步/hook 的生产级验证仍由既有 `fitmind-xbt` 跟踪。
2. 本批只冻结 training → assistant 的两个生产源码例外，不搬代码：
   - `server/src/services/training/workout-intake-llm-parser.ts`：训练录入复用 OpenAI-compatible client/config；
   - `server/src/services/training/assistant-insights-service.ts`：训练洞察 DTO 暂时复用 assistant intent type。
3. 上述例外必须指向结构债阶段的 4.2；本批不抽中立 provider/types 边界。
4. 已上线旧 migration 不补破坏性 `down()`；新增迁移采用 expand/contract，且 migration 必须与上一个应用版本向后兼容，使镜像回滚不因 schema 前进而失效。

## 判据

判据 1：机器 · `AGENTS.md` 的 architecture manifest 中每个目录都真实存在，并至少包含一个非测试、非声明文件的生产源码；不能靠建空目录假绿。

- 度量：`pnpm test:unit -- server/src/repo-governance.test.ts` 解析 manifest marker 内所有反引号目录，递归检查 `.ts/.tsx/.js` 生产文件。
- 负向证明：在内存 manifest 中加入 `client/src/store/` 后必须失败；临时创建空目录不作为验收手段。

判据 2：机器 · AGENTS 不再声明当前不存在的 `client/src/store/`、`client/src/hooks/`、`client/src/types/`、`client/src/utils/`、`client/src/constants/`、`server/src/services/analytics/` 或以空目录冒充架构；不再保留“controller 必须 <30 行”“所有公开函数必须 JSDoc”“每次最多 5 文件”等未经仓库执行的绝对规则。

- 度量：governance test 对这些旧字符串做负向断言，并验证实际 manifest。
- 已知假绿：只重写目录树但在后文继续引用幽灵路径。

判据 3：机器 · production training source 对 `../assistant/` 的反向依赖 importer 集合精确等于冻结的两个文件；AGENTS 对每个文件写明理由和“结构债 4.2”到期点。

- 度量：governance test 递归扫描 `server/src/services/training/**/*.ts`（排除 `*.test.ts`），提取静态 import；实际集合与 allowlist 精确相等。
- 负向证明：向内存结果加入第三个 importer 后校验必须失败；目录级 wildcard allowlist 不算通过。

判据 4：文档 · Beads 决策明确为“重新启用”。用户直接指定的新工作允许规划者创建 issue 并 claim，不强迫从 `bd ready` 改做无关任务；执行者创建的 issue 仍留给独立复核者关闭。progress 记录该选择及 `fitmind-xbt` 剩余边界。

判据 5：文档/机器 · AGENTS 写入 migration expand/contract 硬规则；`production-smoke-checklist.md` 明确询问本次发布是否含破坏性迁移、schema 前进后旧镜像能否运行、若不能其回滚/前滚方案是什么。

- 度量：governance test 同时读取两份文档并断言稳定 marker/关键句存在。
- 负向断言：给已应用 migration 补 `down()`、只写“有回滚”但不检查旧镜像与新 schema 兼容，不算通过。

判据 6：机器 · `pnpm eval` 与 `pnpm verify` 均成功退出。

判据 7：尚不可验证 · 多人 Beads 同步/hook/恢复和真实 destructive migration rollback 演练。

- 缺少条件：本批无第二协作者环境，且用户禁止部署；`fitmind-xbt` 与后续真实回滚演练继续跟踪。

## 冲突与限定词检查

冲突检查：已通过。保留 Beads，但删除其不适用于“用户已指定工作”的绝对表述；冻结例外而不在文档批次重构；不 push、不部署。

限定词：

- “生产源码”排除 `*.test.ts`、`*.test.tsx` 与 `*.d.ts`。
- “production training source”指 `server/src/services/training/` 下排除测试的 TypeScript 文件。
- “上一个应用版本”指当前 release 的直接前驱镜像；expand migration 后它必须能在新 schema 上继续运行/回滚。
- “结构债 4.2”是修复计划中的中立 provider/type 边界抽取，不以把主文件缩短到某行数替代。
