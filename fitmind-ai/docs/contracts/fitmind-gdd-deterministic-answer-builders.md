# fitmind-gdd — assistant 确定性答案构建边界合同

contract SHA：本文档首次提交所在的 commit；后续 characterization 与 candidate 不得修改。

baseline SHA：`0eccc35`

characterization SHA：开工前为空；必须早于 extraction candidate。

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/server/src/services/assistant/assistant-orchestrator-service.ts`
- `fitmind-ai/server/src/services/assistant/assistant-deterministic-answers.ts`
- `fitmind-ai/server/src/services/assistant/assistant-deterministic-answers.test.ts`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/contracts/fitmind-gdd-deterministic-answer-builders.md`

明确排除开工前已有的 `deploy/README.md`、`deploy/compose.yaml`、`deploy/scripts/deploy.sh`、`server/src/app.test.ts`、`server/src/routes/health.ts` 工作树改动。

## 冻结事实与策略

1. baseline orchestrator 逐行计数为 2568。四个工具结果 DTO 位于 287–407，`AssistantAnswerCore` 位于 519；八个目标公开 builder 位于 644–992，内部 evidence/range/complete 与五个 recommendation 子 builder 位于同一连续答案构建聚类。行号只描述基线，不是完成判据。
2. 图查询显示 `buildEvidence` 被十个确定性答案 builder 直接消费，仅调用 `uniqueStrings`；`formatStatRangeLabel` 被九个答案 builder 消费。两者和显示度量/训练部位 helpers 构成独立答案渲染聚类，不应继续与 session/provider/tool 执行生命周期混杂。
3. 第一阶段只导出四个 DTO、`AssistantAnswerCore` 与八个 builder，并建立 re-export facade 和独立 characterization；通过后单独提交并冻结测试 blob。
4. 第二阶段把四个 DTO、答案 core、八个公开 builder 及它们专用的纯 helper/常量原样移入新模块；orchestrator 反向导入。`buildToolAnswer`、tool validation、provider simulation、stream、persistence 与 agent 流程仍留在 orchestrator。
5. 本批不改工具名、evidence shape、intent、中文文案、默认 recommendation、日期范围、kg/percent 格式、24 小时恢复桶、Sources 映射或 fallback field label。

八个公开 builder：

- `normalizeStructuredAnswer`
- `buildTrainingOverviewAnswer`
- `buildExerciseProgressAnswer`
- `buildWeeklyTrainingReportAnswer`
- `buildPlateauDiagnosisAnswer`
- `buildRecommendationContextAnswer`
- `buildProviderMessageAnswer`
- `buildProviderErrorFallbackGuidance`

## 判据

判据 1：机器 · runtime export 集合精确为八个 builder；四个结果 DTO 与 `AssistantAnswerCore` 可从新模块导入，目标定义在 facade/orchestrator 总数为一，模块间恰有一条单向依赖边。

- 已知假绿：只建空文件、复制实现、双向 re-export 或循环依赖均不算完成。

判据 2：机器 · overview/progress/weekly 三类工具答案分别覆盖 empty 与 ready，精确固定 summary、range bullet、kg/percent、evidence tool/workout/set/rule 去重和限制文案。

- 已知假绿：只断言 summary 非空，工具名、范围、数值格式或 evidence 漂移仍会假绿。

判据 3：机器 · recommendation context 覆盖无数据，以及 `next_training_focus`、`muscle_balance`、`training_imbalance`、`recovery_check`、`evidence_explain` 分支；fake clock 固定恢复天数，训练部位和 55% 集中度边界保持现状。

- 已知假绿：只测 default 分支无法发现 mode 路由、部位判断、阈值或时间语义漂移。

判据 4：机器 · plateau 答案覆盖少样本/足样本及有/无 Sources，精确固定 evidence、source 字段映射、结论、建议和 limitations；provider message/fallback guidance 覆盖空 bullets、mock evidence、中文 field labels 与未知字段透传。

- 已知假绿：只比较 source 数量无法发现字段或文案漂移；只测 exercise_id 无法固定日期字段与未知字段。

判据 5：机器 · `normalizeStructuredAnswer` 对完整 structured answer 保持对象身份，对 core answer 补齐默认 conclusion/recommendation/sources/intent/limitations；不得覆盖已有 structured 字段。

判据 6：机器 · characterization 与 candidate 的测试 blob 相同；新模块不导入 orchestrator、provider adapter、session/chat repository、tool executor、controller 或 client，不出现 `any`、`as unknown as`、`@ts-ignore`。

判据 7：机器 · 定向测试、全部 assistant 测试、`pnpm verify` 与 server build exit 0，并报告文件/断言数量。仅运行新测试不能证明 orchestrator 消费路径仍可编译和运行。

判据 8：机器 + 人工 · baseline..candidate 文件集合只含五个允许文件；合同/测试未变，排除文件未暂存；公开与内部目标函数体除必要 export/import 所有权变化外逐字保持。

## 冲突与限定词检查

冲突检查：已通过。本地 commits 已授权；push、部署未授权。

限定词：

- “确定性答案”指基于工具结果和已冻结规则组装 `AssistantStructuredAnswer`，不包括 provider phrase、RAG retrieval、faithfulness 校验或流式发送。
- 新模块允许依赖纯 `assistant-focus-area`、`assistant-display-metrics`、answer composer 类型和 RAG chunk 返回类型；不得发起 I/O。
- 本批完成只证明答案构建聚类有独立所有权，不代表 orchestrator 的 tool/session/provider/planning 生命周期已拆分完毕。
