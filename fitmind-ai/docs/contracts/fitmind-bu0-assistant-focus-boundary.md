# fitmind-bu0 — assistant 训练部位纯规则边界合同

contract SHA：本文档首次提交所在的 commit；提交后记录到 Beads，后续 characterization 与 candidate 不得修改。

baseline SHA：`869d3c1`

characterization SHA：开工前为空；必须早于 extraction candidate。

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/server/src/services/assistant/assistant-orchestrator-service.ts`
- `fitmind-ai/server/src/services/assistant/assistant-focus-area.ts`
- `fitmind-ai/server/src/services/assistant/assistant-focus-area.test.ts`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/contracts/fitmind-bu0-assistant-focus-boundary.md`

开工前已存在且明确排除的工作树改动：

- `fitmind-ai/deploy/README.md`
- `fitmind-ai/deploy/compose.yaml`
- `fitmind-ai/deploy/scripts/deploy.sh`
- `fitmind-ai/server/src/app.test.ts`
- `fitmind-ai/server/src/routes/health.ts`

## 冻结事实与两阶段策略

1. 运行 `Get-Content assistant-orchestrator-service.ts | Measure-Object -Line` 的等价逐行计数得到 2710 行；`rg` 在 2576、2609、2639、2656、2678 行发现 5 个目标函数。行数只描述基线，不作为完成判据。
2. 目标是 `inferDominantFocusArea`、`inferFocusAreaFromName`、`resolveNextFocusSuggestion`、`detectTargetArea`、`describeTargetArea`，以及它们使用的 `FocusArea` 类型。它们只依赖字符串、数字、数组和局部类型，没有 provider、数据库、工具、环境或时间依赖。
3. 第一阶段只导出这 5 个函数和类型，并新增 `assistant-focus-area.ts` re-export facade；`assistant-focus-area.test.ts` 只从 facade 导入。测试通过后单独形成 characterization commit。
4. 第二阶段把完全相同的类型和函数体移入 facade，orchestrator 反向导入；最终 characterization 测试 blob 到 candidate 必须完全相同。测试允许拆分前或拆分后的单向依赖，但拒绝双定义和循环依赖。
5. 本批不抽 metric/date helper，不改回答模板、意图路由、provider、工具、持久化、telemetry 或上述 5 个排除文件。

## 判据

判据 1：机器 · 拆分前 characterization 覆盖名称推断的 chest/back/legs/shoulders/unknown，且显式固定 `bench press` 先命中 chest、`deadlift` 先命中 back。

- 度量：运行 `pnpm --filter @fitmind/server test -- src/services/assistant/assistant-focus-area.test.ts`，对应断言全部通过。
- 已知假绿：只测每类一个无重叠词，会漏掉正则顺序被改写；因此必须包含两个重叠词。

判据 2：机器 · 消息检测覆盖真实中文简称、英文命中、邻域反例与无覆盖话题；不得因共享“推/拉/训练”等普通字误判。

- 度量：同一测试文件至少包含胸、背、腿、肩、unknown 五类，以及“模型训练”“女朋友生气”两条邻域反例。
- 已知假绿：只有完整健身句正例，无法证明自由输入不会误路由。

判据 3：机器 · dominant 规则覆盖空数组、单一优势、top/second 小于 1.25 的 mixed，以及恰好 1.25 时不 mixed；累计使用 `total_volume`，不是次数。

- 度量：同一测试对四种输入逐项断言，并用相同动作名的多行累计证明求和。
- 已知假绿：只测明显 10:1 优势，`<` 被改成 `<=` 或按次数计数仍会通过。

判据 4：机器 · 6 个 `FocusArea` 值（chest/back/legs/shoulders/mixed/unknown）的 suggestion 与 description 文案逐项固定。

- 度量：对两个函数各运行一个覆盖全部 6 值的参数表，比较精确字符串。
- 已知假绿：只断言返回非空字符串，任何文案漂移都会假绿。

判据 5：机器 · characterization 与 candidate 中运行时导出集合精确为 5 个函数；5 个函数在两个源文件合计各只有一个定义，并且两个模块恰有一个方向依赖。

- 度量：测试读取两个源文件，逐函数统计 `export function <name>` 总数等于 1；统计两条相互 import/re-export 边为 1；`Object.keys(module).sort()` 精确比较 5 项。
- 已知假绿：只检查新文件存在，复制实现、保留旧实现或形成循环依赖都可通过。

判据 6：机器 · candidate 的 `assistant-focus-area.test.ts` blob 与最终 characterization SHA 中的 blob 相同；不能拆分后修改 fixture、断言或期望值。

- 度量：分别运行 `git rev-parse <characterization>:<test-path>` 与 `git rev-parse <candidate>:<test-path>`，两值必须完全相同。
- 已知假绿：只比较测试数量，执行者可保留数量同时弱化内容。

判据 7：机器 · 定向测试、所有现有 assistant 测试、`pnpm verify` 和 server production build 全部 exit 0。

- 度量：依次运行定向 Vitest、`pnpm verify`、`pnpm --filter @fitmind/server build`；报告本次实际测试文件数与断言数。
- 已知假绿：只运行新测试无法覆盖 orchestrator 的真实消费路径；只 type-check 也无法证明文案与路由行为。

判据 8：机器 + 人工 · candidate 只包含允许文件，合同未变，排除文件不进入本批 commit；正则文本与顺序、Map 初始化顺序、累计、排序、零分支、`top / second < 1.25` 和中文文案逐字保持。

- 度量：用 `git diff --name-only <baseline>..<candidate>`、`git ls-files --others --exclude-standard` 与允许列表逐项比较；用 `git diff <characterization>..<candidate> -- <contract> <test>` 证明两者无变化，再人工审查实现移动 diff。
- 已知假绿：工作树 diff 混入开工前已有改动，会把他人的部署/health 工作错误归入本批。

## 冲突与限定词检查

冲突检查：已通过。本地 contract、characterization、candidate commit 已获用户授权；push、部署仍未授权。排除文件保持未暂存、未提交。

限定词：

- “5 个函数”只指本合同逐名列出的集合，运行时来源是 baseline 的 `rg` 结果。
- “唯一所有者”指两个允许的生产源文件中 `export function` 定义总数为 1，不限制测试引用。
- “全部现有 assistant 测试”指本次运行时 Vitest 实际发现的 `server/src/services/assistant/**/*.test.ts` 集合，数量以命令输出为准。
- 本批完成只证明一个纯规则边界被抽出，不代表 2710 行 orchestrator 的 provider、tool、answer、session 或 planning 边界已经完成。
