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
## 2026-04-28 阶段 1.2 - Workout CRUD Backend Batch 1

### 完成内容
- 新增 `shared/src/training.ts`，定义 workout / set 相关 DTO、请求类型和删除响应契约。
- `shared/src/index.ts` 追加训练日志相关类型导出，为后续 server service / route 落地做准备。
- 新增 `server/src/schemas/workout-schemas.ts`，补齐创建 workout、更新 workout、追加 set、更新 set、列表查询的 Zod schema。
- 在类型和 schema 层固化 `set_index` 语义、组合 cursor 约定和统一删除响应格式，但不提前实现 cursor decode、事务、ownership 或 route。

### 改动文件
- `shared/src/training.ts`
- `shared/src/index.ts`
- `server/src/schemas/workout-schemas.ts`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/shared type-check`
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`

### 遗留问题
- `api-contract.md` 当前仍把 workout 列表的 cursor 描述为单 `id`，与本批固定的 `performed_at + id` 组合 cursor 契约不一致，暂不在本批修文档。
- `cursor` 本批只做字符串校验，真正的 base64 decode、结构化解析和错误映射放到 Batch 2 repository / service。
- `set_index` 本批只固定语义和正整数校验，不做自动生成或同一 workout + exercise 内的序号冲突处理。

### 下一步
- 进入 Batch 2，在 `db` 层新增 `workouts-repository.js`，落地组合 cursor 分页、set ownership SQL 入口、create workout + sets 事务能力，并补齐 `.d.ts` 类型声明。

## 2026-04-28 阶段 1.2 - Workout CRUD Backend Batch 2

### 完成内容
- 新增 `server/src/db/repositories/workouts-repository.js`，把 workout 主查询、set ownership SQL、组合 cursor 分页和 create workout + sets 事务入口收口到 db 层。
- 新增 `encodeWorkoutCursor` / `decodeWorkoutCursor`，固化 `performed_at + id` 的 base64 cursor 契约，列表查询按 `performed_at DESC, id DESC` 执行分页。
- `createWorkoutWithSets` 使用显式事务，任一 set 插入失败都会 rollback，不会留下半条 workout。
- `updateSetByIdForUser` 和 `deleteSetByIdForUser` 都通过 `sets -> workouts -> user_id` 的 ownership 链路执行，不会只按 set id 直接修改或删除。
- 新增 `workouts-repository.d.ts`，并在 `index.d.ts` 追加 re-export，避免 TypeScript service 吃到 `any`。

### 改动文件
- `server/src/db/repositories/workouts-repository.js`
- `server/src/db/repositories/workouts-repository.d.ts`
- `server/src/db/repositories/index.js`
- `server/src/db/repositories/index.d.ts`
- `docs/progress.md`

### 验证命令
- `node --check server/src/db/repositories/workouts-repository.js`
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`

### 遗留问题
- repository 已完成 db 层收口，但尚未有 service 层将 `cursor` decode 错误、not found、forbidden 映射成 HTTP 语义。
- 列表 query 当前默认 `limit = 20`、最大 `100`，后续 service / route 需要继续保持同一契约。
- set 变更后如果要直接返回 workout detail，后续 service 可以在 repository 基础上继续组装，本批不提前进入业务层。

### 下一步
- 进入 Batch 3，在 `services/training` 接入 workout / set 业务编排和错误映射，并为 ownership、cursor、事务逻辑补全 service test。

## 2026-04-28 阶段 1.2 - Workout CRUD Backend Batch 3

### 完成内容
- 新增 `server/src/services/training/workout-service.ts`，把 workouts repository 编排成业务语义：列表、详情、创建、更新、删除、追加 set、更新 set、删除 set。
- service 层做了 3 类关键处理：
  - 将 repository 行结构映射 / 校验为 DTO
  - 将 `Invalid workout cursor.` 映射为 `400 VALIDATION_ERROR`
  - 在 ownership SQL 返回 `null` 时通过 `hasWorkoutById` / `hasSetById` 区分 `403 FORBIDDEN` 和 `404 NOT_FOUND`
- 新增 `server/src/services/training/workout-service.test.ts`，覆盖列表 cursor、workout ownership、set ownership、统一删除响应等关键业务逻辑。
- 按本阶段文件数限制，本批未提前进入 controller / route / app.test。

### 改动文件
- `server/src/db/repositories/workouts-repository.js`
- `server/src/db/repositories/workouts-repository.d.ts`
- `server/src/services/training/workout-service.ts`
- `server/src/services/training/workout-service.test.ts`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server test`
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`

### 遗留问题
- 本批 service 直接 `import ../../db/repositories/workouts-repository.js`，是为了在不扩大文件数量的情况下保持类型完整；后续如果要统一收口到 `index.js`，可在 route / controller 接入阶段一并调整。
- `updateUserWorkoutSet` 当前返回的是单个 `WorkoutSetDto`；如果希望和 add set 保持一致返回 workout detail，可在 Batch 4 前先拉齐接口决策。
- route / app 层的 `401 / 201 / 403 / delete response` 闭环测试仍留在后续 Batch 4-5。

### 下一步
- 进入 Batch 4，接入 dictionary / workout controllers 和 routes，但只追加 route mount 和新的 describe，不重写已有 `app.ts` / `app.test.ts` 结构。

## 2026-04-28 阶段 1.2 - Workout CRUD Backend Batch 4A

### 完成内容
- 新增 `server/src/services/training/dictionary-service.ts`，给 `muscle_groups` 和 `exercises` 字典查询补上 service 层，避免 controller 直接调 db repository。
- 新增 `server/src/controllers/dictionaries-controller.ts`，接通 `GET /api/muscle-groups` 和 `GET /api/exercises` 的输入解析和成功响应封装。
- 新增 `server/src/controllers/workout-controller.ts`，接通 workout / set 相关 CRUD controller，仅解析参数、调 service、返回统一响应。
- 新增 `server/src/routes/api.ts`，把 dictionary 和 workout / set endpoint 收口到同一个 `apiRouter`，后续只需在 `app.ts` 做一次 mount。
- 按当前 5 个手写文件上限，本批暂不改 `app.ts` / `app.test.ts`，下一批根据“只追加 mount 和 describe”要求单独接入。

### 改动文件
- `server/src/services/training/dictionary-service.ts`
- `server/src/controllers/dictionaries-controller.ts`
- `server/src/controllers/workout-controller.ts`
- `server/src/routes/api.ts`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`

### 遗留问题
- `apiRouter` 已完成，但尚未挂载到 `app.ts`，因此本批尚不构成可实际访问的 HTTP 闭环。
- `updateSetController` 当前响应是 `{ ok: true, data: { set } }`，与 `add set` 返回 `{ workout }` 是刻意的；如果希望两种写操作完全同形，需要在 Batch 4B 前先讨论接口形状。
- route / app 层的 `401 / 201 / 403 / delete response` 验证仍待下一批的 app test 追加。

### 下一步
- 进入 Batch 4B，只改 `app.ts` 和 `app.test.ts`，把 `apiRouter` 接入到 `/api`，并在不删除现有测试的前提下追加 dictionary / workout route smoke。

## 2026-04-28 阶段 1.2 - Workout CRUD Backend Batch 4B

### 完成内容
- `server/src/app.ts` 新增 `apiRouter` mount，将 `GET /api/muscle-groups`、`GET /api/exercises`、`/api/workouts*`、`/api/sets/:id` 正式接入 Express app。
- `server/src/app.test.ts` 在不删除现有测试的前提下，追加 route / app 级 smoke，覆盖你之前指定的 4 个点：
  - 未登录 401
  - 创建 workout 返回 201
  - 跨用户访问被拒绝
  - DELETE 返回统一 `{ deleted: true, id }`
- route test 里通过 mock `verifyJwt` 和 `workout-service`，只验证 HTTP 层启用的路由、鉴权、状态码和响应封装，不重复测 service 逻辑。

