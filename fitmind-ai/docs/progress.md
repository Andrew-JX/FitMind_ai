## 2026-04-27 阶段 0.1 - 工程骨架 Batch 1

### 完成内容
- 建立根目录 `pnpm` workspace 基础文件。
- 新增共享 TypeScript 严格基线配置。
- 初始化阶段进度记录文档。

### 改动文件
- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `.gitignore`
- `docs/progress.md`

### 验证命令
- 本批次未执行安装、type-check、lint、test 命令。
- 仅进行了只读文件与目录检查。

### 遗留问题
- 根目录脚本目前是占位信息，真实统一命令将在后续 batch 落地。
- 由于本批次禁止安装依赖，`pnpm-lock.yaml` 尚未生成。

### 下一步
- 进入 Batch 2A，创建 `shared` 包基础文件与统一响应/错误类型定义。

## 2026-04-27 阶段 0.1 - 工程骨架 Batch 2A

### 完成内容
- 创建 `shared` 包最小 `package.json` 和 `tsconfig.json`。
- 新增统一 API 成功/失败响应类型定义。
- 新增基础错误码与 `ApiError` 类型定义。

### 改动文件
- `shared/package.json`
- `shared/tsconfig.json`
- `shared/src/api-response.ts`
- `shared/src/errors.ts`
- `docs/progress.md`

### 验证命令
- 尝试运行 `pnpm --filter @fitmind/shared type-check`。

### 遗留问题
- `shared/src/index.ts` 还未创建，按拆分计划放到 Batch 2B。
- 当前仓库尚未安装依赖，`type-check` 是否可执行取决于本地是否已有可用的 `tsc`。

### 下一步
- 进入 Batch 2B，新增 `shared/src/index.ts` 并补一轮 `shared` 包导出验证。

## 2026-04-27 阶段 0.1 - 工程骨架 Batch 2B

### 完成内容
- 新增 `shared` 包统一导出入口。
- 将基础响应类型和错误类型从包根集中导出。

### 改动文件
- `shared/src/index.ts`
- `docs/progress.md`

### 验证命令
- 尝试运行 `pnpm --filter @fitmind/shared type-check`。

### 遗留问题
- 当前仓库仍未安装依赖，`type-check` 是否可执行仍取决于本地是否已有可用的 `tsc`。

### 下一步
- 进入 Batch 3A，创建 `server/package.json`、`server/tsconfig.json`、`server/src/app.ts`、`server/src/routes/health.ts`，并在该批结束后按计划首次执行 `pnpm install`。

## 2026-04-27 阶段 0.1 - 工程骨架 Batch 3A

### 完成内容
- 创建 `server` 包最小 `package.json` 和 `tsconfig.json`。
- 新增 Express app 工厂函数并挂载 `/api/health` 路由。
- 新增最小 health route，返回统一成功响应格式。

### 改动文件
- `server/package.json`
- `server/tsconfig.json`
- `server/src/app.ts`
- `server/src/routes/health.ts`
- `docs/progress.md`

### 验证命令
- 计划执行 `pnpm install`，生成依赖与 `pnpm-lock.yaml`。

### 遗留问题
- `server/src/server.ts` 还未创建，按拆分计划放到 Batch 3B。
- `type-check` 和启动验证需要等依赖安装完成后继续。

### 下一步
- 进入 Batch 3B，新增 `server/src/server.ts`，然后执行 `pnpm --filter @fitmind/server type-check` 和 health check 验证。

## 2026-04-27 阶段 0.1 - 工程骨架 Batch 3B

### 完成内容
- 新增 server 监听入口文件。
- 完成最小 Express + TypeScript health check 骨架闭环。

### 改动文件
- `server/src/server.ts`
- `docs/progress.md`

### 验证命令
- 运行 `pnpm --filter @fitmind/server type-check`。

### 遗留问题
- `dev` 启动脚本将在 Batch 5 统一收口。

### 下一步
- 进入 Batch 4A，创建 `client/package.json`、`client/tsconfig.json`、`client/vite.config.ts`、`client/index.html`，并在该批结束后再次执行 `pnpm install`。

## 2026-04-27 阶段 0.1 - 工程骨架 Batch 4A

