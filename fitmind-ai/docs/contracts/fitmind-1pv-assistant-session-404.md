# fitmind-1pv — assistant chat session 安全 404 合同

contract SHA：本文档首次提交所在的 commit；candidate 不得修改。

baseline SHA：`c51b125`

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/docs/contracts/fitmind-1pv-assistant-session-404.md`
- `fitmind-ai/docs/api-contract.md`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/server/src/db/chat-repository.ts`
- `fitmind-ai/server/src/services/assistant/assistant-orchestrator-service.ts`
- `fitmind-ai/server/src/services/assistant/assistant-session-access.test.ts`
- `fitmind-ai/server/src/assistant-session-access-http.test.ts`

明确排除开工前已有的 `.github/workflows/deploy-tencent.yml`、`fitmind-ai/deploy/README.md`、`fitmind-ai/deploy/compose.yaml`、`fitmind-ai/deploy/scripts/deploy.sh`、`fitmind-ai/deploy/scripts/deploy-release-identity.test.mjs`、`fitmind-ai/server/src/app.test.ts`、`fitmind-ai/server/src/deploy-workflow.test.ts`、`fitmind-ai/server/src/routes/health.ts` 与 `fitmind-ai/docs/progress.md` 中并行的 `fitmind-a0k` 工作树改动。

## 冻结事实与策略

1. baseline `resolveSession` 先调用 `findChatSessionByIdForUser(sessionId, userId)`；返回 null 后再调用无 owner 的 `hasChatSessionById(sessionId)`。全局存在时抛 403 `FORBIDDEN` / `You cannot access this chat session.`，全局不存在时抛 404 `NOT_FOUND` / `Chat session was not found.`。
2. 图与源码穷举显示 `hasChatSessionById` 的 production caller 集合精确为 `resolveSession` 一处；其余引用都在测试 mock。删除该调用后，同时删除 repository 的无 owner export/SQL，不能留下可被未来重新接入的旁路。
3. 修复策略是只信任 user-scoped lookup：owned row 继续复用；null 一律抛现有 404 code/message。未提供 `session_id` 时的 `createChatSession` 与 title 行为不改。
4. 服务级测试直接走 production `runMockAssistantTurn`，只 mock DB/provider/tool 等外部边界；HTTP 测试通过 production `createApp`、auth middleware、assistant router/controller/error middleware 发起 `POST /api/assistant/mock-turn`，不能用 controller 直调冒充 HTTP。

## 判据

判据 1：机器 · 对同一个有效 UUID，分别模拟“user-scoped lookup null + 全局存在”和“user-scoped lookup null + 全局不存在”，production `runMockAssistantTurn` 必须抛出逐字段相同的 status 404、code `NOT_FOUND`、message `Chat session was not found.`；两种情况均调用 `findChatSessionByIdForUser(sessionId, authenticatedUserId)` 精确一次。

- 已知假绿：只把 403 文案改成 404、仍执行全局 probe，会继续泄露 timing/DB 访问形状并保留错误设计。

判据 2：机器 · authenticated `POST /api/assistant/mock-turn` 对 foreign/absent session 的真实 HTTP 响应 status、JSON error code/message/details 精确相同，且响应不包含 owner、存在性或 `FORBIDDEN`。

- 已知假绿：只测 service 抛错不能证明 Express controller/error middleware 映射；只 mock controller 抛 404不能证明 production session path 已修。

判据 3：机器 · `hasChatSessionById` 在 candidate 的 production 源码定义、export、import 和调用总数均为 0；测试 mock 也不得为了断言 call count 保留同名假 API。`findChatSessionByIdForUser` 仍包含 `WHERE id = $1 AND user_id = $2`，参数顺序为 `[sessionId, userId]`。

- 已知假绿：保留死 export、只断言当前调用数为零，未来仍可轻易恢复旁路；只搜索 service 会漏掉 repository 实现。

判据 4：机器 · owned session 路径返回原 session id、不得创建新 session；未提供 session id 时创建 session 并保持原 200 字符 trim/title/null 语义。两条正向路径均不受 foreign/absent 合并影响。

- 已知假绿：让所有显式 session 一律 404 会满足负向用例却破坏续聊；每次都创建新 session 会隐藏 lookup 缺陷。

判据 5：机器 · API 契约明确 `session_id` 不属于当前用户或不存在时都返回同一 404；定向 service+HTTP 测试、assistant 目录、根 `pnpm verify`、根 `pnpm eval` 与 server production build均 exit 0，并报告本次运行数量。

- 已知假绿：只更新 AGENTS 或 API 文档不能证明实现；只跑新测试不能覆盖既有 assistant turn 行为。

判据 6：机器 + 人工 · `git diff --name-only c51b125..<candidate>` 只含允许文件；合同未变，排除文件未暂存；provider、tool、answer、stream、budget、session 创建和 persistence 行为除 403→统一 404 与 probe 删除外不改。

## 冲突与限定词检查

冲突检查：已通读，无冲突。本地 commits 已授权；push、部署、真实数据库和网络未授权。HTTP 测试只绑定本地 loopback 临时端口。

限定词：

- “foreign”运行时来源是 authenticated user 的 scoped lookup 返回 null、但测试数据库边界模拟全局行存在；生产实现修复后不再观察第二个事实。
- “absent”运行时来源是同一 scoped lookup 返回 null、全局行不存在；foreign/absent 的 HTTP 可观察结果必须完全相同。
- “相同”指 status 与规范化 JSON error body 深比较，不用响应耗时相等冒充；本批删除额外 DB probe 但不承诺网络调度的逐毫秒常量时间。