### 改动文件
- `server/src/app.ts`
- `server/src/app.test.ts`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/server test`（当前沙箱内仍受 `spawn EPERM` 影响）

### 遗留问题
- app test 和 server test 在当前沙箱内仍无法真正启动 Vitest/Vite，原因仍是 `esbuild` 子进程 `spawn EPERM`，不是本批逻辑错误。
- `dictionary` route 本批已完成 mount，但未单独追加 route smoke；目前优先覆盖用户明确要求的 workout 关键路径。
- `PATCH /api/sets/:id` 的响应形状当前是 `{ data: { set } }`，后续如果需要和其它写操作统一成 `{ workout }`，需要另提最小接口形状变更方案。

### 下一步
- 进入 Batch 5，继续做 route / app 收口，或者开始补 `docs/api-contract.md` 中 cursor 描述与现有实现的对齐。
## 2026-04-29 闃舵 1.2 - Workout HTTP APIs Batch 5

### 瀹屾垚鍐呭
- 鏂板 `server/src/routes/workouts.ts`锛屽皢 `/api/workouts*` 鍜?`/api/sets/:id` 鐨?HTTP 鍏ュ彛鐙珛鏀跺彛锛屽苟鍦?router 绾у埆缁熶竴鎸傚湪 `authMiddleware` 鍚庛€?
- `server/src/routes/api.ts` 鍙繚鐣?dictionary route锛屼笉鍐嶆妸 workout / set endpoint 鍜屽瓧鍏告煡璇㈡贩鍦ㄤ竴涓?router 閲屻€?
- `server/src/app.ts` 琛ラ綈 `ZodError -> 400 VALIDATION_ERROR` 鏄犲皠锛屼娇 body / params / query 鏍￠獙澶辫触鏃剁殑鐘舵€佺爜鍜屽搷搴斿寘瑁呬笌 `api-contract.md` 瀵归綈銆?
- `server/src/controllers/workout-controller.ts` 鎶?workout / set `id` 鍙傛暟瑙ｆ瀽鏀舵嫝鍒颁竴涓皬 helper锛屼繚鎸?controller 鍙仛钖勫眰鐨勮В鍙傘€佽皟 service銆佽繑鍝嶅簲銆?
- `server/src/app.test.ts` 鎵╁睍 route smoke锛岃鐩栨湭鎺堟潈鎷︽埅銆乸ost workout 201銆乸atch workout 绂佹 `sets` 鏁村寘鏇挎崲銆乸ost set 201銆乸atch set 200銆乨elete set 200锛屼互鍙婅法鐢ㄦ埛 `403` 鍦烘櫙銆?

### 楠岃瘉鍛戒护
- 璁″垝鎵ц `pnpm --filter @fitmind/server test`
- 璁″垝鎵ц `pnpm --filter @fitmind/server type-check`
- 璁″垝鎵ц `pnpm lint`
- 璁″垝鎵ц `pnpm --filter @fitmind/server dev`

### 閬楃暀闂
- Batch 5 鐨勭湡瀹炵幆澧?smoke 浠嶄緷璧?`server/.env.local` 涓殑鏁版嵁搴撳拰 JWT 閰嶇疆锛屽鏋滆繍琛屾湡鏆撮湶鏂扮殑濂戠害缂哄彛锛屽啀鍐冲畾鏄惁杩藉姞 `docs/troubleshooting.md`銆?
- `PATCH /api/workouts/:id` 褰撳墠鏄€氳繃 schema 鏄庣‘鎷掔粷 `sets` 瀛楁锛屼粠鍚庣濂戠害灞傞潰淇濊瘉鈥滃彧鏀?workout metadata锛屼笉鍋氭暣鍖?sets 鏇挎崲鈥濄€?

### 涓嬩竴姝?
- 杩涘叆 Batch 6锛屾墽琛?lint / type-check / test / verify / 鎵嬪姩 API smoke锛岀‘璁?register/login銆佸瓧鍏告煡璇乷orkout CRUD銆乻et CRUD 鐨勭湡瀹為棴鐜笌鏂囨。鏀跺彛銆?
## 2026-04-29 阶段 1.2 - Closeout Verification Fix & Smoke Stabilization

### 完成内容
- 清掉了 `pnpm format:check` 的既有 Prettier 欠账，收口 10 个已报警文件，确认失败点不再停留在格式层。
- 新增 `server/scripts/workout-api-smoke.ts`，把 Phase 1.2 的真实 HTTP 验证固定成可复跑脚本：
  - 脚本内自动读取 `server/.env.local`
  - 若本地未提供 `JWT_SECRET`，仅为当前 smoke 进程注入回退 secret，不改业务代码和持久配置
  - 脚本内自启本地 app，不要求手动先跑 `pnpm --filter @fitmind/server dev`
  - 真实覆盖 `401`、`register`、`exercise lookup`、`workout create/list/get/update/delete`、`set add/update/delete`
- 修复 `server/src/services/training/workout-service.ts` 的真实运行时映射问题：
  - PostgreSQL 返回 `Date` 时，将 `performed_at` / `created_at` 归一化为 ISO string
  - PostgreSQL `numeric` 列返回字符串时，将 `weight_kg` / `rpe` 归一化为 number
  - 避免真实请求在 service DTO 映射阶段被误判成 `400 VALIDATION_ERROR`
- 在提权环境下完成 `pnpm verify`，确认 `lint + format:check + type-check + test` 全绿。

### 改动文件
- `server/scripts/workout-api-smoke.ts`
- `server/src/services/training/workout-service.ts`
- `docs/progress.md`
- `docs/troubleshooting.md`

### 验证命令
- `pnpm format:check`
- `pnpm verify`
- `pnpm --filter @fitmind/server exec tsx scripts/workout-api-smoke.ts`

### 验证结果
- `pnpm format:check`：通过
- `pnpm verify`：通过
- `workout-api-smoke.ts`：通过，主链路全绿

### 遗留问题
- `pnpm type-check` 和 `tsx` 类命令在当前沙箱内仍会遇到 `spawn EPERM`，但在提权环境下已验证通过；这属于执行环境限制，不是本批业务逻辑失败。
- smoke 依赖真实 `DATABASE_URL`；`JWT_SECRET` 若缺失，脚本会仅在当前进程内使用回退值以稳定验证路径。
- Neon 连接串当前会打印 `sslmode=require` 的上游警告，但不影响本批 Phase 1.2 收口结果。

### Phase 1.2 收口结论
- Workout CRUD backend 的格式、测试、类型检查和真实 HTTP smoke 已全部收口。
- 本次未进入 Phase 1.3，未写前端，未做新功能，未修改 schema。
## 2026-04-30 Phase 1.3 - Client Auth + Workout UI MVP Batch 1

### Completed work
- Added a shared `client` HTTP helper that uses `VITE_API_BASE_URL ?? ""`, sends JSON requests, injects an optional Bearer token, and maps API/network failures to readable client errors.
- Added `client/src/features/auth/use-auth.ts` as the Batch 1 auth skeleton: in-memory token only, no persistence, minimal auth state, and `/api/auth/me` token validation.
- Updated the Phase 0 placeholder app into a minimal auth shell that shows current auth status and explicitly states that login/workout UI are still out of scope.
- Updated the Vite dev server config so local `/api` requests proxy to `http://localhost:3000`, avoiding browser CORS issues during development.

### Changed files
- `client/vite.config.ts`
- `client/src/services/http-client.ts`
- `client/src/features/auth/use-auth.ts`
- `client/src/App.tsx`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/client type-check`
- `pnpm lint`
## 2026-04-30 Phase 1.4 - Client Workout UX Stabilization & Manual Smoke

### Completed work
- Tightened the workout creation flow with field-level validation for invalid datetime input, missing exercise selection, negative numeric values, and out-of-range RPE values.
- Centralized form feedback inside `use-workout-form`, including inline field errors, top-level submit guidance, and a clear success message after save-and-refresh completes.
- Improved the authenticated single-page shell so it reflects the current workout logging MVP instead of earlier placeholder copy.
- Added minimal authenticated workout deletion on the client via the existing `DELETE /api/workouts/:id` contract, using hook-owned delete state and a browser-native confirmation flow.
- Polished the workout log panel with clearer empty/loading/detail placeholder states and more readable workout/detail copy for duration, notes, set type, and exercise-name fallback.
- Wrapped `window.fitmindAuthDebug` in a DEV-only guard so local auth helpers remain available without leaking into non-DEV builds.
- Completed a real local smoke run against the running backend and frontend: register, exercise search, create multi-set workout, list, detail, delete, and post-delete list verification.

### Changed files
- `client/src/features/training/use-workout-form.ts`
- `client/src/features/training/WorkoutForm.tsx`
- `client/src/features/training/workout-api.ts`
- `client/src/features/training/use-workouts.ts`
- `client/src/features/training/WorkoutsPanel.tsx`
- `client/src/App.tsx`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/client type-check`
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- `pnpm dev:server`
- `pnpm --filter @fitmind/client dev -- --host 127.0.0.1`
- `Invoke-WebRequest http://127.0.0.1:3000/api/health`
- `Invoke-WebRequest http://127.0.0.1:5173`
- Real HTTP smoke via `Invoke-RestMethod` for register, exercise lookup, workout create/list/detail/delete

### Verification notes
- Backend health endpoint returned `200`.
- Frontend dev server returned Vite HTML on `http://127.0.0.1:5173`.
- Real API smoke created a workout with 3 sets, loaded it in list/detail, deleted it successfully, and confirmed the deleted id no longer appeared in the follow-up list.
- No new API-contract mismatch was found in this phase, so no backend contract or schema changes were needed.

### Locked constraints
- Token storage is memory-only for MVP Batch 1.
- Refreshing the page clears auth state by design.
- This batch does not add `auth-api.ts`, auth forms, workout UI, or any AI-related features.
## 2026-04-30 Phase 1.3 - Client Auth + Workout UI MVP Batch 2

### Completed work
- Added `client/src/features/auth/auth-api.ts` to isolate auth-domain API calls for register, login, and current-user lookup on top of the shared HTTP client.
- Upgraded `client/src/features/auth/use-auth.ts` from a validation skeleton into the active auth state manager for register/login/me flows while keeping token storage memory-only.
- Added a minimal `AuthScreen` that supports register and login without introducing broader routing or workout UI.
- Updated `client/src/App.tsx` so anonymous/error/authenticating users see the auth screen and authenticated users see a minimal signed-in shell.

### Changed files
- `client/src/features/auth/auth-api.ts`
- `client/src/features/auth/use-auth.ts`
- `client/src/features/auth/AuthScreen.tsx`
- `client/src/App.tsx`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/client type-check`
- `pnpm lint`

### Locked constraints
- Token storage remains memory-only.
- Page refresh still clears auth state by design.
- This batch does not add workout form, workout list/detail, or AI-related UI.
## 2026-04-30 Phase 1.3 - Client Auth + Workout UI MVP Batch 3

### Completed work
- Added a training dictionary API layer for `/api/muscle-groups` and `/api/exercises`.
- Added a client hook that loads muscle groups and runs authenticated exercise searches with loading and error state.
- Added a minimal `ExercisePicker` UI so signed-in users can search the action dictionary before workout creation is implemented.
- Updated the authenticated shell in `App.tsx` to expose the dictionary search flow as the next usable training entry point.

### Changed files
- `client/src/features/training/dictionary-api.ts`
- `client/src/features/training/use-exercise-search.ts`
- `client/src/features/training/ExercisePicker.tsx`
- `client/src/App.tsx`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/client type-check`
- `pnpm lint`

### Locked constraints
- Token storage remains memory-only.
- This batch still does not add workout create/list/detail UI.
- Dictionary requests stay in feature/api layers instead of components.
## 2026-04-30 Phase 1.3 - Client Auth + Workout UI MVP Batch 4

### Completed work
- Added a workout API layer for creating workouts through `POST /api/workouts`.
- Added a workout form hook that owns draft state, exercise lookup, client-side payload shaping, and `set_index` generation grouped by `exercise_id`.
- Added a minimal workout creation UI with inline set editing and exercise selection.
- Updated the authenticated shell so the signed-in user can search exercises and submit a workout from the same MVP screen.

### Changed files
- `client/src/features/training/workout-api.ts`
- `client/src/features/training/use-workout-form.ts`
- `client/src/features/training/WorkoutForm.tsx`
- `client/src/App.tsx`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/client type-check`
- `pnpm lint`

### Locked constraints
- `set_index` is generated per exercise within a workout, not by global form order.
- Token storage remains memory-only.
- This batch still does not add workout list/detail UI.
## 2026-04-30 Phase 1.3 - Client Auth + Workout UI MVP Batch 5

### Completed work
- Extended the workout API layer with authenticated workout list and workout detail reads.
- Added a workouts hook that owns list loading, detail loading, selection state, and refresh behavior.
- Added a minimal workout browsing panel that lets signed-in users refresh their workout list and inspect a selected workout's detail and sets.
- Updated the authenticated app shell so dictionary search, workout creation, workout list, and workout detail now live in one MVP surface.

### Changed files
- `client/src/features/training/workout-api.ts`
- `client/src/features/training/use-workouts.ts`
- `client/src/features/training/WorkoutsPanel.tsx`
- `client/src/App.tsx`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/client type-check`
- `pnpm lint`

### Locked constraints
- Token storage remains memory-only.
- Workout list/detail requests stay inside training-layer API/hook files.
- This batch does not yet do full real browser/client-server closeout verification.
## 2026-04-30 Phase 1.3 - Client Auth + Workout UI MVP Batch 6

### Completed work
- Verified that the live local backend and frontend dev servers both respond over HTTP.
- Ran real authenticated API flow checks for register, login, me, exercise search, workout create, workout list, and workout detail.
- Fixed a real local-dev contract issue: the client proxy was locked to port `3000`, while the server default env port was still `3001`.
- Updated the shared example env file to match the current client/server dev contract and the `VITE_API_BASE_URL` naming used by the client HTTP layer.

### Changed files
- `server/src/env.ts`
- `.env.example`
- `docs/progress.md`
- `docs/troubleshooting.md`

### Validation commands
- `pnpm dev:server`
- `pnpm dev:client`
- `Invoke-WebRequest http://127.0.0.1:3000/api/health`
- `Invoke-WebRequest http://127.0.0.1:5173`
- Real HTTP auth + workout flow verification via `Invoke-RestMethod`
- `pnpm --filter @fitmind/client type-check`
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`

### Verification notes
- Backend health endpoint returned `200`.
- Frontend dev server returned Vite HTML on `http://127.0.0.1:5173`.
- Auth and workout HTTP chain passed end-to-end.
- Full interactive browser-path verification could not be automated in this environment because no runnable browser automation tool was available in the session.
## 2026-04-30 Phase 1.3 - MVP Polish

### Completed work
- Updated workout creation flow so a successful submit can trigger follow-up UI refreshes.
- Wired workout creation to refresh the workout list automatically after a successful save.
- Improved workout detail display so sets show human-readable exercise names when available instead of only raw `exercise_id`.