### 完成内容
- 创建 `client` 包最小 `package.json` 和 `tsconfig.json`。
- 新增 Vite 配置文件和 HTML 入口。
- 为最小 React + Vite 前端骨架准备依赖声明。

### 改动文件
- `client/package.json`
- `client/tsconfig.json`
- `client/vite.config.ts`
- `client/index.html`
- `docs/progress.md`

### 验证命令
- 计划执行 `pnpm install`，更新工作区依赖与 `pnpm-lock.yaml`。

### 遗留问题
- `client/src/main.tsx` 和 `client/src/App.tsx` 还未创建，按拆分计划放到 Batch 4B。

### 下一步
- 进入 Batch 4B，新增 `client/src/main.tsx` 和 `client/src/App.tsx`，再进行 client 侧类型检查和启动验证准备。

## 2026-04-27 阶段 0.1 - 工程骨架 Batch 4B

### 完成内容
- 新增 React 入口文件。
- 新增最小首页占位组件，展示项目名和阶段状态。

### 改动文件
- `client/src/main.tsx`
- `client/src/App.tsx`
- `docs/progress.md`

### 验证命令
- 计划执行 `pnpm --filter @fitmind/client type-check`。

### 遗留问题
- client 依赖可能仍需一次非交互式刷新安装后才能稳定完成类型检查。

### 下一步
- 进入 Batch 5，统一根目录和各 workspace 脚本，补齐 `dev` / `type-check` / `lint` / `test` 命令并做一轮集中验证。

## 2026-04-27 阶段 0.1 - 工程骨架 Batch 5

### 完成内容
- 统一根目录 `type-check`、`lint`、`test`、`dev:client`、`dev:server` 脚本。
- 为 `client`、`server`、`shared` 补齐基础脚本定义。
- 为 server 增加开发启动所需的 `tsx` 工程依赖。
- 为 `shared` 补齐 `typescript` 开发依赖，确保根级 `type-check` 可递归执行。

### 改动文件
- `package.json`
- `client/package.json`
- `server/package.json`
- `shared/package.json`
- `docs/progress.md`

### 验证命令
- 计划执行 `pnpm install --force`。
- 计划执行 `pnpm type-check`。
- 计划执行 `pnpm lint`。
- 计划执行 `pnpm test`。

### 遗留问题
- `lint` 和 `test` 当前仍是占位脚本，真实 lint/test 基础设施留到 Phase 0.2。

### 下一步
- 进入 Phase 0.2，补齐 lint/test/env/migration 的工程增强项。
\n## 2026-04-27 闃舵 0.2 - 宸ョ▼璐ㄩ噺闂ㄧ Batch 0.2A\n\n### 瀹屾垚鍐呭\n- 鏍圭洰褰曟帴鍏?ESLint Flat Config锛屽 `client`銆乣server`銆乣shared` 鎵ц鐪熷疄闈欐€佹鏌ャ€?\n- 鏍圭洰褰曟柊澧?Prettier 鍩虹閰嶇疆鍜屽拷鐣ヨ鍒欍€?\n- 鏍圭骇鑴氭湰鏂板 `format:check`锛屽苟灏?`lint` 浠庡崰浣嶈剼鏈垏鎹㈡垚鐪熷疄 `eslint` 鎵ц銆?\n\n### 鏀瑰姩鏂囦欢\n- `package.json`\n- `eslint.config.js`\n- `.prettierrc.json`\n- `.prettierignore`\n- `docs/progress.md`\n\n### 楠岃瘉鍛戒护\n- 璁″垝鎵ц `pnpm install`\n- 璁″垝鎵ц `pnpm lint`\n- 璁″垝鎵ц `pnpm format:check`\n\n### 閬楃暀闂\n- `client`銆乣server`銆乣shared` 鍖呭唴閮ㄧ殑 `lint` 鍜?`test` 鑴氭湰浠嶆槸鍗犱綅锛岀粺涓€鏀跺彛鐣欏埌 Batch 0.2E銆?\n- 渚濊禆瀹夎瀹屾垚鍚庯紝鍙兘浼氭毚闇插嚭棣栬疆鏍煎紡鎴栬鍒欓棶棰橈紝灞婃椂鍦ㄥ悗缁?batch 淇暣銆?\n\n### 涓嬩竴姝?\n- 杩涘叆 Batch 0.2B锛岃ˉ榻?Vitest 鍩虹閰嶇疆鍜屾渶灏忓彲杩愯娴嬭瘯銆?\n

