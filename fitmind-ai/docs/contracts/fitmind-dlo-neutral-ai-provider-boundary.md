# fitmind-dlo — 中立 AI provider 边界合同

contract SHA：本文档首次提交所在的 commit；后续 characterization 与 candidate 不得修改。

baseline SHA：`8790cfd`

characterization SHA：开工前为空；必须早于 extraction candidate。

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/AGENTS.md`
- `fitmind-ai/server/src/repo-governance.test.ts`
- `fitmind-ai/server/src/services/assistant/openai-compatible-chat-client.ts`
- `fitmind-ai/server/src/services/assistant/provider-config.ts`
- `fitmind-ai/server/src/services/assistant/provider-types.ts`
- `fitmind-ai/server/src/services/training/workout-intake-llm-parser.ts`
- `fitmind-ai/server/src/services/training/assistant-insights-service.ts`
- `fitmind-ai/server/src/services/ai/openai-compatible-chat-client.ts`
- `fitmind-ai/server/src/services/ai/openai-compatible-chat-client.test.ts`
- `fitmind-ai/server/src/services/ai/openai-compatible-provider-config.ts`
- `fitmind-ai/server/src/services/ai/openai-compatible-provider-config.test.ts`
- `fitmind-ai/server/src/services/ai/provider-types.ts`
- `fitmind-ai/server/src/services/ai/provider-types.test.ts`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/contracts/fitmind-dlo-neutral-ai-provider-boundary.md`

明确排除开工前已有的 `deploy/README.md`、`deploy/compose.yaml`、`deploy/scripts/deploy.sh`、`server/src/app.test.ts`、`server/src/routes/health.ts` 工作树改动。

## 冻结事实与策略

1. baseline 的 production training 源码中只有两个 `../assistant/` importer：`workout-intake-llm-parser.ts` 复用通用 OpenAI-compatible transport/config，`assistant-insights-service.ts` 复用 `AssistantIntentMode`。
2. 图查询确认 `runOpenAiCompatibleChatCompletion` 的直接生产调用者只有 assistant wrapper 与 training parser；二跳消费者包括 assistant provider/router 与两个 training provider 分支。图结果只作导航，源码 import/call site 是最终事实。
3. 第一阶段在 `services/ai` 建立三个 re-export facade 及各自独立测试；characterization 全绿后单独提交，并冻结三个测试 blob。
4. 第二阶段把通用 transport、Groq/BYO config、`OpenAiCompatibleProviderName`、`AssistantProviderUsage` 与 `AssistantIntentMode` 原样移入中立模块；assistant 旧文件保留兼容导出和 assistant 专属 wrapper，training 改为直接依赖中立模块。
5. 最后删除 AGENTS 临时 allowlist，并把治理测试从“精确允许两个 importer”收紧为“production training importer 集合必须为空”。本批不重命名环境变量、provider 值、公开 DTO 字段或 assistant 旧导出。

## 判据

判据 1：机器 · 中立 chat client 自有测试固定成功请求、URL 去尾斜杠、Bearer header、请求体、content/tool call/usage 解析、HTTP 错误脱敏、网络失败和 timeout/clear timer 行为。

- 度量：直接调用真实 `runOpenAiCompatibleChatCompletion`，只 stub `fetch` 与 fake timers。
- 已知假绿：只断言 `fetch` 被调用，无法发现 URL、认证头、payload、usage 或错误归一化漂移。

判据 2：机器 · 中立 config 自有测试固定 Groq 默认/覆盖模型、缺 key 错误，以及 BYO base URL/model/key 的成功与逐项缺失错误；错误与返回对象逐字保持。

- 度量：测试保存并恢复相关环境变量，通过真实 `loadServerEnv()` 路径调用 config builder。
- 已知假绿：只 type-check 无法发现默认模型、错误文案或 env 映射漂移。

判据 3：机器 · 中立 provider types 自有测试用合法/非法编译 fixture 固定两个 provider 名、完整 `AssistantIntentMode` union 与 usage 三个非负整数形状，同时检查三个类型只有一个定义所有者。

- 度量：合法 fixture 直接赋值；`@ts-expect-error` 固定非法 provider/intent/usage 字段，并读取源码统计定义。
- 已知假绿：只检查文件存在，空 facade 或放宽为 `string` / `any` 会假绿。

判据 4：机器 · characterization 与 candidate 中，每个中立模块和对应 assistant 文件之间对每个目标符号只有一个定义所有者、恰有一条单向依赖边且无循环；三个 characterization 测试 blob 逐字节不变。

- 度量：测试读取源码统计定义和 import/re-export；比较 characterization/candidate blob。
- 已知假绿：复制实现、双向 re-export 或迁移后弱化测试均不算完成。

判据 5：机器 · assistant 原有运行时导出和内部 import 路径继续可用；既有 assistant chat-client 测试、provider tests、workout-intake LLM 测试与 assistant-insights 消费者编译/测试全绿。

- 已知假绿：只跑中立模块测试不能证明兼容 facade 与真实消费者未断裂。

判据 6：机器 · candidate 的 production training 源码对 `../assistant/` 的 importer 集合精确为空；AGENTS 不再包含 allowlist markers、两个旧 importer 路径或“结构债 4.2”到期文本；内存加入一个 synthetic importer 必须被治理函数检出。

- 已知假绿：只删除 AGENTS 文案而不扫描 production import，或只改两个当前文件但允许第三个 importer，都会假绿。

判据 7：机器 · 中立模块不得导入 `../assistant/`、training、controller、repository 或 client，不得出现 `any`、`as unknown as`、`@ts-ignore`；类型、校验、HTTP/timeout 算法不得借迁移改写。

- 已知假绿：目录位置中立但依赖仍反向，或用类型逃逸压过编译，均不算完成。

判据 8：机器 · 三个中立模块测试、相关 assistant/training/governance 测试、全部 assistant 测试、`pnpm verify` 与 server build exit 0，并报告测试文件/断言数量。

判据 9：机器 + 人工 · baseline..candidate 文件集合只含允许文件；合同和三个冻结测试未变；五个排除文件未暂存。不得访问真实 provider、数据库或网络，不得 push 或部署。

## 冲突与限定词检查

冲突检查：已通过。本地 commits 已授权；push、部署未授权。现有 AGENTS allowlist 明确要求结构债 4.2 到期时删除，本批正是该到期工作。

限定词：

- “中立”指 `services/ai` 模块不依赖 assistant/training/HTTP/DB；不表示这些能力要发布给客户端或移入 `shared/`。
- “兼容导出”只保证仓库内现有 assistant import path 与导出名不变，不新增公共 HTTP API。
- `AssistantIntentMode` 保留现名以避免无收益的跨仓库重命名；中立化由所有权与依赖方向判定。
- 本批只清理两个冻结例外，不代表 2568 行 assistant orchestrator 已完成全部边界拆分。