### Changed files
- `client/src/features/training/use-workout-form.ts`
- `client/src/features/training/WorkoutForm.tsx`
- `client/src/features/training/WorkoutsPanel.tsx`
- `client/src/App.tsx`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/client type-check`
- `pnpm lint`
## 2026-04-30 Phase 2.0 - Deterministic Training Calculation Layer MVP Batch 1

### Completed work
- Added an authenticated `GET /api/training/summary` backend endpoint that derives `user_id` from the verified bearer token instead of request input.
- Added date-range query validation for `start_date` and `end_date` in `YYYY-MM-DD` format, including an explicit invalid-range check when `end_date` is earlier than `start_date`.
- Added a dedicated repository query layer for deterministic training summary aggregation using only the existing `workouts`, `sets`, and `exercises` tables.
- Added a service layer that shapes totals, per-exercise aggregates, and calculation evidence into the API response contract.
- Kept workout CRUD contracts and database schema unchanged.

### Changed files
- `server/src/db/training-summary-repository.ts`
- `server/src/services/training/training-summary-service.ts`
- `server/src/controllers/workout-controller.ts`
- `server/src/routes/workouts.ts`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- Manual HTTP smoke via `Invoke-RestMethod` for register, exercise lookup, workout create, training summary read, and workout delete

### Verification notes
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm lint` passed.
- Manual HTTP smoke against `http://127.0.0.1:3000` passed for the new summary route.
- Smoke summary result for `start_date=2026-04-29` and `end_date=2026-04-29`: `workout_count=1`, `set_count=2`, `total_reps=14`, `total_volume=1150`, `evidence.workout_ids.length=1`.
## 2026-04-30 Phase 2.0 Batch 1.1 - Training Summary Regression Smoke/Test

### Completed work
- Added a dedicated `server/scripts/training-summary-api-smoke.ts` regression smoke in the same style as the existing workout API smoke script.
- Covered auth failure, validation failure, empty-range behavior, populated summary totals, evidence, deletion cleanup, and cross-user isolation for `GET /api/training/summary`.
- Re-checked the summary SQL date filter and confirmed it already uses the safe inclusive-end-date pattern:
  - `performed_at >= start_date::date`
  - `performed_at < (end_date::date + interval '1 day')`
- Kept the batch backend-only with no schema or contract changes.

### Changed files
- `server/scripts/training-summary-api-smoke.ts`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/server exec tsx scripts/training-summary-api-smoke.ts`

### Verification notes
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm lint` passed.
- The smoke required the same elevated `tsx` execution path used elsewhere in this repo because sandboxed `esbuild/tsx` spawning still hits `EPERM` in this environment.
- Training summary smoke passed with these scenarios:
  - unauthenticated `401`
  - invalid `start_date` `400 VALIDATION_ERROR`
  - `end_date < start_date` `400 VALIDATION_ERROR`
  - empty range returns zero totals and empty `by_exercise`
  - end-date boundary includes a workout created at `2026-04-29T23:59:59Z`
  - populated summary returns `workout_count=1`, `set_count=2`, `total_reps=14`, `total_volume=1150`
  - `evidence.workout_ids` includes the created workout id
  - second-user summary stays isolated
  - deleting the workout removes it from the follow-up summary
## 2026-04-30 Phase 2.0 Batch 2 - Frontend Readonly Training Summary Panel

### Completed work
- Added a client-side training summary API wrapper on top of the existing shared HTTP client for `GET /api/training/summary`.
- Added a dedicated training summary hook that computes the default last-30-days range on the client, auto-loads on authenticated mount, and exposes `summary`, `isLoading`, `errorMessage`, and `refresh`.
- Added a readonly summary panel to the authenticated shell with range label, key totals, top-exercise rows, and loading/error/empty states.
- Wired App-level refresh so successful workout creation refreshes both the workout list and the summary, and successful workout deletion refreshes the summary after the existing workout hook completes its cleanup.
- Kept the batch inside the requested five handwritten files with no backend, schema, route, or shared-contract changes.

### Changed files
- `client/src/features/training/training-summary-api.ts`
- `client/src/features/training/use-training-summary.ts`
- `client/src/features/training/TrainingSummaryPanel.tsx`
- `client/src/App.tsx`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/client type-check`
- `pnpm lint`

### Verification notes
- `pnpm --filter @fitmind/client type-check` passed after the frontend summary changes.
- `pnpm lint` passed after the frontend summary changes.
- Manual browser-path smoke was attempted only if feasible in this environment; if the local auth + browser flow is available, the intended check is login -> summary load -> create workout -> summary refresh -> delete workout -> summary refresh.

### 剩余风险
- 为了遵守单批最多 5 个手写文件的限制，summary DTO 目前刻意保留在前端本地定义；后续如果文件数限制放宽，仍然值得再做一次 shared contract 收敛。
- 面板样式目前使用本地 inline styles 近似实现 `docs/UI_SPEC.md`，因为规范里提到的专用 token 文件尚未真正落地到仓库中。
- 这一批仍然固定使用前端本地计算的最近 30 天时间范围，暂时没有暴露日期筛选控件。
## 2026-04-30 Phase 2.0 Batch 3 - 后端 Exercise Progress API

### 完成内容
- 在现有 auth middleware 之后新增了已鉴权的 `GET /api/training/exercise-progress` 后端接口。
- 新增了 `exercise_id`、`start_date`、`end_date` 的 query 校验，包括 UUID 校验、`YYYY-MM-DD` 格式校验，以及当 `end_date` 早于 `start_date` 时的非法范围保护。
- 新增了专门的 repository 查询层，只基于现有 `workouts`、`sets`、`exercises` 三张表做确定性的动作进展聚合。
- 新增了 service 层，用于整理新接口的 overall totals、per-session rollups、evidence ids 和确定性 calculation rules。
- 保持 workout CRUD 合同和数据库 schema 不变。

### 变更文件
- `server/src/db/exercise-progress-repository.ts`
- `server/src/services/training/exercise-progress-service.ts`
- `server/src/controllers/workout-controller.ts`
- `server/src/routes/workouts.ts`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- 如果本地 server 可用，则执行手工 HTTP smoke
## 2026-04-30 Phase 2.0 Batch 3.1 - Exercise Progress 回归 Smoke/Test

### 完成内容
- 新增了专用的 `server/scripts/exercise-progress-api-smoke.ts` 回归 smoke 脚本，风格与现有 workout 和 training summary smoke 脚本保持一致。
- 覆盖了 `GET /api/training/exercise-progress` 的这些场景：auth 失败、缺少 `exercise_id`、非法 `start_date`、非法日期范围、empty-range 行为、populated totals、session rollups、无关动作排除、跨用户隔离和删除后清理。
- 通过真实 HTTP 调用验证了新接口，并且 create/delete workout 仍然走现有 workout 合同，而不是绕过应用层直接操作数据。
- 保持这一批仅涉及后端，不修改 schema 和接口合同。

### 变更文件
- `server/scripts/exercise-progress-api-smoke.ts`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/server exec tsx scripts/exercise-progress-api-smoke.ts`
## 2026-04-30 Phase 2.0 Batch 4 - 前端只读 Exercise Progress Panel

### 完成内容
- 在现有共享 `http-client` 之上，为 `GET /api/training/exercise-progress` 新增了前端 exercise progress API 封装。
- 新增了专用的只读 exercise progress 面板，内部维护本地请求状态，在前端本地计算最近 30 天时间范围，并在未选择动作时保持 no-request 行为。
- 更新了 summary panel，使 top exercises 可以作为可点击的 progress 目标，同时保留现有 summary 刷新逻辑和只读 totals 展示行为。
- 更新了已登录状态下的应用壳层，使其统一持有 exercise-progress 选中状态，以及在成功 create/delete 且已选中动作时才变化的 progress refresh signal。
- 保持这一批仍在要求的 5 个手写文件之内，不修改后端、schema、route 或 shared contract。

### 变更文件
- `client/src/features/training/exercise-progress-api.ts`
- `client/src/features/training/ExerciseProgressPanel.tsx`
- `client/src/features/training/TrainingSummaryPanel.tsx`
- `client/src/App.tsx`
- `docs/progress.md`

### 验证命令
- `pnpm --filter @fitmind/client type-check`
- `pnpm lint`
- 如果本地 client/server 可用，则执行手工浏览器 smoke
## 2026-04-30 Phase 2.0 Batch 5 - 收尾文档与手工 Smoke 说明

### 完成内容
- 新增了 `docs/calculation-layer.md`，用于说明 Phase 2.0 中“先确定性、后 AI”的设计理由。
- 文档化了当前计算接口、它们的 evidence 字段、包含式日历输入、半开时间戳过滤、null-safe 聚合约定，以及 Epley 1RM 的近似性。
- 明确记录了用户隔离行为，并澄清未来与 tool-calling 的关系仅是下游可能性，而不是本阶段新增功能。
- 明确保留了 Phase 2.0 的非目标范围，使收尾文档继续对齐当前仓库约束和有意控制的边界。

### 变更文件
- `docs/progress.md`
- `docs/calculation-layer.md`

### 验证命令
- `pnpm --filter @fitmind/client type-check`
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/server exec tsx scripts/training-summary-api-smoke.ts`
- `pnpm --filter @fitmind/server exec tsx scripts/exercise-progress-api-smoke.ts`
- 仅在真实完成时才记录手工浏览器 smoke

## 2026-04-30 Phase 2.1 - Recommendation Context Builder

### Completed work
- Added an authenticated deterministic `GET /api/training/recommendation-context` backend endpoint that derives `user_id` only from auth middleware and validates `start_date` / `end_date` with the existing date-range rules.
- Added a recommendation-context service that reuses existing training summary and exercise-progress services, derives top-volume focus exercises, and assembles summary, focus exercises, recent workouts, and evidence into one context package.
- Added one repository query for latest-in-range recent workouts using the same safe half-open timestamp filter and keeping SQL in the repository layer.
- Added a dedicated regression smoke for recommendation-context covering auth, validation, empty ranges, populated context, isolation, and cleanup.
- Added a readonly frontend preview panel and feature API wrapper so authenticated users can inspect the deterministic context package without implying AI advice.
- Updated calculation-layer and interview docs to explain recommendation context as a deterministic pre-AI context builder.

### Changed files
- `server/src/db/recommendation-context-repository.ts`
- `server/src/services/training/recommendation-context-service.ts`
- `server/src/controllers/workout-controller.ts`
- `server/src/routes/workouts.ts`
- `server/scripts/recommendation-context-api-smoke.ts`
- `server/package.json`
- `client/src/features/training/recommendation-context-api.ts`
- `client/src/features/training/RecommendationContextPanel.tsx`
- `client/src/App.tsx`
- `docs/calculation-layer.md`
- `docs/interview-notes.md`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/server type-check`
- `pnpm --filter @fitmind/client type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/server exec tsx scripts/recommendation-context-api-smoke.ts`

### Verification notes
- Recommendation context remains deterministic and does not call any LLM, Tool Calling, SSE, or recommendation-generation path.
- The frontend panel is explicitly labeled as a deterministic preview and only renders for authenticated users.
- Manual browser-path smoke should only be marked passed if the authenticated create/load/delete flow is actually run end-to-end.

## 2026-04-30 Phase 2.1.1 - Browser Smoke Closeout