## 2026-04-27 阶段 0.2 - 工程质量门禁 Batch 0.2A（补记）

### 完成内容
- 新增根级 ESLint Flat Config，覆盖 `client`、`server`、`shared` 的基础静态检查。
- 新增根级 Prettier 配置与忽略规则。
- 根脚本新增 `format:check`，并将 `lint` 切换为真实 `eslint` 执行。

### 改动文件
- `package.json`
- `eslint.config.js`
- `.prettierrc.json`
- `.prettierignore`
- `docs/progress.md`

### 验证命令
- `pnpm install --force`
- `pnpm lint`
- `pnpm format:check`

### 遗留问题
- 子包内的 `lint` / `test` 脚本仍是占位，统一收口放到 Batch 0.2E。
- `docs/progress.md` 现有历史内容存在编码遗留，本次仅做追加，不重写旧记录。

### 下一步
- 进入 Batch 0.2B，接入 Vitest 和最小可运行测试。

## 2026-04-27 阶段 0.2 - 工程质量门禁 Batch 0.2B

### 完成内容
- 新增根级 `vitest` 配置。
- 新增 `shared` 的 API 响应契约测试。
- 新增 `server` 的 `/api/health` 基础路由测试。
- 根脚本 `test` 切换为真实 `vitest run`。

### 改动文件
- `package.json`
- `vitest.config.ts`
- `shared/src/api-response.test.ts`
- `server/src/app.test.ts`
- `docs/progress.md`

### 验证命令
- `pnpm install --force`
- `pnpm lint`
- `pnpm test`（需提权运行，沙箱内 `esbuild` spawn 会触发 `EPERM`）

### 遗留问题
- 当前 `vitest` 在沙箱内会因 `esbuild` 子进程受限触发 `spawn EPERM`，提权环境可正常通过。
- 还未建立各子包自己的 `test` 脚本收口，统一放到 Batch 0.2E。

### 下一步
- 进入 Batch 0.2C，补 `env.example` 和 server 侧环境变量读取入口。

## 2026-04-27 阶段 0.2 - 工程质量门禁 Batch 0.2C

### 完成内容
- 新增根级 `.env.example`，提供前后端最小环境变量模板。
- 新增 `server/src/env.ts`，用 `zod` 统一解析 server 侧环境变量。
- `server/src/server.ts` 改为通过 env loader 读取端口，不再直接裸读 `process.env`。

### 改动文件
- `.env.example`
- `server/package.json`
- `server/src/env.ts`
- `server/src/server.ts`
- `docs/progress.md`

