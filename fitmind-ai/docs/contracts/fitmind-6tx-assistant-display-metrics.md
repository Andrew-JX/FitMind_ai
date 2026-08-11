# fitmind-6tx — assistant 显示度量纯逻辑边界合同

contract SHA：本文档首次提交所在的 commit；后续 characterization 与 candidate 不得修改。

baseline SHA：`629ebe9`

characterization SHA：开工前为空；必须早于 extraction candidate。

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/server/src/services/assistant/assistant-orchestrator-service.ts`
- `fitmind-ai/server/src/services/assistant/assistant-display-metrics.ts`
- `fitmind-ai/server/src/services/assistant/assistant-display-metrics.test.ts`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/contracts/fitmind-6tx-assistant-display-metrics.md`

明确排除开工前已有的 `deploy/README.md`、`deploy/compose.yaml`、`deploy/scripts/deploy.sh`、`server/src/app.test.ts`、`server/src/routes/health.ts` 工作树改动。

## 冻结事实与策略

1. baseline 逐行计数为 2595；`rg` 发现私有 `METRIC_WEIGHT_DISPLAY_INCREMENT_KG = 0.5` 位于 499，`formatMetricKg`、`formatPercent`、`getDaysSince` 位于 2580、2594、2598。行号只描述基线，不是完成判据。
2. 第一阶段只导出 3 个 helper，并建立 `assistant-display-metrics.ts` re-export facade 与独立测试；characterization 通过后单独提交。
3. 第二阶段把相同函数体与私有 0.5kg 增量常量移入新模块，orchestrator 反向导入；测试 blob 从最终 characterization 到 candidate 必须相同。
4. 本批不改调用点数据、文案、locale、round/floor/max 算法，不抽其他 answer/provider/tool/date-range 逻辑。

## 判据

判据 1：机器 · `formatMetricKg` 覆盖 null、0、低于/达到 0.25kg 半步边界、负值与千分位；精确固定 `暂无结果`、0.5kg 取整和 `en-US` 最多一位小数输出。

- 度量：表驱动直接调用真实 helper；至少包含 `100.24`、`100.25`、`12000`。
- 已知假绿：只测整数值，删除 0.5kg 取整仍会通过。

判据 2：机器 · `formatPercent` 覆盖 0、普通小数、四舍五入边界、负数与大于 1；始终保留一位小数和 `%`。

- 度量：表驱动精确字符串比较。
- 已知假绿：只断言包含 `%`，小数位或乘 100 漂移仍会假绿。

判据 3：机器 · `getDaysSince` 在 `vi.setSystemTime` 固定时钟下覆盖非法日期、未来、少于一天、整一天和 1.9 天；结果分别固定为 0、0、0、1、1。

- 度量：测试使用 fake timers 并在 finally/afterEach 恢复真实时钟。
- 已知假绿：使用真实 `Date.now()` 会随运行日期漂移；只测非法输入无法固定 floor/max。

判据 4：机器 · characterization 与 candidate 的运行时导出集合精确为 3 个函数；两个源文件中每个函数定义总数为 1，两个模块恰有一条依赖边，无 `any` / `as unknown as`。

- 度量：测试读取源码并统计定义/依赖，比较 `Object.keys`。
- 已知假绿：只建新文件会允许复制实现或循环依赖。

判据 5：机器 · 最终 characterization 与 candidate 的测试 blob 相同；私有 0.5kg 常量 candidate 中只在新模块出现一次。

- 度量：比较两个 commit 的 test blob；`rg -n METRIC_WEIGHT_DISPLAY_INCREMENT_KG` 在两个生产源文件的结果集合精确为新模块两次引用加一次定义。
- 已知假绿：测试数量不变但期望被弱化，或常量仍留在 orchestrator，均不算完成。

判据 6：机器 · 定向测试、全部 assistant 测试、`pnpm verify` 与 server build exit 0，并报告本次发现的文件/测试数量。

- 已知假绿：只跑新模块测试不能证明 orchestrator 消费路径继续编译和工作。

判据 7：机器 + 人工 · candidate commit 只含允许文件；合同/测试未变，排除文件未暂存；函数体的 null 分支、`Math.round(value / 0.5) * 0.5`、`toLocaleString("en-US", { maximumFractionDigits: 1 })`、`toFixed(1)`、`Math.max(0, Date.now() - date.getTime())` 与 day floor 逐字保持。

- 度量：比较 baseline..candidate 文件列表、characterization..candidate 实现 diff、cached diff 与 worktree status。
- 已知假绿：仅凭全量绿灯不能证明展示结果逐字一致或并行文件未混入。

## 冲突与限定词检查

冲突检查：已通过。本地 commits 已授权；push、部署未授权。

限定词：

- “3 个 helper”仅指逐名列出的函数。
- “天”固定为原实现的 24 小时毫秒桶，不改成日历日语义。
- “纯逻辑”允许读取 `Date.now()`；测试通过 fake system time 消除非确定性，不代表函数改为依赖注入。
- 本批完成不代表 orchestrator 其余边界已拆分。