### Completed work
- Ran a real browser smoke against the local client and server for the authenticated recommendation-context flow.
- Confirmed the logged-in shell loads all three readonly calculation surfaces: Training Summary, Exercise Progress, and Deterministic Recommendation Context Preview.
- Confirmed the Exercise Progress panel shows a readable no-exercise-selected state before any summary selection.
- Created a workout with 2 sets, then confirmed the workout list, Training Summary, Recommendation Context Preview, and top-exercise-derived Exercise Progress all refreshed with the new deterministic data.
- Deleted the created workout and confirmed the workout list, Training Summary, and Recommendation Context Preview returned to empty state while Exercise Progress retained the selected exercise label and showed zeroed empty-range totals.
- Verified memory-only auth remains the product behavior by opening a fresh browser session after the authenticated flow and confirming the app loads in the anonymous login state.

### Changed files
- `docs/progress.md`

### Verification notes
- During browser automation, direct `agent-browser` button clicks were less reliable than native in-page submit/click calls for some interactions, but the underlying product flows completed successfully once the browser executed the page-native actions.
- A same-session `agent-browser reload` appeared to keep the authenticated shell visible once, but a fresh browser session opened immediately afterward loaded in the anonymous state and the client code still contains no token persistence via localStorage, sessionStorage, or cookies.
- No backend contract, schema, or product feature changes were needed for this closeout.

## 2026-05-02 Phase 3.0 Batch 1.1 - Tool Executor Smoke

### Completed work
- Added a backend-only AI tool type layer with authenticated execution context, strict argument validation, and typed `UNKNOWN_TOOL` / `VALIDATION_ERROR` executor errors.
- Registered three deterministic internal training tools: `get_training_summary`, `get_exercise_progress`, and `get_recommendation_context`.
- Added a provider-agnostic tool executor that validates args before delegating to the existing deterministic training services instead of duplicating calculation logic.
- Added a direct smoke script that creates test users and workout data through the existing auth/workout API patterns, then exercises the internal executor without any model provider.
- Verified injected `user_id` is rejected by strict tool schemas, so authenticated context remains authoritative for user isolation.

### Changed files
- `server/src/services/ai/tools/tool-types.ts`
- `server/src/services/ai/tools/training-tools.ts`
- `server/src/services/ai/tools/tool-executor.ts`
- `server/scripts/tool-executor-smoke.ts`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/server exec tsx scripts/tool-executor-smoke.ts`

### Verification notes
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm lint` passed.
- The new tool executor smoke passed after rerunning through the established elevated path because sandboxed `tsx/esbuild` execution still hits the known `spawn EPERM` environment issue in this workspace.
- Covered smoke scenarios:
  - registry contains all 3 deterministic tools
  - valid execution of `get_training_summary`
  - valid execution of `get_exercise_progress`
  - valid execution of `get_recommendation_context`
  - typed unknown-tool failure
  - typed validation failure for invalid date range
  - strict rejection of injected `user_id`
  - cross-user isolation via authenticated execution context
  - workout cleanup after the smoke run

### Remaining risks
- Tool result types are currently internal to the server and not yet promoted into `shared/`, which is acceptable for this backend-only batch but worth revisiting when a real model/tool-calling surface is introduced.
- The smoke currently verifies executor behavior through real app-backed setup data plus direct executor calls, but it does not yet cover future higher-level orchestration such as tool-call logging or provider integration, which remain intentionally out of scope.
## 2026-05-03 Phase 3.0 Batch 2 / 2.1 - Tool Call Log Persistence + Smoke

### Completed work
- Added a dedicated tool-call-log repository for inserting and reading `tool_call_logs` rows using the existing schema without migration changes.
- Integrated best-effort log persistence into the internal deterministic tool executor for successful runs, validation failures, unknown tools, and downstream execution failures.
- Added a single executor-side sanitization policy so persisted log input/output stays JSON-safe and avoids obvious secret-bearing keys and token-like values.
- Persisted compact tool output summaries instead of full deterministic payloads to keep logs smaller and safer while still making them useful for debugging.
- Extended the existing tool executor smoke to assert persisted success and error log rows, authenticated user scoping, and absence of obvious secret material in logged payloads.

### Changed files
- `server/src/db/tool-call-log-repository.ts`
- `server/src/services/ai/tools/tool-executor.ts`
- `server/scripts/tool-executor-smoke.ts`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/server exec tsx scripts/tool-executor-smoke.ts`

### Verification notes
- Schema compatibility was confirmed against the existing `tool_call_logs` table: nullable `message_id` supports internal non-chat calls, `tool_input` and `tool_output` support JSONB payloads, and `status` supports the required `success` / `error` values for this batch.
- The updated smoke verifies:
  - a successful deterministic tool call persists a `success` row
  - an unknown tool call persists an `error` row
  - an invalid deterministic tool call persists an `error` row with compact validation metadata
  - persisted rows are scoped to the authenticated `user_id`
  - persisted log payloads do not contain the active JWT token, `DATABASE_URL`, bearer strings, or obvious auth/header field names
- Logging is intentionally best-effort: log write failure does not break a successful deterministic tool result, and log write failure does not mask the original execution error path.

### Remaining risks
- The current sanitization rules are intentionally conservative and string-pattern-based; if future tool payloads become more varied, the policy may need a follow-up refinement or explicit allowlists per tool.
- `tool_output` now stores compact summaries rather than full deterministic payloads, which is the safer choice for this batch but means some deep debugging still requires replaying the original tool call.
## 2026-05-03 Phase 3.0 Batch 3 - Tool Calling Skeleton Docs and Interview Notes

### Completed work
- Added a dedicated `Phase 3.0 Tool Calling Skeleton` section to `docs/calculation-layer.md`.
- Documented the current internal tool set, provider-agnostic executor shape, authenticated execution context, and high-level tool-call-log behavior without implying real model integration.
- Expanded `docs/interview-notes.md` with a Phase 3.0 interview narrative, comparison framing, Chinese pitch, and Tool Calling Skeleton Q&A.
- Kept this batch documentation-only with no source code, API contract, or schema changes.

### Changed files
- `docs/calculation-layer.md`
- `docs/interview-notes.md`
- `docs/progress.md`

### Verification notes
- Performed a docs read-through against the current tool registry, executor, and tool-call-log implementation.
- Confirmed the documentation only claims what exists today:
  - three internal deterministic tools
  - authenticated execution context for `user_id`
  - no `user_id` in tool args
  - provider-agnostic executor
  - execution metadata logging when implemented
- Intentionally did not claim live model integration, chat, SSE, recommendation generation, RAG, MCP, agent orchestration, or frontend Tool Calling UI.
## 2026-05-03 Phase 3.1 Batch 1 / 1.1 - Assistant Orchestrator Skeleton + Mock-Turn Smoke

### Completed work
- Added an authenticated backend-only `POST /api/assistant/mock-turn` endpoint that derives `userId` from auth middleware and never accepts `user_id` from the request body.
- Added a deterministic mock assistant orchestrator service that validates `mode`, `message`, `start_date`, `end_date`, and `exercise_id` for `exercise_progress`, then dispatches exactly one internal tool through the existing tool executor.
- Kept the controller/route thin by reusing the existing authenticated training controller/router surface and moving tool selection, templated answer assembly, and evidence shaping into the service layer.
- Added an end-to-end smoke script that covers unauthenticated access, validation failures, populated responses for all three modes, user isolation, persisted tool-call logs, cleanup, and post-cleanup empty-state behavior.
- Kept this batch within 5 handwritten files and did not add any model SDKs, SSE, frontend UI, schema changes, or training API contract changes.

### Changed files
- `server/src/services/assistant/assistant-orchestrator-service.ts`
- `server/src/controllers/workout-controller.ts`
- `server/src/routes/workouts.ts`
- `server/scripts/assistant-mock-turn-smoke.ts`
- `docs/progress.md`

### Endpoint added
- `POST /api/assistant/mock-turn`

### Orchestration behavior
- `mode=training_overview` runs `get_training_summary`.
- `mode=exercise_progress` requires `exercise_id` and runs `get_exercise_progress`.
- `mode=recommendation_context` runs `get_recommendation_context`.
- All successful responses return `assistant_type: deterministic_mock`, one deterministic `tool_calls` item, templated `summary` + `bullets`, and evidence normalized to `source: deterministic_tool_executor`.
- Empty ranges still return valid deterministic mock responses instead of errors.

### Smoke scenarios covered
- unauthenticated request returns `401`
- invalid `mode` returns the existing `400 VALIDATION_ERROR` shape
- invalid `start_date` returns the existing `400 VALIDATION_ERROR` shape
- `end_date` earlier than `start_date` returns validation error
- `exercise_progress` without `exercise_id` returns validation error
- user A workout setup for populated deterministic responses
- `training_overview` response asserts `assistant_type`, `tool_calls`, and evidence
- `recommendation_context` response asserts executor evidence source and tool usage
- `exercise_progress` response asserts relevant evidence including set ids
- user B isolation through the same endpoint
- `tool_call_logs` persistence for executed assistant tools
- workout cleanup plus valid empty-state response after deletion

### Validation commands
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/server exec tsx scripts/assistant-mock-turn-smoke.ts`

### Verification notes
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm lint` passed.
- The first sandboxed smoke attempt hit the known `tsx/esbuild` `spawn EPERM` environment issue, so the smoke was rerun through the established elevated path.
- The elevated rerun of `pnpm --filter @fitmind/server exec tsx scripts/assistant-mock-turn-smoke.ts` passed end-to-end.
- A transient `POST /api/auth/register` `500` appeared during the first elevated smoke attempt, but it did not reproduce when the auth service and app-level register path were probed directly, and the full smoke passed on rerun. No confirmed assistant implementation bug remained after verification.

### Remaining risks
- The assistant response templates are intentionally narrow and deterministic for this skeleton batch; if future batches expand the mock answer surface, the response text and evidence summarization rules may need refactoring into smaller helpers or shared DTOs.
- The current skeleton executes exactly one deterministic tool per mode, which is correct for this batch but does not yet exercise any future multi-tool orchestration, retry, timeout, or model-driven decision flow.
## 2026-05-03 Phase 3.1 Batch 2 / 2.1 - Chat Session + Message Persistence and Smoke

### Completed work
- Confirmed the existing `chat_sessions` and `messages` schema is compatible with deterministic mock-turn persistence, so no migration changes were needed.
- Added a dedicated chat repository for creating sessions, resolving user-owned sessions, checking existence for `403` vs `404`, inserting messages, and reading sessions/messages for smoke verification.
- Extended `POST /api/assistant/mock-turn` input to accept optional `session_id`, creating a new user-owned chat session when absent and reusing the existing one when present and owned by the authenticated user.
- Persisted one `user` message and one `assistant` message for each successful deterministic mock turn using app-owned JSON only: user text blocks, assistant summary/bullets content, deterministic structured output, and minimal metadata.
- Returned `session_id` in every successful mock-turn response.
- Left `tool_call_logs.message_id` as `null` for this batch because the current executor persists logs internally and does not accept a caller-supplied persisted assistant message id without broader architectural change.
- Extended the existing assistant mock-turn smoke to verify session creation, message persistence, same-session append behavior, cross-user session denial, and absence of obvious auth/header/env secrets in persisted message payloads.

### Changed files
- `server/src/db/chat-repository.ts`
- `server/src/services/assistant/assistant-orchestrator-service.ts`
- `server/scripts/assistant-mock-turn-smoke.ts`
- `docs/progress.md`

### Schema compatibility result
- `chat_sessions` already supports authenticated ownership, optional title, and `last_message_at`, which is sufficient for mock-turn session persistence.
- `messages` already supports `role`, `content`, `structured_output`, `usage`, and `metadata`, which is sufficient for deterministic user/assistant message persistence.
- `tool_call_logs.message_id` remains nullable and was intentionally left `null` in this batch.

### Persistence behavior
- Successful mock turns now persist:
  - one `user` message with text-block `content`, `structured_output: null`, `usage: null`, and minimal date/mode metadata
  - one `assistant` message with deterministic summary/bullets `content`, full deterministic mock `structured_output`, `usage: null`, and minimal tool/mode metadata
- New sessions derive `title` from the first user message trimmed to the schema limit.
- Message insertion also updates `chat_sessions.last_message_at`.
- The persistence layer does not store JWTs, headers, env vars, or raw auth payloads as part of app-owned message metadata.

### session_id behavior
- If `session_id` is omitted, the backend creates a new session for the authenticated user and returns it.
- If `session_id` is provided and owned by the authenticated user, the backend appends the new user/assistant message pair to that session and returns the same id.
- If `session_id` exists but belongs to another user, the backend returns `403 FORBIDDEN` using the same ownership convention as the workout access path.
- If `session_id` does not exist, the backend returns `404 NOT_FOUND`.

### Validation commands
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/server exec tsx scripts/assistant-mock-turn-smoke.ts`