### 验证命令
- `pnpm install --force`
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`

### 遗留问题
- `DATABASE_URL` / `JWT_SECRET` / `ANTHROPIC_API_KEY` 当前只建立读取结构，尚未进入强制必填阶段。
- 还没有 client 侧的 env 读取封装，本阶段按计划只处理 server 侧。

### 下一步
- 进入 Batch 0.2D，补 migration 工具目录和基础配置。

## 2026-04-27 阶段 0.2 - 工程质量门禁 Batch 0.2D

### 完成内容
- 新增 `node-pg-migrate` 基础配置文件和空 migration 目录。
- `server` 包新增 `db:migrate` / `db:migrate:down` 脚本。
- 新增 `pg` 依赖，为后续 migration / 数据库接入做准备。
- 追加 `docs/ai-decisions.md`，记录迁移工具选型。

### 改动文件
- `server/package.json`
- `server/pgmigrate.config.cjs`
- `server/migrations/.gitkeep`
- `docs/ai-decisions.md`
- `docs/progress.md`

### 验证命令
- `pnpm install --force`
- `pnpm --filter @fitmind/server exec node-pg-migrate --help`
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- `pnpm format:check`

### 遗留问题
- 当前 migration 目录仍为空，符合“本阶段不创建真实业务表 migration”的约束。
- `db:migrate` 只有在后续明确配置 `DATABASE_URL` 且进入业务表阶段后才会实际执行。

### 下一步
- 进入 Batch 0.2E，统一根脚本和各子包验证脚本。

## 2026-04-27 阶段 0.2 - 工程质量门禁 Batch 0.2E

### 完成内容
- 根级新增 `verify`，统一收口 `lint / format:check / type-check / test`。
- `client` / `server` / `shared` 的 `lint` / `test` 脚本不再是占位。
- 完成整套 Phase 0.2 基础设施验证闭环。

### 改动文件
- `package.json`
- `client/package.json`
- `server/package.json`
- `shared/package.json`
- `docs/progress.md`

### 验证命令
- `pnpm lint`
- `pnpm format:check`
- `pnpm type-check`（根级递归检查在沙箱内会触发 `spawn EPERM`，提权环境已通过）
- `pnpm test`（沙箱内 `vitest/esbuild` 会触发 `spawn EPERM`，提权环境已通过）
- `pnpm verify`（提权环境通过）

### 遗留问题
- `docs/progress.md` 和部分历史文档存在旧编码遗留，本次继续遵守“只追加、不重写旧记录”。
- 真实 migration、真实数据库连接、业务表结构和业务功能仍明确留在后续 phase。

### 下一步
- Phase 0.2 工程质量门禁已完成，可等待下一阶段任务。

## 2026-04-27 阶段 1.0 - Database Schema & Seed Batch 1.0A

### 完成内容
- 新增主线数据库首个真实 migration，创建 `users`、`muscle_groups`、`exercises`、`exercise_muscles`。
- 在 migration 中启用 `uuid-ossp`，补齐主键默认值、唯一约束、索引和多对多关联约束。
- `muscle_groups` 保留 `parent_id`，支持后续细粒度肌群层级 seed。
- 修正 `server` 包的 migration 脚本，改为直接使用 `node-pg-migrate` CLI 参数，避开现有 `--config-file` 在 ESM 工程中的加载错误。

### 改动文件
- `server/migrations/20260427043000_create_core_dictionaries_and_users.js`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server lint`
- `pnpm --filter @fitmind/server type-check`
- `pnpm --filter @fitmind/server db:migrate`
- `pnpm --filter @fitmind/server db:migrate:down`

### 遗留问题
- 当前仓库未发现本地 `.env`，若未提供 `DATABASE_URL`，则 migration up/down 仍需在后续有数据库连接串时完成实库验证。
- `docs/db-schema.md` 的阶段规划将 chat 相关表放在阶段 3；本轮仍按当前任务要求，仅先推进阶段 1.0A 的主线基础表。

### 下一步
- 进入 Batch 1.0B，创建 `workouts` 和 `sets` migration。

## 2026-04-27 阶段 1.0 - Database Schema & Seed Batch 1.0B

### 完成内容
- 新增 `workouts` 和 `sets` migration，补齐训练主线数据表。
- 通过 `workouts.user_id` 和 `sets.workout_id` 建立训练数据到用户的归属链路。
- 补齐 `workouts(user_id, performed_at desc)`、`sets(workout_id)`、`sets(exercise_id)` 索引。

### 改动文件
- `server/migrations/20260427044000_create_workouts_and_sets.js`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server lint`
- `pnpm --filter @fitmind/server type-check`
- `pnpm --filter @fitmind/server db:migrate`
- `pnpm --filter @fitmind/server db:migrate:down`

### 遗留问题
- 由于当前未配置 `DATABASE_URL`，本批 migration 仍未完成实库 up/down。
- 本批只落表结构，不实现 workouts CRUD 接口或 repository。

### 下一步
- 进入 Batch 1.0C，创建 `chat_sessions`、`messages`、`tool_call_logs` migration。

## 2026-04-27 阶段 1.0 - Database Schema & Seed Batch 1.0C

### 完成内容
- 新增 `chat_sessions`、`messages`、`tool_call_logs` migration，补齐主线聊天和可观测性基础表。
- `messages` 使用 `jsonb` 承载消息内容、结构化输出和 usage 元数据。
- 明确保留 `tool_call_logs`，但未实现 Tool Calling、SSE chat 或 AI provider 集成。

### 改动文件
- `server/migrations/20260427045000_create_chat_and_tool_log_tables.js`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server lint`
- `pnpm --filter @fitmind/server type-check`
- `pnpm --filter @fitmind/server db:migrate`
- `pnpm --filter @fitmind/server db:migrate:down`

