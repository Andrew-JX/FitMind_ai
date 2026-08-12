# fitmind-4zg — Batch 4.2 边界拆分完成审计合同

contract SHA：本文件首次提交所在的 commit；提交后 candidate 不得修改。

baseline SHA：`892af1a75ed381479677b144f374f8e2e88965f2`

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/docs/contracts/fitmind-4zg-batch-4-2-closeout.md`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/roadmap.md`

明确排除 `.beads/interactions.jsonl`；本批只审计并记录已经冻结的候选，不修改 production、测试、workflow 或部署文件。

## 冻结完成边界

Batch 4.2 的完成含义是：两个巨型模块已经把具名业务边界抽到单一所有者，每个边界有自己的测试，拆分前 characterization 在对应 candidate 中逐字节不变；同时清理治理合同中到 4.2 到期的 training → assistant 临时例外。它不表示两个主文件已经完全拆空，也不表示 AR-3 的真实 token streaming 已实现。

本审计枚举以下集合，后续不得用“还有类似模块”等模糊表述扩充或缩减：

| 批次 | 抽出模块 | 自有测试 | contract / characterization / candidate |
| --- | --- | --- | --- |
| `fitmind-bu0` | `assistant-focus-area.ts` | `assistant-focus-area.test.ts` | `515ad6a` / `67d43d9` / `93100d9` |
| `fitmind-6tx` | `assistant-display-metrics.ts` | `assistant-display-metrics.test.ts` | `202ac44` / `dfd60ee` / `8790cfd` |
| `fitmind-gdd` | `assistant-deterministic-answers.ts` | `assistant-deterministic-answers.test.ts` | `5e28076` / `006602f` / `9e229c8` |
| `fitmind-l47` | `assistant-turn-routing.ts` | `assistant-turn-routing.test.ts` | `a09084e` / `0b5439a` / `c51b125` |
| `fitmind-wyj` | `training-time.ts` | `training-time.test.ts` | `e71ba54` / `3e6b754` / `869d3c1` |
| `fitmind-l7y` | `training-session-save.ts` | `training-session-save.test.ts` | `b679afe` / `36b6c00` / `4010f27` |
| `fitmind-wsf` | `training-session-set-state.ts` | `training-session-set-state.test.ts` | `e5c06b6` / `7dbded9` / `dca833e` |
| `fitmind-dlo` | `services/ai/openai-compatible-chat-client.ts`、`openai-compatible-provider-config.ts`、`provider-types.ts` | 三个同名 `.test.ts` | `047e856` / `e4e158b` / `0eccc35` |

主文件当前物理行只作描述：`assistant-orchestrator-service.ts` 为 1803 行，`TrainingSessionComposer.tsx` 为 1473 行；取值算法是 `(Get-Content <path>).Count`。行数不是完成判据。

## 判据

判据 1：机器｜表中每个 module/test 路径都存在；assistant 主链单向消费 routing/answers，answers 单向消费 focus/metrics；Composer 单向消费 time/save/set-state；任一被抽模块不得反向 import 原主文件。

- 度量：枚举表中路径并读取 production import；对每个被抽模块执行 `rg` 搜索原主文件名，结果为空。
- 已知假绿：只证明文件存在，允许空 facade、主文件继续保留算法或形成循环依赖。

判据 2：机器｜表中每批 contract 必须是 characterization 的祖先、characterization 必须是 candidate 的祖先；每个自有测试在 characterization 与 candidate 的 Git blob 必须相等。

- 度量：逐行执行 `git merge-base --is-ancestor` 两次，并对表中测试执行 `git rev-parse <sha>:<path>` 后逐字比较；任一失败即不完成。
- 已知假绿：只比较当前工作树测试，无法证明测试在拆分前已冻结，也会放过 candidate 同时修改断言。

判据 3：机器｜中立 provider/type 到期工作保持成立：production training 对 `../assistant/` 的 importer 集合为空；AGENTS 不含临时 allowlist 或“结构债 4.2”到期文本；三个中立测试满足判据 2。

- 度量：`rg -l 'from ["''][.][.]/assistant/' server/src/services/training -g '*.ts'` 输出为空，并运行 `repo-governance.test.ts`。
- 已知假绿：只删除 AGENTS 文案但 training 仍反向 import assistant，或建立空中立 facade 而生产继续走旧路径。

判据 4：机器｜当前 HEAD 的定向模块测试、根 `pnpm verify`、根 `pnpm eval`、server/client production build 与 release compliance E2E 全部 exit 0；报告本次运行计数。

- 度量：Vitest 精确运行表中测试和 `repo-governance.test.ts`；其余使用仓库脚本。命令绿只证明本地/拦截环境，不证明真实 provider、数据库或部署。
- 已知假绿：只跑抽出模块测试会放过主文件 wiring、治理回退或跨模块回归；只跑 build 不证明行为。

判据 5：机器｜closeout candidate 只能改允许的三个文档路径，合同从 contract commit 到 candidate blob 不变；roadmap 必须把“边界拆分前置”与“真实 streaming”分成已完成/未完成两态，progress 必须枚举证据与剩余边界。

- 度量：`git diff --name-only <baseline>..<candidate>` 与允许清单逐字比较；读取 roadmap/progress 的完成与未完成断言。
- 已知假绿：写“AR-3 完成”会把尚未实现的真实 token streaming 冒充为结构拆分；写“主文件已完全模块化”会掩盖 session/provider/tool/planning 与动作选择/休息计时仍在主文件。

判据 6：尚不可验证｜真实 provider、数据库、生产浏览器和线上部署不属于结构拆分证据。本批完成后按用户指令停止继续重构，进入已授权的 CI、部署和真实回滚演练；这些远端结果必须另行记录，不能倒填为本合同的本地证据。

## 冲突与限定词检查

冲突检查：已通读，无冲突。本地合同/candidate commit 与后续 push/deploy/回滚已获用户授权；production environment approval、GitHub/SSH 凭据与外部状态不能绕过。

限定词：

- “表中每个”只指本合同唯一表格逐行列出的模块/测试集合。
- “当前 HEAD”来自执行验证时 `git rev-parse HEAD`，不是任一旧 candidate。
- “对应 candidate”来自表格同一行的 candidate SHA。
- “完成”只指本节冻结完成边界，不包含真实 streaming 或主文件全部剩余生命周期。