### Verification notes
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm lint` passed.
- The sandboxed smoke attempt hit the known `tsx/esbuild` `spawn EPERM` environment issue, so the smoke was rerun through the established elevated path.
- The first elevated smoke rerun again hit the previously observed transient `POST /api/auth/register` `500`, but the immediate rerun passed end-to-end.
- The passing smoke verified:
  - response includes `session_id`
  - one chat session is created for the first authenticated turn
  - persisted `user` and `assistant` messages exist for that session
  - a second turn with the same `session_id` appends to the existing session
  - a second user cannot reuse the first user鈥檚 `session_id`
  - persisted message payloads do not contain the active JWT token, `DATABASE_URL`, bearer strings, or `authorization` fields

### Remaining risks
- Message persistence currently happens after deterministic tool execution and is not wrapped together with tool-call logging in one transaction, so future batches may want a broader orchestration persistence boundary if stronger atomicity becomes important.
- `tool_call_logs` still cannot be linked to the persisted assistant `message_id` without reshaping the current executor API, so chat/message history and tool logs remain only indirectly related in this batch.
## 2026-05-03 Phase 3.1 Batch 3 - Assistant Orchestration Docs and Interview Notes

### Completed work
- Added a `Phase 3.1 Assistant Orchestration Skeleton` section to `docs/calculation-layer.md`.
- Documented that `POST /api/assistant/mock-turn` exists as a deterministic mock assistant endpoint, not a real AI-generated or streaming chat feature.
- Explained the current mode-based orchestration path, template answer construction, and optional chat session/message persistence behavior.
- Expanded `docs/interview-notes.md` with Phase 3.1 interview framing, comparison language for executor/orchestrator/provider/streaming chat, a Chinese pitch, and new deep-dive Q&A.
- Kept this batch documentation-only with no source code, API contract, or schema changes.

### Changed files
- `docs/calculation-layer.md`
- `docs/interview-notes.md`
- `docs/progress.md`

### Verification notes
- Performed a docs read-through against the current assistant orchestrator and chat persistence implementation.
- Confirmed the documentation only claims what exists today:
  - `POST /api/assistant/mock-turn`
  - deterministic mode-based tool selection
  - template answers from deterministic tool results
  - optional `session_id` chat persistence using `chat_sessions` and `messages`
  - no model provider calls
  - no streaming
  - no coaching recommendation generation
  - no `tool_call_logs.message_id` linkage yet
- Intentionally did not claim real provider integration, frontend assistant UI, SSE chat, multi-step tool loops, or recommendation generation.

## 2026-05-05 Phase 3.2 Batch 1 - Provider Adapter Interface + Mock Provider

### Completed work
- Added a provider-agnostic, non-streaming assistant provider boundary in the backend service layer.
- Added a deterministic mock provider implementation that can simulate a normal tool-call intent, a plain text provider message, or a provider error without calling any real model API.
- Wired the existing assistant orchestrator through the new provider adapter while keeping `POST /api/assistant/mock-turn` unchanged.
- Kept tool execution, evidence shaping, and chat session/message persistence owned by the assistant orchestrator rather than exposing provider-specific details to controllers.
- Preserved the existing internal tool executor and left `tool_call_logs.message_id` behavior unchanged.

### Changed files
- `server/src/services/assistant/provider-types.ts`
- `server/src/services/assistant/mock-provider.ts`
- `server/src/services/assistant/provider-adapter.ts`
- `server/src/services/assistant/assistant-orchestrator-service.ts`
- `docs/progress.md`

### Adapter interface added
- The new provider layer uses project-owned request and response types rather than any provider SDK payload shape.
- The request carries conversation text, validated assistant context, allowed tool definitions, and an internal simulation hint.
- The response supports exactly three deterministic outcomes:
  - `tool_call`
  - `message`
  - `error`

### Mock provider behavior
- Default behavior returns one deterministic `tool_call` mapped from the validated assistant mode.
- Reserved message prefixes are handled internally for simulation only:
  - `[mock:text]` returns a deterministic non-tool provider message
  - `[mock:error]` returns a deterministic provider error
- Normal requests still stay on the tool-call path so existing endpoint behavior remains stable.

### Validation commands
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`

### Verification notes
- The implementation keeps the public mock-turn request schema unchanged.
- Successful tool-backed turns still return `assistant_type: deterministic_mock`, include tool execution metadata, and persist chat messages.
- Provider-generated text fallbacks now return an assistant-shaped deterministic response without executing a tool.
- Provider-generated errors are converted into the existing `AI_PROVIDER_ERROR` convention.

### Remaining risks
- The current provider adapter only supports one non-streaming provider response and at most one tool call per run.
- Plain-text provider fallbacks now use backend-defined empty evidence rather than deterministic tool evidence, so future real-provider batches should decide whether to formalize that response shape more broadly.
- No real provider selection, env-flag routing, streaming, or multi-step model/tool loop exists yet in this batch.

## 2026-05-06 Phase 3.2 Batch 1.1 - Provider Adapter Smoke

### Completed work
- Added a standalone backend smoke for the provider adapter path at `server/scripts/assistant-provider-adapter-smoke.ts`.
- Covered the normal tool-backed mock provider path, the `[mock:text]` plain-text fallback path, and the `[mock:error]` provider-failure path.
- Verified successful normal/text runs still persist user and assistant messages through the existing Phase 3.1 chat persistence layer.
- Verified provider-path user isolation still holds: a second user cannot reuse the first user's session and only sees their own workout evidence.
- Kept this batch backend-only with no controller, route, request-schema, deterministic calculation, or real provider SDK changes.

### Changed files
- `server/scripts/assistant-provider-adapter-smoke.ts`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/server exec tsx scripts/assistant-provider-adapter-smoke.ts`

### Verification notes
- The normal provider path still returns `assistant_type: deterministic_mock`, executes one tool call, and exposes `deterministic_tool_executor` evidence.
- The `[mock:text]` path succeeds without tool execution, returns `tool_calls: []`, and exposes `deterministic_mock_provider` evidence without falsely claiming tool-derived ids or rules.
- The `[mock:error]` path is mapped into the existing backend error convention using `AI_PROVIDER_ERROR`.
- No real LLM integration, streaming, or multi-step tool loop is claimed in this batch.

## 2026-05-06 Phase 3.2 Batch 2 - Real Provider Adapter Behind Env Flag

### Completed work
- Added `ASSISTANT_PROVIDER` to the strict server env loader with `mock` and `anthropic` support, defaulting to `mock`.
- Added provider selection/config helpers so the adapter can choose the active provider without exposing env wiring to controllers.
- Added a real Anthropic non-streaming provider implementation using the Messages API over direct HTTP, without adding a provider SDK.
- Kept the assistant orchestrator and public `POST /api/assistant/mock-turn` contract unchanged while routing provider calls through the adapter boundary.
- Kept the provider layer limited to returning normalized `message`, `tool_call`, or `error` results and at most one tool call per run.

### Changed files
- `server/src/env.ts`
- `server/src/services/assistant/provider-config.ts`
- `server/src/services/assistant/anthropic-provider.ts`
- `server/src/services/assistant/provider-adapter.ts`
- `docs/progress.md`

### Verification notes
- `ASSISTANT_PROVIDER=mock` remains the default when no env override is present.
- Unsupported provider-requested tool names are normalized into provider errors instead of leaking raw provider details.
- The Anthropic path remains non-streaming and single-response only.
- No second provider call after tool execution was added in this batch.

## 2026-05-06 Phase 3.2 Batch 2.1 - Non-streaming Assistant Run Smoke

### Completed work
- Added `server/scripts/assistant-provider-run-smoke.ts` to cover both mock-provider and env-gated real-provider execution paths.
- Kept stable mock-provider smoke coverage for:
  - normal tool-backed path
  - `[mock:text]` plain-text path
  - `[mock:error]` provider-error path
- Added optional real-provider smoke coverage for `ASSISTANT_PROVIDER=anthropic` when `ANTHROPIC_API_KEY` is available.
- Verified successful runs still preserve `session_id` behavior, persist messages, and keep user isolation intact.

### Changed files
- `server/scripts/assistant-provider-run-smoke.ts`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/server exec tsx scripts/assistant-provider-run-smoke.ts`

### Verification notes
- Mock-provider smoke is expected to run reliably in local development.
- Real-provider smoke prints a clear skip message when `ANTHROPIC_API_KEY` is absent instead of failing.
- No raw provider payloads are expected to reach the controller response in either path.

## 2026-05-06 Phase 3.2 Batch 3 - Provider Adapter Docs and Interview Notes

### Completed work
- Documented the provider adapter layer and its current non-streaming, single-response, single-tool-call limits in `docs/calculation-layer.md`.
- Expanded `docs/interview-notes.md` with Phase 3.2 architecture framing, provider boundary explanations, and a Chinese pitch.
- Kept the documentation aligned with current implementation limits:
  - provider adapter exists
  - mock and Anthropic provider modes are env-switchable
  - orchestrator still owns business flow
  - provider still cannot query the database directly
  - SSE, frontend chat state machine, and multi-step tool loops are not implemented

### Changed files
- `docs/calculation-layer.md`
- `docs/interview-notes.md`
- `docs/progress.md`

### Verification notes
- Documentation claims were kept intentionally narrower than a full AI chat story.
- No claim is made that Phase 3.2 implements streaming, multi-step loops, coaching recommendation generation, or a finished frontend assistant product.

## 2026-05-07 Phase 3.3 Batch 1-2 - Evented Assistant Orchestrator + SSE Stream Smoke