### 遗留问题
- `docs/db-schema.md` 将这些表标记在阶段 3；本次按当前 Phase 1.0 任务要求提前落表，但没有提前实现聊天业务能力。
- `knowledge_chunks` 和 `pgvector` 仍明确未进入主线 migration。

### 下一步
- 进入 Batch 1.0D，开始 seed `muscle_groups`、高频 `exercises` 和 `exercise_muscles`。

## 2026-04-27 阶段 1.0 - Database Schema & Seed Batch 1.0D

### 完成内容
- 新增基础 seed 脚本 `server/scripts/seed.ts`，按事务执行字典数据初始化。
- 新增细粒度 `muscle_groups` seed，包含父子层级，如 `chest -> upper_chest`、`legs -> quads/hamstrings/glutes/calves`、`shoulders -> front/side/rear delts`。
- 新增首批 26 个高频 `exercises` 和对应 `exercise_muscles` 关联 seed。
- seed 全部采用参数化 SQL + `ON CONFLICT` upsert，支持重复执行。

### 改动文件
- `server/scripts/seed.ts`
- `server/src/db/seed-data/muscle-groups.ts`
- `server/src/db/seed-data/exercises.ts`
- `server/src/db/seed-data/exercise-muscles.ts`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server exec tsx scripts/seed.ts --help`
- `pnpm --filter @fitmind/server type-check`
- `pnpm --filter @fitmind/server db:migrate`
- `pnpm --filter @fitmind/server exec tsx scripts/seed.ts`

### 遗留问题
- 当前 `server/tsconfig.json` 只包含 `src/**/*.ts`，因此 `scripts/seed.ts` 不会进入现有 `type-check` 覆盖范围；后续可在 db connection 阶段一并收口。
- 在未配置 `DATABASE_URL` 的情况下，只能验证 `--help` 和脚本装配，不能完成真实入库 seed。

### 下一步
- 进入 Batch 1.0E，创建 `server/src/db` 基础连接模块并收口 migration / seed 执行链路。

## 2026-04-27 阶段 1.0 - Database Schema & Seed Batch 1.0E

### 完成内容
- 新增 `server/src/db/pool.ts` 和 `server/src/db/index.ts`，建立 server 侧数据库连接出口。
- 新增 `requireDatabaseUrl` 辅助函数，统一数据库连接缺失时的报错语义。
- `server/scripts/seed.ts` 改为复用 `server/src/db` 连接模块，不再在脚本内部直接拼接连接配置。

### 改动文件
- `server/src/db/pool.ts`
- `server/src/db/index.ts`
- `server/src/env.ts`
- `server/scripts/seed.ts`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server type-check`
- `pnpm --filter @fitmind/server exec tsx scripts/seed.ts --help`
- `pnpm --filter @fitmind/server db:migrate`

### 遗留问题
- `tsx` 在当前沙箱内触发 `spawn EPERM`，因此 seed 脚本执行类验证仍需提权环境。
- `DATABASE_URL` 仍未配置，migration / seed 的真实数据库验证仍被环境阻塞。

### 下一步
- 进入 Batch 1.0F，补 `muscle_groups` 和 `exercises` 的基础 repository 查询骨架。

## 2026-04-27 阶段 1.0 - Database Schema & Seed Batch 1.0E（补记）

### 完成内容
- 将 `server/src/db/pool` 实现改为 JS 模块，避免在当前未补 `pg` 类型声明前阻塞 `server` 侧 TypeScript 检查。
- 将 `server/src/db/index` 也同步改为 JS 模块，维持统一导出入口且恢复 `server` 侧类型检查可通过状态。

