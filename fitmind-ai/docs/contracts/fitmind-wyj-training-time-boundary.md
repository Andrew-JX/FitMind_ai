# fitmind-wyj — 训练时间纯逻辑边界合同

contract SHA：本文档首次提交所在的 commit；提交后记录到 Beads，后续 characterization 与 candidate 均不得修改。

baseline SHA：`c6af4b0`

characterization SHA：开工前为空；必须早于 extraction candidate。

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/client/src/features/training/TrainingSessionComposer.tsx`
- `fitmind-ai/client/src/features/training/training-time.ts`
- `fitmind-ai/client/src/features/training/training-time.test.ts`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/contracts/fitmind-wyj-training-time-boundary.md`

## 冻结事实与两阶段策略

1. `TrainingSessionComposer.tsx` 当前 1723 行，其中 5 个无 React/网络/状态依赖的训练时间 helper 位于同一文件：`formatTrainingTimeSummary`、`formatTimeOnly`、`formatDateTimeLocalValue`、`parseDateTimeLocalValue`、`getDurationMinutesFromLocalValues`。
2. 第一阶段只把这 5 个函数导出，并新增 `training-time.ts` 作为 re-export facade；`training-time.test.ts` 只通过该 facade 冻结现状。characterization 测试通过后单独提交并记录 SHA。
3. 第二阶段把完全相同的函数体和输入类型移入 `training-time.ts`，composer 改为导入；`training-time.test.ts` 从 characterization SHA 到 candidate 必须逐字节不变。facade 路径因此在拆分前后稳定，测试不是拆完后才补。
4. 测试固定分支优先级、无效值、null/空白、本地 datetime 格式、ISO 转换、正向分钟舍入、最短 1 分钟和结束不晚于开始；使用本地构造的 Date 生成输入，避免依赖执行机器时区。
5. 本批只抽时间纯逻辑，不拆样式、表单组件、API 或错误翻译，不改变 UI 文案、日期解析、舍入或保存行为。

## 判据

判据 1：机器 · characterization commit 中 `training-time.ts` 仅 re-export composer 的 5 个函数；`training-time.test.ts` 至少覆盖 4 个 summary 分支、合法/非法显示、合法/非法解析和 5 种 duration 边界，并全部通过。

判据 2：机器 · candidate 中 5 个函数的唯一定义位于 `training-time.ts`；composer 只从稳定路径导入且不再定义它们。源码扫描发现第二定义、从 composer 反向 re-export 或循环依赖会失败。

判据 3：机器 · `training-time.test.ts` 在 characterization SHA 与 candidate SHA 的 blob hash 完全相同；不能通过拆分后改断言来制造假绿。

判据 4：机器 · 新模块有自己的 `training-time.test.ts`，导出集合精确为 5 个函数；所有输入输出均有 TypeScript 类型，不使用 `any`、`as unknown as` 或行为 fallback。

判据 5：机器 · 定向 characterization、`pnpm verify` 与 client production build 通过；测试不访问网络、数据库或浏览器远端状态。

判据 6：人工 · UI 字符串、Date 构造、`toLocaleTimeString("zh-CN")` 参数、`toISOString()`、`Math.round(durationMs / 60000)` 与 `Math.max(1, ...)` 逐字保持；diff 仅落在允许文件。

判据 7：人工 · 合同与 characterization 测试在 candidate 中不变；不 push、不部署。

## 负向断言与限定词

- 只让 composer 少几十行而没有 characterization-before-extraction 证据，不算完成。
- 拆分后才创建测试，或 candidate 修改 characterization 断言/fixture/期望值，不算完成。
- 把 5 个函数复制到新模块但保留 composer 定义，不算完成。
- 用固定 UTC 字符串断言本地时间导致换时区失败，不算完成。
- 本批完成只证明一个纯时间边界已经抽出，不代表 1723 行 composer 已完成整体拆分；后续组件、样式和错误映射仍需各自合同与测试。