### Completed work
- Added a backend-only `POST /api/assistant/stream-turn` SSE endpoint without changing frontend UI.
- Added project-owned assistant stream event types for state transitions, provider selection, tool lifecycle, answer deltas, done, and error.
- Refactored the assistant orchestrator to optionally emit execution events while preserving the existing non-streaming `POST /api/assistant/mock-turn` response contract.
- Kept validation, provider selection, tool permission checks, answer shaping, and chat persistence inside the orchestrator so the SSE controller stays provider-agnostic.
- Emitted real tool lifecycle events around the actual `executeAiTool` call and simulated streaming output by chunking the final answer text into deterministic `answer_delta` slices.
- Added a dedicated assistant router and moved assistant endpoints out of the workouts router without changing public paths.
- Added a backend smoke for SSE that verifies unauthenticated access, tool-backed streaming, `[mock:text]`, `[mock:error]`, second-user isolation, event order, `done` presence, `error` presence, and absence of obvious raw provider payload leakage.

### Changed files
- `server/src/services/assistant/assistant-stream-types.ts`
- `server/src/services/assistant/assistant-orchestrator-service.ts`
- `server/src/controllers/assistant-stream-controller.ts`
- `server/src/routes/assistant.ts`
- `server/src/routes/workouts.ts`
- `server/src/controllers/workout-controller.ts`
- `server/src/app.ts`
- `server/scripts/assistant-stream-smoke.ts`
- `docs/progress.md`

### Stream behavior
- Tool-backed runs emit:
  - `state: thinking`
  - `provider_selected`
  - `state: tool_calling`
  - `tool_call_started`
  - `tool_call_finished`
  - `state: answering`
  - one or more `answer_delta`
  - `done`
- `[mock:text]` emits thinking, provider selection, answering, delta chunks, and done without any tool lifecycle events.
- `[mock:error]` emits thinking, provider selection, and one SSE `error` event using the project error convention.
- The SSE payloads remain project-owned and do not expose raw Anthropic response blocks or transport metadata.

### Compatibility notes
- `POST /api/assistant/mock-turn` remains unchanged at the public contract level and still returns `assistant_type: deterministic_mock`.
- User identity for both assistant endpoints remains derived only from auth middleware locals.
- Chat session and message persistence still occur once per successful assistant turn using the same final deterministic response payload.

### Validation commands
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/server exec tsx scripts/assistant-stream-smoke.ts`

### Verification notes
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm lint` passed.
- The initial smoke attempt using `pnpm --filter @fitmind/server exec tsx scripts/assistant-stream-smoke.ts` failed because `tsx` was not resolved in this environment.
- The fallback attempt surfaced the known `tsx/esbuild` `spawn EPERM` issue.
- The smoke was rerun successfully through the established elevated execution path using the package-local `tsx.cmd`.
- The passing smoke verified exact SSE event order for tool-backed, `[mock:text]`, `[mock:error]`, and cross-user isolation paths.

## 2026-05-07 Phase 3.4 Batch 1-2 - Frontend Assistant SSE Client and Minimal Chat Panel

### Completed work
- Added a feature-scoped frontend assistant layer under `client/src/features/assistant`.
- Added project-owned frontend assistant types for chat status, stream events, request payloads, message state, and tool-call state.
- Added a low-level SSE client that sends `POST /api/assistant/stream-turn` with the in-memory auth token, parses `text/event-stream` frames, and normalizes non-stream responses through the existing HTTP error convention.
- Added a `useAssistantChat` hook that owns message state, chat status, active tool call, error message, stream lifecycle, abort handling, and retry behavior.
- Added a minimal authenticated assistant panel to `App.tsx` with:
  - input
  - send
  - stop
  - retry
  - status badge
  - tool-call card
  - progressively streamed plain-text message list
- Kept the existing deterministic training panels intact and added the assistant panel as a demo surface rather than a new app shell.

### Changed files
- `client/src/features/assistant/assistant-types.ts`
- `client/src/features/assistant/assistant-stream-api.ts`
- `client/src/features/assistant/use-assistant-chat.ts`
- `client/src/features/assistant/AssistantChatPanel.tsx`
- `client/src/features/assistant/AssistantMessageList.tsx`
- `client/src/features/assistant/AssistantToolCallCard.tsx`
- `client/src/App.tsx`
- `docs/progress.md`

### Frontend behavior
- The frontend chat state machine supports:
  - `idle`
  - `thinking`
  - `tool_calling`
  - `answering`
  - `done`
  - `error`
- User messages are appended immediately, and the assistant message is built incrementally from `answer_delta` events.
- `tool_call_started` and `tool_call_finished` drive a visible tool status card for:
  - `get_training_summary`
  - `get_exercise_progress`
  - `get_recommendation_context`
- `abort()` cancels the in-flight request and preserves already rendered messages.
- `retryLast()` resends the last assistant payload if a previous send already occurred.

### Compatibility notes
- The assistant demo panel currently fixes requests to `training_overview` and uses the same rolling 30-day range convention as the deterministic summary panels.
- No markdown rendering, session sidebar, chat-history hydration, RAG, MCP, or agent features were added in this batch.
- The current backend SSE stream does not emit `session_id`, so the frontend keeps a nullable `sessionId` slot ready for future backend expansion but cannot yet persist multi-turn server-side chat continuity from the stream path alone.

### Validation commands
- `pnpm --filter @fitmind/client type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/client exec vite build`

### Verification notes
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm lint` passed.
- `pnpm --filter @fitmind/client exec vite build` did not resolve `vite` in this environment.
- A direct package-local `vite.cmd build` attempt hit the known `esbuild` `spawn EPERM` sandbox issue.
- The client build was rerun successfully through the established elevated execution path using the package-local `vite.cmd`.

## 2026-05-07 Phase 3.4.1-3.4.2 - Assistant Session Continuity and Minimal UX Hardening

### Completed work
- Added SSE session metadata propagation so the streaming assistant path can preserve multi-turn continuity on the frontend.
- Added a new stream event shape `{ type: "session", session_id }` and included `session_id` again in the final `done` event as a fallback.
- Updated the frontend assistant hook to parse `session` events, store the returned `sessionId`, and automatically send it on later turns.
- Kept the existing `POST /api/assistant/mock-turn` response contract unchanged.
- Hardened the minimal assistant panel for demo use with:
  - quick prompt buttons for training overview, exercise progress, and recommendation context
  - clear conversation
  - retry after failures
  - stop/abort generation
  - visible state machine status
  - visible active tool-call card while tool execution is happening
- Reused the currently selected exercise from the existing deterministic training UI to support the exercise-progress quick prompt without adding a new picker or sidebar.

### Changed files
- `server/src/services/assistant/assistant-stream-types.ts`
- `server/src/services/assistant/assistant-orchestrator-service.ts`
- `server/scripts/assistant-stream-smoke.ts`
- `client/src/features/assistant/assistant-types.ts`
- `client/src/features/assistant/use-assistant-chat.ts`
- `client/src/features/assistant/AssistantChatPanel.tsx`
- `client/src/App.tsx`
- `docs/progress.md`

### Session continuity behavior
- The backend emits `session` immediately after resolving or creating the chat session.
- Tool-backed streams, `[mock:text]`, and `[mock:error]` now all preserve authenticated session context when a valid `session_id` is supplied.
- The frontend hook updates local `sessionId` from either the early `session` event or the `done.session_id` fallback.
- The current debug panel surfaces the active `sessionId` in a lightweight text row so continuity is visible during demos.

### Verification notes
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm lint` passed.
- `pnpm --filter @fitmind/server exec tsx scripts/assistant-stream-smoke.ts` did not resolve `tsx` in this environment.
- The direct package-local `tsx.cmd` smoke attempt hit the known `tsx/esbuild` `spawn EPERM` sandbox issue.
- The assistant stream smoke was rerun successfully through the established elevated package-local `tsx.cmd` path.
- `pnpm --filter @fitmind/client exec vite build` did not resolve `vite` in this environment.
- The direct package-local `vite.cmd build` attempt hit the known `vite/esbuild` `spawn EPERM` sandbox issue.
- The client build was rerun successfully through the established elevated package-local `vite.cmd` path.

## 2026-05-07 Phase 3.5 - Assistant SSE and Frontend State Machine Documentation Closeout

### Completed work
- Updated `docs/calculation-layer.md` to describe the current assistant chain from deterministic calculation layer through tool execution, provider adapter, SSE streaming, and frontend state machine.
- Added explicit explanation of why the provider does not query the database directly and why `user_id` always comes from auth context.
- Documented the current frontend state machine and why SSE improves UX compared with a single blocking assistant response.
- Added explicit current limits so the project does not overclaim real-provider streaming, multi-step tool loops, RAG, MCP, agent behavior, or coaching generation.
- Expanded `docs/interview-notes.md` with a current-state assistant architecture framing, deep-dive Q&A, and a Chinese 60-second interview pitch.
- Kept this batch docs-only and appended progress history rather than rewriting earlier entries.

### Changed files
- `docs/calculation-layer.md`
- `docs/interview-notes.md`
- `docs/progress.md`

### Verification notes
- Docs-only batch.
- No code changes or type-check requirements were needed for this phase.

## 2026-05-07 Phase 3.6 Batch 1 - Assistant Demo Workspace UI

### Completed work
- Added a new frontend-only `AssistantWorkspace` wrapper on the authenticated page to make the current assistant pipeline easier to understand during demos.
- Reframed the assistant area around visible architecture cards for:
  - `Training logs`
  - `Deterministic tools`
  - `Provider adapter`
  - `SSE stream`
  - `Assistant answer`
- Kept the current deterministic panels intact while making the assistant flow more legible with separate cards for tool inventory, state machine status, and session continuity.
- Updated the frontend assistant hook to surface the already-existing `provider_selected` stream event so the active provider adapter is visible without changing the SSE contract.
- Refactored the assistant chat panel into the workspace control area while preserving the existing SSE hook, quick prompts, stop, retry, clear conversation, status visibility, streamed answer rendering, and tool-call visibility.
- Kept the exercise-progress quick prompt wired to the currently selected exercise from the existing deterministic training UI and made that dependency clearer in the panel copy.

### Changed files
- `client/src/features/assistant/AssistantWorkspace.tsx`
- `client/src/features/assistant/AssistantChatPanel.tsx`
- `client/src/features/assistant/AssistantToolCallCard.tsx`
- `client/src/features/assistant/assistant-types.ts`
- `client/src/features/assistant/use-assistant-chat.ts`
- `client/src/App.tsx`
- `docs/progress.md`

### Demo UX notes
- The workspace now shows the three deterministic tools explicitly:
  - `get_training_summary`
  - `get_exercise_progress`
  - `get_recommendation_context`
- The assistant state machine is now visible as explicit status chips for:
  - `idle`
  - `thinking`
  - `tool_calling`
  - `answering`
  - `done`
  - `error`
- The workspace surfaces the current `sessionId` with a clear empty state before the first streamed turn.
- The active tool card now phrases the idle state as waiting for a deterministic tool call and shows tool status plus duration when available.

