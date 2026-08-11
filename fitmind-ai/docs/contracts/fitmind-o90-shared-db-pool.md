# fitmind-o90 — 进程级共享数据库连接池合同

contract SHA：本文档首次提交所在的 commit；提交后记录到 Beads，后续 candidate 不得修改。

baseline SHA：`4358aea`

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/server/src/db/pool.ts`
- `fitmind-ai/server/src/db/pool.test.ts`
- `fitmind-ai/server/src/db/pool.js`（删除）
- `fitmind-ai/server/src/db/pool.d.ts`（删除）
- `fitmind-ai/server/src/db/index.js`
- `fitmind-ai/server/src/db/assistant-saved-insights-repository.ts`
- `fitmind-ai/server/src/db/athlete-profile-repository.ts`
- `fitmind-ai/server/src/db/chat-repository.ts`
- `fitmind-ai/server/src/db/exercise-progress-repository.ts`
- `fitmind-ai/server/src/db/knowledge-repository.ts`
- `fitmind-ai/server/src/db/muscle-load-repository.ts`
- `fitmind-ai/server/src/db/personal-tools-repository.ts`
- `fitmind-ai/server/src/db/planned-workout-repository.ts`
- `fitmind-ai/server/src/db/product-feedback-repository.ts`
- `fitmind-ai/server/src/db/recommendation-context-repository.ts`
- `fitmind-ai/server/src/db/tool-call-log-repository.ts`
- `fitmind-ai/server/src/db/training-summary-repository.ts`
- `fitmind-ai/server/src/db/user-consent-repository.ts`
- `fitmind-ai/server/src/db/user-health-data-repository.ts`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/contracts/fitmind-o90-shared-db-pool.md`

## 冻结事实与策略

1. 当前 14 个 TypeScript repository 各自包含 `createRepositoryPool()`，每次未注入 pool 的调用都可能执行 `new Pool()`；4 个 JavaScript repository 和 weekly-report 已经走 `createDbPool()`，但现有工厂仍然每次新建 Pool。
2. 本批把 `createDbPool()` 定义为进程级稳定门面：所有默认 repository 路径共享同一底层 pg Pool；测试继续可以注入自有 pool，注入对象的所有权不转移。
3. 为兼容现有 repository 的 `finally activePool.end()`，门面的 `end()` 必须是安全 no-op；只有显式 `closeDbPool()` 可以 drain 并清除底层 Pool。后续再次调用 `createDbPool()` 可以重建底层 Pool，但继续返回同一稳定门面。
4. 唯一生产 Pool 配置必须包含有界 `max` 和 `allowExitOnIdle: true`；底层 Pool 必须监听空闲客户端 `error` 事件，日志只允许事件名、错误类型和经过保守校验的错误码，不记录 message、stack、连接串或 SQL。
5. 本批不迁移 4 个 JavaScript repository 到 TypeScript，不改 SQL、事务边界、API、数据库 schema、部署或生产配置。
6. node-postgres 官方文档建议应用通常使用单个受限 pool；事务不得使用 `pool.query`；`allowExitOnIdle` 可使 CLI/测试在客户端空闲后自然退出；空闲客户端 error 应注册监听器。核实日期：2026-08-11。
   - <https://node-postgres.com/features/pooling>
   - <https://node-postgres.com/apis/pool>

## 判据

判据 1：机器 · 扫描 `server/src/db` 的非测试生产 `.ts/.js`，`new Pool` 与 `require("pg")` 只能出现在 `pool.ts`；`createRepositoryPool` 必须为 0；第二个构造点或重复 helper 会使测试失败。

判据 2：机器 · 14 个 TypeScript repository 的默认路径全部调用共享 `createDbPool()`；现有 JavaScript repository 与 weekly-report 仍通过同一工厂。测试注入的 pool 仍原样使用且不会被 repository 关闭。

判据 3：机器 · 同一进程中重复 `createDbPool()` 返回同一门面；调用门面 `end()` 不会关闭共享底层 Pool；调用 `closeDbPool()` 会对当前底层 Pool 恰好执行一次真实 `end()` 并允许随后重建。

判据 4：机器 · Pool 配置明确包含 `allowExitOnIdle: true` 和正整数上限 `max`；空闲 `error` 监听器存在。脱敏日志测试注入带秘密 message/stack/连接串/SQL 的错误，序列化结果不得包含这些值，只允许稳定字段。

判据 5：机器 · 4.1a 的事务路由测试继续通过：事务 query 全部停留在 `connect()` 返回的 client，`pool.query` 为 0；共享门面不得削弱该断言。

判据 6：机器 · `pnpm verify`、server production build 与 repository 离线测试通过；测试不得连接真实数据库、不得依赖网络或密钥。

判据 7：人工 · diff 仅落在允许文件；不得顺手迁移 JS repository、修改 SQL/事务/API、push、部署、安装生产进程或执行真实数据库查询。

## 负向断言与限定词

- 仅把现有 `createDbPool()` 缓存起来但保留 14 个 repository 私有 Pool 构造点，不算完成。
- 仅靠代码评审声称“单例”，没有第二构造点扫描和生命周期测试，不算完成。
- 把共享 Pool 的真实 `end()` 暴露给 repository，会让一次请求关闭全进程连接池，不算完成。
- 吞掉空闲客户端错误而无稳定事件，或记录异常 message/stack/连接串/SQL，均不算完成。
- “一个 pool”指应用生产源码中的一个进程级底层 pg Pool，不限制测试注入的 fake pool，也不声称跨进程、跨容器共享。
- 本批完成不代表 JavaScript repository、手写声明、真实数据库集成测试或优雅停机信号处理已经完成。
