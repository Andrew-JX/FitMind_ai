# fitmind-gdd — 结构护栏范围补充

addendum SHA：本文档首次提交所在的 commit；后续 test adaptation 与 candidate 不得修改。

触发证据：确定性答案实现迁移后，`assistant-focus-area.test.ts` 与 `assistant-display-metrics.test.ts` 的行为断言继续通过，但各自“必须与 orchestrator 直接相连”的源码断言失败。新生产依赖为：

`assistant-orchestrator-service.ts → assistant-deterministic-answers.ts → assistant-focus-area.ts / assistant-display-metrics.ts`

旧断言把“唯一实现所有者”与“某一个固定消费者”混为一谈。保留无用 direct import 或源码注释只会制造假绿，不能作为修复。

本 addendum 在原合同五个文件之外，仅增加：

- `fitmind-ai/server/src/services/assistant/assistant-focus-area.test.ts`
- `fitmind-ai/server/src/services/assistant/assistant-display-metrics.test.ts`
- `fitmind-ai/docs/contracts/fitmind-gdd-scope-addendum.md`

补充判据：

1. 两份旧模块测试的行为用例与函数定义唯一性断言不变。
2. 源码边改为精确验证 orchestrator 单向依赖 deterministic answers，deterministic answers 单向依赖对应 focus/metrics 模块；对应纯模块不得反向依赖前两者。
3. 必须明确断言 orchestrator 不再直接依赖 focus/metrics，避免一边新增中间所有权、一边保留伪装的旧边。
4. 两份 adapted 测试在 candidate 中保持逐字节不变，并记录新 blob。
5. 本补充不授权改变 focus/metrics 运行时导出、行为文案、正则、格式化或时间算法。