### Verification notes
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm lint` passed.
- `pnpm --filter @fitmind/client exec vite build` did not resolve `vite` in this environment.
- The direct package-local `vite.cmd build` attempt hit the known `vite/esbuild` `spawn EPERM` sandbox issue.
- The client build was rerun successfully through the elevated package-local `vite.cmd` path.

## 2026-05-07 Phase 3.7 Step 1 - Frontend Current State Audit

### Completed work
- 新增 `docs/frontend-current-state.md`。
- 盘点了当前前端页面、模块、数据流、assistant SSE 流程和后续 UI 重构约束。
- 本批 docs-only。
- 未修改源代码。
- 未运行 type-check / lint，因为没有代码改动。

## 2026-05-07 Phase 3.8 Batch 1 - Frontend Chinese Workspace Shell Refactor

### Completed work
- 新增深浅主题 token 和 `ThemeProvider`，并接入全局 `index.css`、移动端优先 390px 工作台壳层和底部三 Tab 导航。
- 将登录后页面重构为中文 `FitMind AI` 训练分析工作台，清晰拆分为“训练 / 分析 / AI 助手”三块主区域。
- 将 `AuthScreen` 改为中文登录/注册页，保留 token 仅保存在内存的现有认证语义。
- 重构 `AssistantWorkspace`、`AssistantChatPanel`、`AssistantMessageList`、`AssistantToolCallCard` 的展示层，保留 quick prompts、stop、retry、clear conversation、provider_selected、active tool call、sessionId 复用和 SSE 状态机语义不变。
- 重构 `TrainingSummaryPanel`、`ExerciseProgressPanel`、`RecommendationContextPanel` 的中文卡片壳层，保留 30 天范围、selected exercise 联动、deterministic preview 语义和刷新逻辑不变。
- 轻量重构 `WorkoutForm`、`WorkoutsPanel`、`ExercisePicker` 的中文文案和卡片布局，未改训练 CRUD、set_index 提交约定或任何 hook / API 业务流。

### Changed files
- `client/src/App.tsx`
- `client/src/main.tsx`
- `client/src/index.css`
- `client/src/theme/tokens.ts`
- `client/src/theme/ThemeContext.tsx`
- `client/src/components/AppShell.tsx`
- `client/src/components/Button.tsx`
- `client/src/components/Card.tsx`
- `client/src/components/Badge.tsx`
- `client/src/components/Pill.tsx`
- `client/src/components/StatusPill.tsx`
- `client/src/components/StatCell.tsx`
- `client/src/components/Icon.tsx`
- `client/src/components/IconButton.tsx`
- `client/src/components/Input.tsx`
- `client/src/features/auth/AuthScreen.tsx`
- `client/src/features/assistant/AssistantWorkspace.tsx`
- `client/src/features/assistant/AssistantChatPanel.tsx`
- `client/src/features/assistant/AssistantMessageList.tsx`
- `client/src/features/assistant/AssistantToolCallCard.tsx`
- `client/src/features/training/WorkoutForm.tsx`
- `client/src/features/training/WorkoutsPanel.tsx`
- `client/src/features/training/ExercisePicker.tsx`
- `client/src/features/training/TrainingSummaryPanel.tsx`
- `client/src/features/training/ExerciseProgressPanel.tsx`
- `client/src/features/training/RecommendationContextPanel.tsx`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/client type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/client exec vite build`

### Verification notes
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec vite build` 在当前环境先遇到 `vite` 命令解析问题，随后暴露已知 `vite/esbuild spawn EPERM` 沙箱限制；如需完整构建验证，需要提权环境执行。

## 2026-05-07 Phase 3.8 Batch 2 - Training Tab Product UI Refactor

### Completed work
- 重构训练 Tab 为中文移动端训练日志页，页面顺序调整为快速统计栏、记录训练主按钮、展开式 WorkoutForm、训练日志列表、动作词典折叠区。
- 新增快速统计栏，复用现有 training summary 数据展示本月训练、总容量和总组数。
- 新增 `TrainingView`、`TrainingStatsStrip`、`WorkoutCard`、`SetEditor`，把训练页展示层从 `App.tsx` 拆出，保留原有 create/delete 刷新链路。
- 将 `WorkoutForm` 重构为卡片式中文训练记录表单，保留 `performed_at`、`notes`、`sets` 数据结构和现有 submit API。
- 将 set 行产品化为独立小卡片，保留动作搜索、动作选择、热身组、组备注和至少一组的现有逻辑。
- 将 `WorkoutsPanel` 重构为中文训练日志列表和展开详情卡，保留 list/detail/delete 数据流与 `window.confirm` 删除确认。
- 将动作词典改为默认收起的中文查询区，保留原有搜索 API，不与 WorkoutForm 内动作选择串线。
- 保留训练 CRUD、`set_index`、create/delete refresh 逻辑，不修改后端、训练 API、assistant SSE、分析 Tab 和 AI 助手 Tab 核心逻辑。

### Changed files
- `client/src/App.tsx`
- `client/src/features/training/WorkoutForm.tsx`
- `client/src/features/training/SetEditor.tsx`
- `client/src/features/training/ExercisePicker.tsx`
- `client/src/features/training/WorkoutsPanel.tsx`
- `client/src/features/training/TrainingView.tsx`
- `client/src/features/training/WorkoutCard.tsx`
- `client/src/features/training/TrainingStatsStrip.tsx`
- `docs/progress.md`

### Validation commands
- `pnpm --filter @fitmind/client type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/client exec vite build`

### Verification notes
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec vite build` 在当前环境先遇到 `vite` 命令解析问题并复现已知 `spawn EPERM` 沙箱限制。
- 构建最终通过提权后的 package-local `vite.cmd build` 在 `client` 目录下完成验证。

## 2026-05-07 Phase 3.8 Batch 3 - Analysis Tab Product UI Refactor

### Completed work
- 将分析 Tab 重构为中文、移动端优先的确定性训练分析页，新增顶部说明卡，明确该页面来自后端 deterministic calculation layer，而不是 AI 生成建议。
- 新增 `AnalysisView`、`AnalysisStatsGrid`、`ExerciseInsightCard`，把分析页从 `App.tsx` 中拆出，保留现有数据传递和 selected exercise 联动语义。
- 重构 `TrainingSummaryPanel` 为“30 天总览 + 快速指标 + 主要训练动作”产品布局，保留 `summary.by_exercise` 点击后驱动 `ExerciseProgressPanel` 的现有逻辑。
- 重构 `ExerciseProgressPanel` 为中文动作进展卡片，展示最大重量、估算 1RM、训练次数、最近 5 次记录和 evidence 摘要，不再以调试面板风格直出数据。
- 重构 `RecommendationContextPanel` 为“AI 可用上下文预览”，拆分训练摘要、重点动作、最近训练、证据链四块内容，并保留 deterministic preview 定位与折叠式 `calculation_rules` 展示。
- 所有主文案已中文化，同时保留 `Deterministic`、`evidence`、`calculation_rules` 等必要技术标识。

### Changed files
- `client/src/App.tsx`
- `client/src/features/training/TrainingSummaryPanel.tsx`
- `client/src/features/training/ExerciseProgressPanel.tsx`
- `client/src/features/training/RecommendationContextPanel.tsx`
- `client/src/features/training/AnalysisView.tsx`
- `client/src/features/training/AnalysisStatsGrid.tsx`
- `client/src/features/training/ExerciseInsightCard.tsx`
- `docs/progress.md`

### Preserved logic
- 未修改 server、training API、assistant / SSE、auth token 逻辑。
- 未修改 workout 创建/删除后的刷新链路。
- 未修改 selected exercise 行为，点击动作后仍驱动现有 Exercise Progress 和 AI 助手上下文。
- 未将 Recommendation Context 描述为 AI 建议，仍保持 deterministic context preview 语义。

### Validation commands
- `pnpm --filter @fitmind/client type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/client exec vite build`

### Verification notes
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec vite build` 在当前环境先遇到 `vite` 命令解析问题，并复现已知 Windows / sandbox `spawn EPERM` 问题。
- 构建最终通过提权后的 package-local `vite.cmd build` 在 `client` 目录下完成验证。

## 2026-05-07 Phase 3.8 Batch 4 - AI Assistant Tab Product UI Refactor

### Changed files
- `client/src/features/assistant/AssistantWorkspace.tsx`
- `client/src/features/assistant/AssistantChatPanel.tsx`
- `client/src/features/assistant/AssistantToolCallCard.tsx`
- `client/src/features/assistant/AssistantMessageList.tsx`
- `client/src/features/assistant/AssistantIntroCard.tsx`
- `client/src/features/assistant/AssistantQuickPrompts.tsx`
- `client/src/features/assistant/AssistantMessageBubble.tsx`
- `client/src/features/assistant/AssistantComposer.tsx`
- `client/src/features/assistant/AssistantStatusRail.tsx`
- `docs/progress.md`

### What changed
- 将 AI 助手 Tab 从“调试工作台”重构为中文、移动端优先的产品化训练助手界面。
- 新增顶部说明卡，明确这是基于 SSE、Tool Calling 和 evidence 的训练助手，而不是普通聊天壳。
- 将 quick prompts 重构为中文产品卡片，保留 `training_overview`、`exercise_progress`、`recommendation_context` 三种 mode 语义不变，并继续在未选择动作时禁用“动作进展”。
- 新增中文状态栏，展示当前状态、`provider_selected` 和紧凑样式的 `sessionId`。
- 将消息区改为移动端聊天气泡和空状态文案，不再使用 raw JSON 或调试式消息盒。
- 将工具调用区改为清晰的产品状态卡，继续展示 `activeToolCall` 的工具名、状态和耗时，不暴露 token、header、env、secrets 或 raw provider payload。
- 将输入区改为移动端友好的底部提问体验，保留发送、停止、重试、清空四个入口。

### Preserved logic
- 未修改 server、assistant SSE endpoint contract、provider adapter、tool executor、training APIs 或 auth token 逻辑。
- 保留 `sendMessage`、`retryLast`、`abort`、`clearConversation` 的现有行为。
- 保留 `sessionId` 复用、`provider_selected` 展示、`activeToolCall` 展示和现有错误处理语义。
- 保留 `thinking` / `tool_calling` / `answering` / `done` / `error` 状态机。
- 保留 `answer_delta` 增量拼接逻辑。
- 未新增重复 assistant hook，也未改 SSE 解析逻辑或 quick prompt payload 结构。

### Validation commands
- `pnpm --filter @fitmind/client type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/client exec vite build`
- `.\node_modules\.bin\vite.cmd build`（`client` 目录）

### Verification results
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec vite build` 先遇到当前环境的 `vite` 命令解析问题，并复现已知 Windows / sandbox `esbuild spawn EPERM`。
- 构建最终通过提权后的 package-local `vite.cmd build` 在 `client` 目录下完成验证。

### Known environment issues
- 当前 Windows 环境下，标准 `pnpm --filter @fitmind/client exec vite build` 仍会受到 `vite` 命令解析和 `esbuild spawn EPERM` 影响。
- 已按既有验证路径使用 package-local `vite.cmd build` 完成等价构建验证。

## 2026-05-07 Phase 3.8 Batch 5 - Overall Polish & Local Run Guide

### Files changed
- `client/src/App.tsx`
- `client/src/index.css`
- `client/src/components/AppShell.tsx`
- `client/src/components/Button.tsx`
- `client/src/components/IconButton.tsx`
- `client/src/components/Input.tsx`
- `client/src/components/StateNotice.tsx`
- `client/src/features/auth/AuthScreen.tsx`
- `client/src/features/training/TrainingView.tsx`
- `client/src/features/training/ExercisePicker.tsx`
- `client/src/features/training/WorkoutForm.tsx`
- `client/src/features/training/WorkoutsPanel.tsx`
- `client/src/features/training/AnalysisView.tsx`
- `client/src/features/training/TrainingSummaryPanel.tsx`
- `client/src/features/training/ExerciseProgressPanel.tsx`
- `client/src/features/training/RecommendationContextPanel.tsx`
- `client/src/features/assistant/AssistantChatPanel.tsx`
- `client/src/features/assistant/AssistantComposer.tsx`
- `client/src/features/assistant/AssistantMessageList.tsx`
- `client/src/features/assistant/AssistantQuickPrompts.tsx`
- `client/src/features/assistant/AssistantStatusRail.tsx`
- `client/src/features/assistant/AssistantToolCallCard.tsx`
- `docs/local-run-guide.md`
- `docs/progress.md`

