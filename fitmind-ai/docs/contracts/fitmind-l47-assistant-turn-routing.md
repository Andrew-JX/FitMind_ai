# fitmind-l47 — assistant turn routing 边界合同

contract SHA：本文档首次提交所在的 commit；characterization 与 candidate 不得修改。

baseline SHA：`c98b714`

characterization SHA：开工前为空；必须早于 extraction candidate。

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/docs/contracts/fitmind-l47-assistant-turn-routing.md`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/server/src/services/assistant/assistant-orchestrator-service.ts`
- `fitmind-ai/server/src/services/assistant/assistant-turn-routing.ts`
- `fitmind-ai/server/src/services/assistant/assistant-turn-routing.test.ts`
- `fitmind-ai/server/src/services/assistant/resolve-routed-intent.test.ts`

明确排除开工前已有的 `.github/workflows/deploy-tencent.yml`、`fitmind-ai/deploy/README.md`、`fitmind-ai/deploy/compose.yaml`、`fitmind-ai/deploy/scripts/deploy.sh`、`fitmind-ai/deploy/scripts/deploy-release-identity.test.mjs`、`fitmind-ai/server/src/app.test.ts`、`fitmind-ai/server/src/deploy-workflow.test.ts`、`fitmind-ai/server/src/routes/health.ts` 与 `fitmind-ai/docs/progress.md` 中并行的 `fitmind-a0k` 工作树改动。

## 冻结事实与策略

1. baseline orchestrator 以 `(Get-Content -Encoding UTF8 <path>).Count` 计为 2027 个物理行；目标聚类从 `parseProviderSimulation` 的 454 行到 `ensureAllowedProviderTool` 的 660 行。行号只描述 baseline，不是完成判据；此前进度中的 2014 使用了不同口径，本批不沿用。
2. 目标公开 API 精确为 `resolveRoutedIntent`、`resolveExecutionModeForIntent`、`buildProviderRequest`、`ensureAllowedProviderTool` 四个函数；`AssistantTurnRoutingInput` 与 `ResolvedRoutedIntent` 为类型导出。simulation 解析、无 router call、显式 mode 映射、allowed-tools 去重及常量留作模块私有实现。
3. baseline `resolve-routed-intent.test.ts` 定向运行 6/6，覆盖 keyword fast path、LLM rescue 与 usage、router null intent、out-of-scope、无 router 和一个显式 mode。第一阶段把它迁为新模块自有测试，通过 re-export facade 调用仍位于 orchestrator 的实现，并补齐合同所列分支；测试通过后单独提交并冻结 blob。
4. 第二阶段只把目标函数、两个类型与其专用私有 helper 原样移入 `assistant-turn-routing.ts`，orchestrator 反向导入消费并为既有 `resolveRoutedIntent` named export 保留兼容 re-export。provider adapter/client、provider guard/budget、session、repository、persistence、stream、tool execution 与 answer construction 均留在 orchestrator 或原模块。
5. 新模块允许依赖 `assistant-intent-router`、`assistant-tool-routing`、`llm-intent-router` 类型、provider/observability 类型与通用 `HttpError`；不得导入 orchestrator、controller、middleware、repository、DB、provider adapter/client、tool executor 或 agent。

## 判据

判据 1：机器 · 新模块 runtime export 集合精确为四个目标函数；两个目标类型可导入；四个函数在生产源码中的定义总数各为一，依赖边精确为 orchestrator → turn-routing，不能有反向边。orchestrator 只兼容 re-export baseline 已公开的 `resolveRoutedIntent`。

- 已知假绿：复制函数、双向 re-export、保留 orchestrator 私有旧实现，或把四个函数全部从 orchestrator 兼容导出，都不算完成。

判据 2：机器 · `resolveRoutedIntent` 保留 baseline 六类行为，并以表驱动覆盖 `assistantModeSchema` 的全部非-auto mode → routed intent 映射；keyword 命中、out-of-scope、无 router 和显式 mode 均断言 router 未调用，LLM rescue 精确保留 call telemetry。

- 已知假绿：只保留 weekly_report 一个显式 mode 会漏掉 recommendation/imbalance/evidence/unsupported 映射；只断言 intent 会漏掉意外的计费 router call。

判据 3：机器 · `resolveExecutionModeForIntent` 表驱动覆盖 `assistantRoutedIntentSchema` 的全部值；`plateau_diagnosis` 必须分别固定有 `exercise_id` 与无 `exercise_id` 两条路径，其他值固定当前 mode 结果。

- 已知假绿：只测试 summary/progress 无法发现 knowledge、mixed_tool_rag、exercise_history 或 plateau fallback 漂移。

判据 4：机器 · `buildProviderRequest` 精确固定 conversation 原消息、resolved execution mode、日期、nullable exercise、allowed-tools 顺序与按 tool name 去重；simulation 覆盖 default、前导空白后的 `[mock:text]`、`[mock:error]` 及前缀后的 normalized message，不得把测试前缀从原 conversation 中删除。

- 已知假绿：只断言 allowed-tools 包含目标工具会漏掉重复工具、顺序和过宽白名单；只断言 simulation scenario 会漏掉 normalized/original message 分叉。

判据 5：机器 · `ensureAllowedProviderTool` 对 message/error 响应不做白名单拒绝、对允许 tool_call 放行、对未列入 request 的 tool_call 抛出 status 502、code `AI_PROVIDER_ERROR` 且消息包含实际 tool name。

- 已知假绿：只测允许工具不能证明 provider 无法调用未授权工具；只断言“抛错”会漏掉 HTTP 层错误契约。

判据 6：机器 · characterization 与 candidate 的测试 blob 相同；新模块不出现 I/O、环境读取、时间/随机数或类型逃逸，不导入冻结策略禁止的模块。

- 已知假绿：candidate 为迁移方便改测试、给模块注入无关生命周期依赖，或用 `as any` / `as unknown as` / ignore suppression 都不算完成。

判据 7：机器 · 新模块测试、相关 orchestrator 测试、全部 assistant 测试、根 `pnpm verify`、根 `pnpm eval` 与 server production build均 exit 0，并报告本次运行的文件/断言数量。

- 已知假绿：只跑新纯函数测试不能证明真实 turn 仍消费同一决策；只 type-check 不能固定 telemetry、request shape 与错误契约。

判据 8：机器 + 人工 · `git diff --name-only c98b714..<candidate>` 只含允许文件；合同/冻结测试未变，排除文件未暂存；目标函数体除必要 export/import/类型所有权变化外逐字保持，orchestrator 的 provider/session/tool/stream 生命周期不改。

- 已知假绿：借提取顺手改变 fallback、provider 调用次数、工具参数、session 403/404 或用户可见答案，都不算完成。

## 冲突与限定词检查

冲突检查：已通读，无冲突。本地 commits 已授权；push、部署、真实 provider、数据库和网络调用未授权。

限定词：

- “全部 mode/intent”运行时来源分别为 orchestrator 中的 `assistantModeSchema` 与 `assistantRoutedIntentSchema` 冻结值；characterization 以显式表逐项列出，不用数组长度替代语义。
- “allowed-tools”运行时来源是 `getToolDefinitionForMode` 返回值，去重键精确为 `tool.name`，顺序为 resolved mode、training overview、exercise progress、weekly report、next training focus。
- “原样移入”允许 import/export、参数接口归属和兼容 re-export 的机械变化，不允许分支、返回字段、错误状态/code/message 或调用顺序变化。
