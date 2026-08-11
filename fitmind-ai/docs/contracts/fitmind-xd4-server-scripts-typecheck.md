# fitmind-xd4 — server scripts 独立 TypeScript 门禁合同

contract SHA：本文档首次提交所在的 commit；candidate 不得修改。

baseline SHA：`9e229c8`

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/docs/contracts/fitmind-xd4-server-scripts-typecheck.md`
- `fitmind-ai/docs/local-run-guide.md`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/server/package.json`
- `fitmind-ai/server/tsconfig.scripts.json`
- `fitmind-ai/server/src/server-scripts-typecheck.test.ts`
- `fitmind-ai/server/src/db/pool.ts`
- `fitmind-ai/server/scripts/assistant-production-smoke.ts`
- `fitmind-ai/server/scripts/seed-assistant-demo-data.ts`
- `fitmind-ai/server/scripts/seed.ts`

明确排除开工前已有的 `.github/workflows/deploy-tencent.yml`、`fitmind-ai/deploy/README.md`、`fitmind-ai/deploy/compose.yaml`、`fitmind-ai/deploy/scripts/deploy.sh`、`fitmind-ai/deploy/scripts/deploy-release-identity.test.mjs`、`fitmind-ai/server/src/app.test.ts`、`fitmind-ai/server/src/deploy-workflow.test.ts`、`fitmind-ai/server/src/routes/health.ts` 与 `fitmind-ai/docs/progress.md` 中并行的 `fitmind-a0k` 工作树改动。

## 冻结事实与策略

1. 脚本集合 `S` 定义为在 `fitmind-ai/server` 下执行 `Get-ChildItem scripts -File -Filter '*.ts' | Sort-Object FullName` 得到的相对路径集合；冻结时 `| Measure-Object` 为 26。两个 `.mjs` 由 Node 直接执行，不属于 TypeScript 集合。
2. baseline `server/tsconfig.json` blob 为 `ee3259286eb56dca980f86fb5970f48da20f15da`，只包含 `src/**/*.ts` 并负责 production emit；本批不修改它，也不把 `scripts` 加进 production build graph。
3. 以仓库 TypeScript 二进制对 `S` 执行 `NodeNext + strict + noUncheckedIndexedAccess + noEmit` 的基线诊断为 12 条，集中在 `assistant-production-smoke.ts`、`seed-assistant-demo-data.ts`、`seed.ts` 及它们使用的共享 pool 类型。门禁落地必须修正这些真实类型错误，不能用排除文件或 suppression 消音。
4. baseline `pnpm --filter @fitmind/server build` exit 0；随后递归排序 `dist` 文件相对路径得到 219 项、`scripts/` 前缀为 0，UTF-8 换行拼接后的 SHA-256 为 `cc3a85d0e51384779a7b1e971e0d6729b752718aa5880abd3f2d4ff44f19c5f7`。
5. 根级 `pnpm eval` 是 mock-first 离线 runner，baseline exit 0；server 自身 `eval` 需要 `DATABASE_URL`，API/SQL smoke 还需要数据库、注册配置或真实服务，本批没有这些授权与环境，不把它们冒充离线判据。
6. 新增独立 no-emit scripts 配置，继承仓库 base 严格选项；server `type-check` 必须显式串联 production src 与 scripts 两个检查，根 `pnpm verify` 通过既有 recursive 命令自动消费它。对现有诊断只做必要的类型真实化：共享 pool query 支持泛型 row、两个 seed 直接消费该 TypeScript 边界、production smoke 的 JSON body 使用 Fetch 可接受的实际类型。

## 判据

判据 1：机器 · `server-scripts-typecheck.test.ts` 解析 TypeScript 配置后，program root/closure 必须包含集合 `S` 的每一项以及脚本实际导入的 `server/src` 模块；`server/package.json` 的 `type-check` 必须串联独立的 src 与 scripts 命令，根 `pnpm type-check`/`pnpm verify` 因此执行 scripts 检查。

- 度量：测试动态枚举 `S`，逐路径比较 TypeScript program file set；不靠冻结的 26 逐项手写副本。
- 已知假绿：只创建空 `tsconfig.scripts.json`、只检查一个示例脚本、或提供 scripts 命令但不接入 `type-check` 都必须失败。

判据 2：机器 · 在实现完成后临时把 `seed-assistant-demo-data.ts` 的有效 `../src/db/pool.js` import 改为不存在的 `../src/db/missing-pool.js`，根 `pnpm type-check` 必须非零退出并出现 `TS2307`；随后恢复文件并以修改前后 `git hash-object` 相等证明回滚完成。

- 已知假绿：只运行独立 scripts 命令不能证明根门禁接线；制造普通语法错不能证明跨目录 export/import 漂移会被捕获。

判据 3：机器 · scripts 配置解析后的 `noEmit`、`strict`、`noUncheckedIndexedAccess` 均精确为 `true`；本批新增或修改的 TypeScript 文件不得出现 `as any`、`as unknown as`、`@ts-ignore` 或 `@ts-expect-error`。

- 已知假绿：在子配置关闭严格选项、开启 emit，或用 suppression 绕过当前 12 条诊断，均不算完成。

判据 4：机器 · candidate 中 production `server/tsconfig.json` blob 仍为冻结值，`server/package.json` 的 `build` 命令逐字不变；运行 production build 后 `dist` 路径数、排序路径 SHA-256 与 `scripts/` 前缀计数分别等于冻结事实中的三个值。

- 已知假绿：build exit 0 但额外发出 `dist/scripts`，或把入口整体搬家后仍能编译，都必须失败。

判据 5：机器 · 新 scripts 门禁对集合 `S` exit 0；根 `pnpm type-check`、根 `pnpm verify`、根 `pnpm eval` 与 server production build 均 exit 0。数据库、provider、线上 API 与 production smoke 因缺少隔离环境或授权明确记为未验证。

- 已知假绿：只跑新配置不能覆盖根调用链、单元测试、离线 eval 或生产 build；把需要真实环境的脚本失败写成“flaky”也不算通过。

判据 6：机器 + 人工 · `git diff --name-only 9e229c8..<candidate>` 只含允许文件；合同在 candidate 中逐字不变，排除的并行工作树改动未暂存、未提交；类型修复不改变 seed SQL、数据内容、production smoke 路由/断言或共享 pool 生命周期。

- 已知假绿：把现有 dirty deploy/health 改动算进本批，或借类型修复改写脚本业务流程，都不算完成。

## 冲突与限定词检查

冲突检查：已通读，无冲突。本地 commits 已授权；push、部署、真实数据库和线上 smoke 未授权。

限定词：

- “每一个 TypeScript 脚本”运行时来源是判据 1 动态枚举的集合 `S`，不是手工清单。
- “transitive imports”来源是 TypeScript 配置解析出的 program file set；至少包含脚本实际引用的 `server/src` 路径。
- “同一 production layout”只指冻结的 `server/tsconfig.json`、build 命令与 `dist` 相对路径集合，不声称产物字节在不同构建时间完全相同。
- “现有可运行脚本”在本地证据中只包括无需数据库/密钥的根级离线 eval；其余命令按实际依赖报告未验证。