### UI polish summary
- 为训练、分析、AI 助手三大 Tab 补了统一的轻量状态组件 `StateNotice`，统一空态、错误态和提示态的视觉层级。
- 统一了训练日志、动作词典、训练表单、分析总览、动作进展、推荐上下文和助手面板的中文文案、卡片间距、按钮禁用态和说明文案。
- 清理了登录后页面残留的开发味调试提示，不再默认向用户展示开发调试文案。
- 保留 `provider`、`sessionId`、`SSE`、`Tool Calling`、`evidence`、`calculation_rules` 等必要技术标识，但不默认展示 raw debug JSON。
- 收紧了全局基础样式，包括 disabled opacity、按钮交互、输入占位文案和移动端 390px 密度。

### Local run guide summary
- 新增 `docs/local-run-guide.md`，基于仓库真实脚本和配置整理本地启动说明。
- 文档明确记录了项目结构、环境变量、端口、Vite proxy、安装与验证命令、migration / rollback / seed 方式、前后端启动命令、构建命令和 Windows fallback。
- 文档按当前仓库代码说明前端端口为 `5173`，没有把 `vite.config.ts` 改到 `5174`。

### Preserved logic
- 未修改 server 文件、training API contract、assistant API contract、SSE event names、provider adapter、tool executor、auth token 逻辑、训练 CRUD、selected exercise 行为、quick prompt mode/payload 和 `set_index` 逻辑。
- 保留 create / delete workout 后的现有 refresh 链路。
- 保留 `training_overview`、`exercise_progress`、`recommendation_context` 三种 quick prompt mode。

### Verification commands and results
- `pnpm --filter @fitmind/client type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/client exec vite build`
- 若标准构建命令复现已知 Windows `EPERM`，补记 package-local `vite.cmd build` fallback 结果。

### Verification notes
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec vite build` 先遇到当前环境的 `vite` 命令解析问题，并复现已知 Windows / sandbox `esbuild spawn EPERM`。
- 构建最终通过提权后的 package-local `vite.cmd build` 在 `client` 目录下完成验证。

### Known environment issues
- 当前 Windows 环境下，`vite/esbuild spawn EPERM` 和 `tsx/esbuild spawn EPERM` 仍可能影响构建与脚本执行。
- Git 仍可能在部分目录映射下提示 `dubious ownership`。
- Neon 连接串仍可能打印 `sslmode=require` 警告，但不一定影响真实连接结果。

## 2026-05-07 Phase 3.8 Batch 6 - Assistant Intent Routing & Mock Answer Polish

### Files changed
- `server/src/services/assistant/mock-provider.ts`
- `server/src/services/assistant/assistant-orchestrator-service.ts`
- `server/scripts/assistant-mock-turn-smoke.ts`
- `docs/progress.md`

### Intent routing fixes
- 将 mock provider 从“只看前端 mode”改为“结合 mode 和用户问题做意图纠偏”。
- 新增三类 mock-mode intent 判断：
  - 训练总览问题路由到 `get_training_summary`
  - 1RM / 最大重量 / 卧推深蹲硬拉等动作进展问题优先路由到 `get_exercise_progress`
  - 推荐上下文问题路由到 `get_recommendation_context`
- 当问题明显是动作进展 / 1RM，但当前请求没有 `exercise_id` 时，不再静默回退到 `get_training_summary`，而是返回中文提示，要求用户先去分析页选择动作。
- 保留前端 quick prompt 的现有 `mode` 语义，但允许 mock provider 在手动输入问题时纠偏到更合适的 tool。

### Answer template fixes
- 移除了 training overview 回答里的调试式英文文案，例如 `Deterministic mock summary` 和 `Top exercise rows`。
- 将 training summary、exercise progress、recommendation context 三类工具结果都改成中文、产品化回答模板。
- 训练总览回答现在会直接说明训练次数、组数、总次数、总容量、主要动作和 evidence workout 数量。
- 动作进展回答现在会直接说明动作名、估算 1RM、最高训练重量、最近记录数量、evidence workout / set 数量和 `calculation_rules`。
- 推荐上下文回答现在会明确说明这是 deterministic context preview，不是 AI 自动生成建议。
- provider message 路径下的产品化提示不再默认附带调试味内部 bullets。

### Preserved contracts
- 未修改 training API contracts、assistant API contracts、tool executor security model、SSE event names、frontend assistant SSE parser、auth token 逻辑、workout CRUD 或数据库 schema。
- 保留 `training_overview`、`exercise_progress`、`recommendation_context` 三种 public mode。
- 保留 `provider_selected`、`session`、`tool_call_started`、`tool_call_finished`、`answer_delta`、`done`、`error` 事件语义不变。
- 未引入 RAG、MCP、多 tool loop 或真实 Anthropic streaming 语义扩展。

### Verification commands and results
- `pnpm --filter @fitmind/client type-check`
- `pnpm --filter @fitmind/server type-check`
- `pnpm lint`
- `pnpm --filter @fitmind/server exec tsx scripts/assistant-mock-turn-smoke.ts`

### Verification notes
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm --filter @fitmind/server type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/server exec tsx scripts/assistant-mock-turn-smoke.ts` 先复现当前环境的 `tsx` 命令解析问题和已知 Windows / sandbox `esbuild spawn EPERM`。
- smoke 最终通过提权后的 package-local `.\node_modules\.bin\tsx.cmd scripts/assistant-mock-turn-smoke.ts` 在 `server` 目录下完成验证。
- smoke 已覆盖：
  - `看看我最近的训练总览。`
  - `预估我现在的卧推极限。`
  - `AI 会看到哪些训练数据？`

### Known environment issues
- 当前 Windows 环境下，`tsx/esbuild spawn EPERM` 仍会影响标准 smoke 运行路径，需要 package-local `tsx.cmd` fallback。
- Neon 连接仍会打印 `sslmode=require` 相关 warning，但本次 mock-turn smoke 最终执行通过。
- 当前仓库根目录仍可能触发 Git `dubious ownership` 提示，这属于本地环境配置问题，不是本批逻辑回归。

## 2026-05-07 Phase 3.9 Batch 1 - Demo Script & Project Study Guide

### Completed work
- 新增 `docs/demo-script.md`，整理本地演示定位、启动方式、逐步 demo flow、中文讲稿、预期结果、已知本地问题和恢复手册。
- 新增 `docs/project-study-guide.md`，整理项目定位、架构链路、deterministic calculation layer、tool executor、provider adapter、SSE stream、前端状态机、安全边界、当前限制和面试问答。
- 更新 `docs/progress.md`。
- 本批仅文档改动，没有 source code changes。

### Verification notes
- 本批未运行 type-check / lint / test / build。
- 仅执行了只读代码与文档核对，用于确认真实脚本、SSE 事件、tool names、provider 切换方式和当前能力边界。

## 2026-05-07 Phase 3.9 Batch 2 - Documentation Consolidation & README Entry

- README.md added or updated
- docs/project-study-guide.md consolidated
- no new standalone docs added
- no source code changes
- documentation overlap reduced

## 2026-05-07 Phase 3.9 Batch 3A - Workout Card Collapse Bug Fix

### bug found during manual smoke
- 手工浏览器 demo smoke 发现训练页已展开的 workout card 无法再次收起，阻塞正常产品交互。

### files changed
- `client/src/features/training/WorkoutCard.tsx`
- `client/src/features/training/WorkoutsPanel.tsx`
- `docs/progress.md`

### behavior fixed
- collapsed card 点击头部摘要区可以展开。
- expanded card 再次点击同一卡片头部摘要区可以收起。
- 已展开后再次点击同一卡片可以直接重新展开，不需要改动 workout CRUD 语义。
- 展开/收起按钮保留可用，并显式阻止事件冒泡。
- 删除按钮不会再意外触发父级卡片 toggle。

### contracts preserved
- 未修改 server 文件、training API contracts、workout CRUD semantics、`set_index` 逻辑、assistant 文件、SSE contract 或 auth token 逻辑。
- 本批仅修正训练日志卡片的前端交互层行为。

### verification results
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec vite build` 复现当前环境下的 `vite` 命令解析问题和 `esbuild spawn EPERM`。
- `client\\.\\node_modules\\.bin\\vite.cmd build` 在 sandbox 内仍复现 `esbuild spawn EPERM`。
- 提权后的 package-local `vite.cmd build` 最终通过，确认本批前端改动可生产构建。

## 2026-05-07 Phase 4.0 Batch 1 - Fullscreen Training Session Composer Shell

### why this batch exists
- 旧的展开式 `WorkoutForm` 更像一次性表单，不像真实训练记录 App 的会话流。
- 本批先把“记录训练”的交互模型切到全屏训练会话壳层，建立后续 Batch 2/3 可继续扩展的产品骨架。

### files changed
- `client/src/features/training/TrainingView.tsx`
- `client/src/features/training/TrainingSessionComposer.tsx`
- `client/src/features/training/TrainingSessionTimer.tsx`
- `client/src/features/training/TrainingSessionEmptyState.tsx`
- `docs/progress.md`

### new composer shell behavior
- 训练 Tab 点击“记录训练”后，不再展开旧的内联 `WorkoutForm`，而是打开覆盖整个 app shell 的全屏 composer。
- composer 顶部提供 `取消`、训练计时显示、`开始 / 暂停` 控制和 `完成` 按钮。
- 主体默认显示空态：`还没有添加动作` / `点击右下角 + 从动作库添加本次训练动作。`
- 右下角保留 `+` 浮动入口占位，但本批仍为 disabled placeholder，不进入真实动作库。
- `完成` 采用 Option A 策略：在没有有效训练组时保持禁用，避免创建空 workout。

### timer behavior
- timer 为纯前端状态，初始为暂停和 `00:00:00`。
- 点击 `开始` 后每秒累加，点击 `暂停` 后停止。
- 关闭 composer 会重置本次 draft timer，不做后端持久化。
- 如后续接入真实训练组提交流程，当前实现会将 elapsed seconds 按分钟向下取整映射到现有 `duration_minutes` 提交字段。

### preserved backend and api contracts
- 未修改 server 文件、数据库 schema、training API contract、workout CRUD semantics 或 `set_index` 逻辑。
- 现有 `useWorkoutForm` / `createWorkout` 数据流保持原样，未引入新的 endpoint 或 payload 字段。
- assistant、SSE contract、auth token 逻辑均未改动。

### verification results
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec vite build` 复现当前环境的 `vite` 命令解析问题和 `esbuild spawn EPERM`。
- `client\\.\\node_modules\\.bin\\vite.cmd build` 在 sandbox 内仍复现 `esbuild spawn EPERM`。
- 提权后的 package-local `vite.cmd build` 最终通过，确认本批前端改动可生产构建。

### known environment issues
- 当前 Windows 环境下，标准 `pnpm exec vite build` 仍可能出现 `vite` 命令解析问题。
- 当前 sandbox 下 `esbuild spawn EPERM` 仍会影响标准构建与 package-local fallback，需要提权复核。
- 本批未接入真实动作库和训练组编辑，这些能力留待后续 Batch 实现。

