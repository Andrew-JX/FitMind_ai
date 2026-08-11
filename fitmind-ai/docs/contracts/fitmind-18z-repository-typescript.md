# fitmind-18z — 数据库 repository 单一 TypeScript 类型源合同

contract SHA：本文档首次提交所在的 commit；提交后记录到 Beads，后续 candidate 不得修改。

baseline SHA：`4138b1e`

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/server/src/db/repositories/exercises-repository.js`（删除）
- `fitmind-ai/server/src/db/repositories/exercises-repository.ts`
- `fitmind-ai/server/src/db/repositories/muscle-groups-repository.js`（删除）
- `fitmind-ai/server/src/db/repositories/muscle-groups-repository.ts`
- `fitmind-ai/server/src/db/repositories/users-repository.js`（删除）
- `fitmind-ai/server/src/db/repositories/users-repository.ts`
- `fitmind-ai/server/src/db/repositories/workouts-repository.js`（删除）
- `fitmind-ai/server/src/db/repositories/workouts-repository.ts`
- `fitmind-ai/server/src/db/repositories/workouts-repository.d.ts`（删除）
- `fitmind-ai/server/src/db/repositories/index.js`（删除）
- `fitmind-ai/server/src/db/repositories/index.ts`
- `fitmind-ai/server/src/db/repositories/index.d.ts`（删除）
- `fitmind-ai/server/src/db/repositories/repository-source-contract.test.ts`
- `fitmind-ai/server/src/db/pool.test.ts`
- `fitmind-ai/server/src/db/transaction-routing.test.ts`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/contracts/fitmind-18z-repository-typescript.md`

## 冻结事实与策略

1. `db/repositories` 当前包含 4 个 JavaScript 实现、1 个 JavaScript barrel 和 2 个手写 `.d.ts`。`index.d.ts` 没有声明可注入 pool 参数，`workouts-repository.d.ts` 已经因运行时签名漂移修过一次；实现与类型是两份会漂移的事实源。
2. 本批把 5 个运行时模块原位迁移为 `.ts`，导入方继续使用 NodeNext 的 `.js` specifier；接口从现有 JSDoc 和两份声明合并进实现。不得改变导出集合、SQL、参数顺序、事务、分页或返回语义。
3. 测试注入的结构化 pool/client 类型继续公开；共享 `createDbPool()` 仍是默认路径，repository 的兼容性 `end()` 调用本批不重构。
4. 基线 SQL 模板按文件抽取、统一 CRLF 为 LF、以固定分隔符连接后的 SHA-256 如下；candidate 必须逐项相同：
   - exercises：1 块，`934c5561488e07b845f590885a086ce2cf649cb4c71abb12aaf70d6c5f854e29`
   - muscle-groups：1 块，`4ab254edd6aff56fd880744bd7143977c762a36ec866be886993937d5d47481c`
   - users：5 块，`447324abdfda0e05941f8c07c0c041e4b725796f9ac9c29609d9218e6d06a175`
   - workouts：12 块，`6ae5da687276a765804f5bab3362efa5825f515420cbeb1718e3050ea64e671f`
5. 本批不改调用服务、controller、API、schema，不执行真实数据库查询，不 push、不部署。

## 判据

判据 1：机器 · `db/repositories` 的生产实现精确为 5 个 `.ts`，生产 `.js` 和手写 `.d.ts` 均为 0；新增空壳 `.ts`、保留旁路 `.js` 或只删除声明均失败。

判据 2：机器 · 四个实现模块与 barrel 的运行时导出集合和基线一致；workouts 的 12 个实现导出全部带源码类型，index 继续只公开原有 16 个入口。

判据 3：机器 · 4 个文件的 SQL 块数量和 SHA-256 与冻结值逐项一致；改变空白、SQL 文本、参数占位符或漏掉一块都会失败。

判据 4：机器 · 公共参数与返回值由 `.ts` 实现直接声明；users、exercise、muscle、workout 的 pool 参数都允许注入，事务 pool/client 类型保持可用于 4.1a probe，不允许用 `any` 或 `as unknown as` 绕过。

判据 5：机器 · 现有 auth、dictionary、workout service 和 transaction routing 测试通过；workout 事务仍为 pool query=0、client BEGIN/业务 SQL/COMMIT 或 ROLLBACK/release。

判据 6：机器 · `pnpm verify` 与 server production build 通过；构建产物中存在 5 个对应 `.js` runtime 文件，验证不连接真实数据库、不依赖网络或密钥。

判据 7：人工 · diff 仅落在允许文件，除类型/JSDoc 机械迁移和测试扩展外无行为改动；合同文件在 candidate 中逐字节不变。

## 负向断言与限定词

- 仅把扩展名改成 `.ts`，内部保留隐式 `any` 或把声明继续放在旁路 `.d.ts`，不算完成。
- 仅依赖 TypeScript build 通过而不固定 SQL 指纹和导出集合，不算完成。
- 为了让类型通过而修改 SQL、返回字段、默认值、错误或事务顺序，不算完成。
- “手写声明为 0”仅指 `server/src/db/repositories`；依赖包声明和其他批次尚未迁移的文件不在本判据中。
- 本批完成不代表真实 PostgreSQL 集成、数据库 schema、进程优雅停机或其他 db 模块的局部类型已经统一。