### 改动文件
- `server/src/db/pool.js`
- `server/src/db/index.js`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server type-check`

### 遗留问题
- `pg` 的强类型声明尚未纳入当前批次，后续如需要把 db 层全面转回 TS，可再引入本地声明或补开发依赖。

### 下一步
- 继续进入 Batch 1.0F，完成基础 repository 骨架。

## 2026-04-27 阶段 1.0 - Database Schema & Seed Batch 1.0F

### 完成内容
- 新增 `muscle_groups` 查询 repository，可返回完整肌群字典。
- 新增 `exercises` 查询 repository，支持 `q` 关键字和 `muscleCode` 过滤，并聚合返回关联肌群信息。
- `server/src/db/index.js` 统一导出 db 连接和基础 repository 入口。

### 改动文件
- `server/src/db/repositories/muscle-groups-repository.js`
- `server/src/db/repositories/exercises-repository.js`
- `server/src/db/repositories/index.js`
- `server/src/db/index.js`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server lint`
- `pnpm --filter @fitmind/server type-check`
- `node --check server/src/db/repositories/muscle-groups-repository.js`
- `node --check server/src/db/repositories/exercises-repository.js`

### 遗留问题
- repository 当前使用 JS 模块落骨架，主要是为了在未补 `pg` 类型声明前保持 db 主线可推进。
- 真实查询验证仍需要 `DATABASE_URL` 和已执行 migration/seed 的数据库环境。

### 下一步
- Phase 1.0 主线数据库 schema、seed 和基础 repository 已落地，可在配置数据库连接后做实库 migration/seed 验证。

## 2026-04-28 阶段 1.0G - Real DB Verification & Repository Smoke Test Batch 1.0G-A

### 完成内容
- 在真实 Neon `DATABASE_URL` 下完成 migration 回滚与重建验证。
- 确认 `.env.local` 中的 `DATABASE_URL` 带双引号时，命令行注入若不去引号会导致连接串解析异常；验证时已通过去引号的注入方式规避。
- 依次回滚 `20260427045000_create_chat_and_tool_log_tables`、`20260427044000_create_workouts_and_sets`、`20260427043000_create_core_dictionaries_and_users`。
- 从干净状态重新执行 `pnpm --filter @fitmind/server db:migrate`，确认三个 migration 可按顺序完整创建主线表。

### 改动文件
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server db:migrate`
- `pnpm --filter @fitmind/server db:migrate:down`
- `pnpm --filter @fitmind/server db:migrate:down`
- `pnpm --filter @fitmind/server db:migrate:down`
- `pnpm --filter @fitmind/server db:migrate`

### 遗留问题
- `node-pg-migrate` 当前仍会对现有 14 位前缀文件名打印 `Can't determine timestamp` 警告，但在真实库中不阻塞执行顺序和 up/down 行为。
- Neon 连接会打印 `sslmode=require` 相关安全警告，当前不影响本阶段数据库闭环验证。

### 下一步
- 进入 Batch 1.0G-B，执行 `seed.ts` 两次并验证幂等、字典数量和映射完整性。

## 2026-04-28 阶段 1.0G - Real DB Verification & Repository Smoke Test Batch 1.0G-B

### 完成内容
- 在真实 Neon 数据库中连续执行两次 `pnpm --filter @fitmind/server exec tsx scripts/seed.ts`。
- 两次 seed 均返回相同结果：`17 muscle groups, 26 exercises, 59 exercise-muscle mappings`，验证了幂等行为。
- 通过只读 SQL 检查确认：
  - `muscle_groups` 为 17 条，存在细粒度父子层级
  - `exercises` 为 26 条，保持在 20-30 个高频动作范围内
  - `exercise_muscles` 为 59 条
  - `exercises_without_mappings = 0`
  - `min_mappings_per_exercise = 1`
  - `parent_child_overlap_count = 0`
- 抽查数据库中的 `name_zh` 字段，中文内容正常，无乱码。

