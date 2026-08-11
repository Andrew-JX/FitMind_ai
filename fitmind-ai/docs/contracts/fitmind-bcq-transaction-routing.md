# fitmind-bcq — 事务 query 不逃逸护栏契约

contract SHA：本文件首次提交所在的 commit；提交后记录到 Beads，后续 candidate 不得修改。

baseline SHA：`d86f204`

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/server/src/db/transaction-routing-test-probe.ts`
- `fitmind-ai/server/src/db/transaction-routing.test.ts`
- `fitmind-ai/server/src/db/repositories/workouts-repository.d.ts`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/contracts/fitmind-bcq-transaction-routing.md`

## 冻结事实与策略

1. 当前直接包含事务控制的非测试 repository 是 `user-consent-repository.ts`、`user-health-data-repository.ts`、`planned-workout-repository.ts`、`repositories/workouts-repository.js`；personal-tools 通过 `withLockedUser` 复用 health 事务。
2. 现有 personal-tools 与 health 测试已经人工断言过 `pool.query` 为 0，但各测试自造 pool，planned-workout 甚至让 pool/client 共用同一个 query mock，无法发现逃逸。
3. 本批先建立共享测试 probe：pool 与 `connect()` 返回的 client 必须是两个可区分的 query 通道；任何 pool query 立即抛 `Transaction query escaped the connected client.`，同时保留调用记录。
4. 每个直接事务 repository 至少一个真实导出函数通过该 probe 执行完整 BEGIN/work/COMMIT；personal-tools 作为跨 repository 消费者也单独执行一个场景。
5. 测试从源码发现所有非测试 db 文件中的事务起点，并与已覆盖场景精确比对，不能靠手写“当前有四个”让未来第五个静默漏测。
6. `workouts-repository.js` 的真实函数都接受可选 pool，但手写 `.d.ts` 隐藏该参数。本批只修声明与运行时一致，不迁文件、不改 SQL/行为；完整 JS → TS 和共享 pool 放后续 4.1b。

## 判据

判据 1：机器 · shared probe 暴露 pool/client 独立调用记录、connect/release 次数与 client statement；默认 pool query 抛固定逃逸错误。

- 负向证明：测试主动调用一次 `probe.pool.query`，必须 reject 且记录一次；若 probe 把 pool/client 指向同一函数则失败。

判据 2：机器 · user-consent、user-health-data、planned-workout、workouts 四个直接事务入口均满足：connect=1、pool query=0、首条 client statement=BEGIN、成功末条=COMMIT、release=1。

判据 3：机器 · personal-tools 的敏感写场景同样满足 pool query=0，证明跨 repository 调用仍留在 health repository 取得的 client。

判据 4：机器 · 至少一个失败场景在 client 上 ROLLBACK、不 COMMIT、pool query=0、release=1。

判据 5：机器 · 源码枚举排除 `.test.*`/test probe 后，所有包含事务 BEGIN 调用的 repository 文件集合与场景声明集合逐项相同；在内存加入未声明的第五文件路径必须失败。

判据 6：机器 · workouts `.d.ts` 为所有真实可注入函数声明可选 `DbPoolLike`，并由 TypeScript 测试直接传入 probe，不允许 `as unknown as` 绕过。

判据 7：机器 · `pnpm verify` 与 server production build 通过。

## 冲突与限定词检查

冲突检查：已通过。本批只增强测试可见性和修正声明，不改变连接生命周期、SQL、事务隔离、API 或生产配置；因此不会把护栏伪装成“共享 pool 已修复”。

限定词：

- “事务 repository”指自身源码直接发出 `BEGIN` 的 db repository；委托给它的 personal-tools 作为额外消费者场景，不重复计入源码集合。
- “所有 query”指从 BEGIN 到 COMMIT/ROLLBACK 的事务协议与业务 SQL；pool 的 `connect()` 不属于 query。
- 本批完成不代表每请求新建 pool 或手写 JS 类型边界已经消失，只代表后续改造若让事务逃逸会在 CI 失败。
