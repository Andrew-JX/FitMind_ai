# fitmind-x0t — 资源存在性与生产模型成本护栏契约

contract SHA：本文件首次提交所在的 commit；提交后记录到 Beads，后续 candidate 不得修改本文件。

baseline SHA：`717b2f187c1e8289544e1897ad8b8340bf91d576`

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/server/src/services/training/workout-service.ts`
- `fitmind-ai/server/src/services/training/workout-service.test.ts`
- `fitmind-ai/server/src/services/assistant/assistant-turn-observability.ts`
- `fitmind-ai/server/src/services/assistant/assistant-turn-observability.test.ts`
- `fitmind-ai/server/src/env.ts`
- `fitmind-ai/server/src/env.test.ts`
- `fitmind-ai/.env.production.example`
- `fitmind-ai/docs/ai-decisions.md`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/contracts/fitmind-x0t-404-and-model-cost.md`

## 冻结事实

1. DeepSeek 官方当前模型与价格页：`https://api-docs.deepseek.com/quick_start/pricing`。
2. 核实日期：2026-08-11。
3. `deepseek-v4-flash` 每百万 token 的美元单价：输入缓存命中 `$0.0028`、输入缓存未命中 `$0.14`、输出 `$0.28`。
4. 当前 provider usage 只有 `prompt_tokens` / `completion_tokens` / `total_tokens`，没有缓存命中 token 明细。因此本批必须把所有输入 token 按缓存未命中 `$0.14/M` 估算，形成成本上界；不得混用更低的缓存命中价制造低估。
5. DeepSeek 官方发布说明 `https://api-docs.deepseek.com/news/news260424/` 明确：`deepseek-chat` 与 `deepseek-reasoner` 在 2026-07-24 15:59 UTC 后退役且不可访问。仓库当前生产示例仍使用 `deepseek-chat`，不能再把它当作待计价的现役生产模型。

## 判据

判据 1：机器 · 所有 workout/set 单资源访问在“ID 不存在”和“ID 属于其他用户”两种情况下，均返回同一安全边界：HTTP `404`、code `NOT_FOUND`，且不泄露跨用户资源是否存在。

- 度量：`pnpm test:unit -- server/src/services/training/workout-service.test.ts` 覆盖 workout get/update/delete/add-set 以及 set update/delete 的空结果路径。
- 负向断言：`hasWorkoutById`、`hasSetById` 即使被 mock 为 `true`，调用数也必须为 `0`；只把 403 文案改成 404、但仍执行无 owner 条件的全局存在性探测，不算通过。

判据 2：机器 · `deepseek-v4-flash` 的 turn telemetry 与单次 provider budget 计价都必须得到非 `null` 成本；1M prompt + 1M completion 必须为 `$0.42`。

- 度量：`pnpm test:unit -- server/src/services/assistant/assistant-turn-observability.test.ts` 同时覆盖 `buildAssistantTurnLogEvent` 与 `estimateAssistantProviderCallCostUsd`。
- 负向断言：未知模型继续返回 `null`；不得给未知 BYO 模型编造价格，也不得给已退役别名新增现役价格。

判据 3：机器 · 官方 DeepSeek endpoint 配置退役别名时必须在 provider 调用前抛出包含替代模型名的描述性错误；当前 V4 模型和非 DeepSeek 的 OpenAI-compatible endpoint 不受该限制。

- 度量：`pnpm test:unit -- server/src/env.test.ts` 覆盖 `deepseek-chat`、`deepseek-reasoner` 两个失败例，以及 `deepseek-v4-flash`、第三方 endpoint 两个成功例。
- 负向断言：静默接受退役别名、只在文档里写迁移提醒，或把所有第三方同名模型一并拒绝，均不算通过。

判据 4：文档 · `.env.production.example` 使用 `deepseek-v4-flash`；D56 与 progress 同时记录官方来源、核实日期、缓存未命中上界假设，以及“本批没有修改线上环境、没有部署、没有做真实 provider 调用”。

- 度量：源码检查及 `pnpm format:check`。
- 负向断言：只写价格数字而没有来源/日期，或声称线上配置已经迁移，不算通过。

判据 5：机器 · 完整离线门禁保持绿色。

- 度量：依次运行 `pnpm eval`、`pnpm verify`，均以进程退出码为准；eval 每组 total 必须非零且输出 `Overall: PASS`。
- 负向断言：仅打印成功文本但进程退出非零，或通过空数据集获得 100%，不算通过。

判据 6：尚不可验证 · 线上实际 `OPENAI_COMPAT_MODEL` 已切换且真实 DeepSeek 调用、成本日志、预算累计均正常。

- 缺少条件：用户禁止部署；本地不读取或改写服务器环境，也不使用生产 API key 发起付费调用。
- 后续验证：获得独立部署授权后，先修改服务器环境，再以一条受控真实请求核对返回 model、usage、`estimated_cost_usd` 和预算累计；该外部验证不阻塞本地 candidate，但必须保持为未验证。

## 冲突与限定词检查

冲突检查：已通过。当前官方事实取代原审计中“给 `deepseek-chat` 加一行价格”的过时实施建议；保留其真实目标——恢复生产成本护栏。不得 push 或部署。

限定词：

- “官方 DeepSeek endpoint”指 URL hostname 精确为 `api.deepseek.com`，不以字符串包含关系判断。
- “相同 404”指同一资源类型的 status/code/message 相同；workout 与 set 可保留各自不含所有权信息的资源名。
- “成本上界”只针对当前未区分缓存命中的输入 token 计价，不表示账单最终一定等于该估算。
- “生产模型”在本契约中指生产示例要迁移到的 `deepseek-v4-flash`；本批不声称远端已采用该值。