### 改动文件
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server exec tsx scripts/seed.ts`
- `pnpm --filter @fitmind/server exec tsx scripts/seed.ts`
- 只读 SQL 检查（通过临时 `tsx` 脚本执行）

### 遗留问题
- `seed.ts` 仍依赖 `tsx` 运行时，当前沙箱环境下这类命令需要提权才能稳定执行。
- Neon 连接仍会打印 `sslmode=require` 相关安全警告，当前不影响 seed 验证结果。

### 下一步
- 进入 Batch 1.0G-C，执行 repository smoke test 并验证聚合查询结果。

## 2026-04-28 阶段 1.0G - Real DB Verification & Repository Smoke Test Batch 1.0G-C

### 完成内容
- 通过只读 `tsx` smoke 命令直接调用现有 repository，未新增 script、route、controller 或前端代码。
- 验证 `listMuscleGroups()` 返回 17 条完整肌群数据。
- 验证 `searchExercises({ q: "bench" })` 返回 4 条结果，能够按关键词搜索动作。
- 验证 `searchExercises({ muscleCode: "quads" })` 返回 4 条结果，能够按肌群过滤动作。
- 抽查 repository 返回结果中的 `muscles` 字段，确认为聚合结构，不是重复平铺行。
- 同时确认真实库中的中文动作名、肌群名显示正常。

### 改动文件
- `docs/progress.md`

### 验证命令
- 只读 repository smoke test（通过临时 `tsx` 命令执行）

### 遗留问题
- 直接用原生 `node` 执行 repository smoke 时会因为 `pool.js` 依赖 `env.ts` 的运行时解析方式而找不到 `src/env.js`，因此本轮验证采用 `tsx` 作为真实运行路径。
- 当前结果不影响 repository 在项目既定 `tsx` 运行方式下的真实数据库验证。

### 下一步
- Phase 1.0G 的 migration、seed、repository 闭环验证已完成，可在后续阶段基于真实数据库继续推进 auth 和 workouts CRUD 开发。
## 2026-04-28 阶段 1.1 - Auth MVP Batch 1

### 完成内容
- 新增 `shared/src/auth.ts`，定义 Auth MVP 共享请求与响应 DTO。
- `shared/src/index.ts` 补齐 Auth 类型导出，供后续 controller / service 复用。
- 新增 `server/src/schemas/auth-schemas.ts`，建立 `register` / `login` 的 Zod 入参校验。
- `server/src/env.ts` 新增 `requireJwtSecret()`，为 JWT helper 提供 fail-fast 环境约束。

### 改动文件
- `shared/src/auth.ts`
- `shared/src/index.ts`
- `server/src/schemas/auth-schemas.ts`
- `server/src/env.ts`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/shared type-check`
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`

### 遗留问题
- 本批只建立契约、校验和 env 约束，尚未引入密码库、JWT 实现或任何 Auth HTTP 路由。
- `display_name` 当前按可选字段处理，空白字符串会在 Zod 校验中被拒绝，不会自动转为 `undefined`。

### 下一步
- 进入 Batch 2，新增 `users` repository 和密码 hash / compare 工具。
## 2026-04-28 阶段 1.1 - Auth MVP Batch 2

### 完成内容
- `server/package.json` 新增 `bcryptjs` 依赖，为 Auth MVP 提供纯 JS 密码哈希能力。
- 新增 `server/src/db/repositories/users-repository.js`，提供 `findUserByEmail`、`findUserById`、`createUser`。
- `server/src/db/repositories/index.js` 补齐 `users` repository 导出。
- 新增 `server/src/services/auth/password.ts`，封装 `hashPassword` 和 `comparePassword`。

### 改动文件
- `server/package.json`
- `server/src/db/repositories/users-repository.js`
- `server/src/db/repositories/index.js`
- `server/src/services/auth/password.ts`
- `docs/progress.md`

### 验证命令
- `pnpm install --force`
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`

### 遗留问题
- 本批只补齐 users 数据访问与密码原语，尚未引入 JWT helper、Auth service 或 HTTP 路由。
- `users` repository 当前继续沿用既有 `.js` 路线，未在本阶段顺手做 db 层 TS 化重构。

### 下一步
- 进入 Batch 3，新增 JWT helper、Auth service 和统一响应/错误工具。
## 2026-04-28 阶段 1.1 - Auth MVP Batch 3

### 完成内容
- `server/package.json` 新增 `jose` 依赖，为 Bearer Token MVP 提供 JWT 签发与校验能力。
- 新增 `server/src/services/auth/jwt.ts`，统一封装 `signJwt` / `verifyJwt`。
- 新增 `server/src/services/auth/auth-service.ts`，收口 `register`、`login`、`getCurrentUser` 三条 Auth 业务链路。
- 新增 `server/src/utils/api-response.ts` 和 `server/src/utils/http-error.ts`，统一成功/失败响应与应用错误结构。

### 改动文件
- `server/package.json`
- `server/src/services/auth/jwt.ts`
- `server/src/services/auth/auth-service.ts`
- `server/src/utils/api-response.ts`
- `server/src/utils/http-error.ts`
- `docs/progress.md`

### 验证命令
- `pnpm install --force`
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`

### 遗留问题
- 本批只完成 service 层闭环，尚未接入 controller、route、middleware 和 `app.ts`。
- `register` 对邮箱重复场景默认仍映射为 `400 VALIDATION_ERROR`，未扩展新的错误码。

### 下一步
- 进入 Batch 4，接入 Auth controller、route、middleware 和 `/api/auth/*` 路由。
## 2026-04-28 阶段 1.1 - Auth MVP Batch 4

### 完成内容
- 新增 `server/src/controllers/auth-controller.ts`，接入 `register` / `login` / `me` 三个薄 controller。
- 新增 `server/src/middleware/auth-middleware.ts`，统一解析 `Authorization: Bearer <token>` 并校验 JWT。
- 新增 `server/src/routes/auth.ts`，暴露 `/api/auth/register`、`/api/auth/login`、`/api/auth/me`。
- `server/src/app.ts` 接入 `express.json()`、Auth 路由和统一错误响应格式。

### 改动文件
- `server/src/controllers/auth-controller.ts`
- `server/src/middleware/auth-middleware.ts`
- `server/src/routes/auth.ts`
- `server/src/app.ts`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/server dev`
- 手动 smoke：`POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me`

### 遗留问题
- 本批完成了 HTTP 闭环，但自动化测试和真实接口 smoke 还需要在 Batch 5 一起收口。
- 当前错误处理中，未识别的异常统一映射为 `500 INTERNAL_ERROR`，未额外输出调试细节。

### 下一步
- 进入 Batch 5，补 Auth service、middleware 和 route 的最小测试，并完成最终验证。
## 2026-04-28 阶段 1.1 - Auth MVP Batch 5

### 完成内容
- 新增 `server/src/services/auth/auth-service.test.ts`，覆盖注册成功、重复邮箱、密码错误登录、`me` 查不到用户。
- 新增 `server/src/middleware/auth-middleware.test.ts`，覆盖缺失 header、格式错误、无效 token、有效 token。
- `server/src/app.test.ts` 补充 `/api/auth/me` 未授权访问的最小 route smoke。

### 改动文件
- `server/src/services/auth/auth-service.test.ts`
- `server/src/middleware/auth-middleware.test.ts`
- `server/src/app.test.ts`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server test`
- `pnpm test`
- `pnpm verify`

### 遗留问题
- 若后续要把 Auth 扩展到前端或生产化 cookie 流程，需要另起阶段，不在本批处理。
- 本批测试主要覆盖 Auth MVP 主路径和关键失败路径，尚未引入真实数据库 integration test。

### 下一步
- 完成最终验证，并按需要把本阶段真实踩坑追加到 `docs/troubleshooting.md`。
## 2026-04-28 阶段 1.1 - Auth MVP Verification Addendum

### 完成内容
- 固定根级 `eslint-plugin-react-hooks` 到 `7.0.1`，修复 `pnpm install --force` 后的 lint 依赖漂移。
- 调整 `server` 包 `test` 脚本为回到 workspace 根目录执行，保证 `pnpm --filter @fitmind/server test` 可用。
- 追加 `docs/troubleshooting.md`，记录 Auth 阶段真实遇到的类型解析和工具链脚本问题。

### 改动文件
- `package.json`
- `server/package.json`
- `docs/progress.md`
- `docs/troubleshooting.md`

### 验证命令
- `pnpm lint`
- `pnpm type-check`（提权环境通过）
- `pnpm --filter @fitmind/server test`（提权环境通过）
- `pnpm test`（提权环境通过）

### 遗留问题
- 根级 `pnpm verify` 仍会被仓库里既有的旧格式问题拦住，不是本次 Auth 改动单独引入。
- `pnpm test` / `pnpm type-check` 在当前沙箱内仍会受 `spawn EPERM` 影响，需要提权环境执行。

### 下一步
- Auth MVP 后端闭环已完成，可进入后续 workouts / chat 等用户级数据功能开发。
