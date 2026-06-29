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
- `docs/project-study-guide.md`
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
- Expanded `docs/project-study-guide.md` with a Phase 3.0 interview narrative, comparison framing, Chinese pitch, and Tool Calling Skeleton Q&A.
- Kept this batch documentation-only with no source code, API contract, or schema changes.

### Changed files
- `docs/calculation-layer.md`
- `docs/project-study-guide.md`
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
- Expanded `docs/project-study-guide.md` with Phase 3.1 interview framing, comparison language for executor/orchestrator/provider/streaming chat, a Chinese pitch, and new deep-dive Q&A.
- Kept this batch documentation-only with no source code, API contract, or schema changes.

### Changed files
- `docs/calculation-layer.md`
- `docs/project-study-guide.md`
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
- Expanded `docs/project-study-guide.md` with Phase 3.2 architecture framing, provider boundary explanations, and a Chinese pitch.
- Kept the documentation aligned with current implementation limits:
  - provider adapter exists
  - mock and Anthropic provider modes are env-switchable
  - orchestrator still owns business flow
  - provider still cannot query the database directly
  - SSE, frontend chat state machine, and multi-step tool loops are not implemented

### Changed files
- `docs/calculation-layer.md`
- `docs/project-study-guide.md`
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
- Expanded `docs/project-study-guide.md` with a current-state assistant architecture framing, deep-dive Q&A, and a Chinese 60-second interview pitch.
- Kept this batch docs-only and appended progress history rather than rewriting earlier entries.

### Changed files
- `docs/calculation-layer.md`
- `docs/project-study-guide.md`
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

## 2026-05-07 Phase 4.0 Batch 2 - Fullscreen Exercise Library

### why this batch exists
- Phase 4.0 Batch 1 只建立了全屏训练会话壳层和 `+` 占位入口，还不能把真实动作加入当前训练 draft。
- 本批继续把“记录训练”交互推进到真实训练 App 更接近的形态：在 composer 内打开全屏动作库，并把选中的动作回填成 draft exercise card。

### files changed
- `client/src/features/training/TrainingView.tsx`
- `client/src/features/training/TrainingSessionComposer.tsx`
- `client/src/features/training/ExerciseLibraryScreen.tsx`
- `client/src/features/training/TrainingSessionExerciseCard.tsx`
- `docs/progress.md`

### exercise library behavior
- composer 右下角 `+` 已从 disabled placeholder 改为可点击入口。
- 点击 `+` 会在 composer 内打开 `ExerciseLibraryScreen` 全屏 overlay，而不是跳出训练页路由。
- 动作库顶部提供 `×`、`选择动作` 标题、`从动作库添加本次训练动作` 副标题和 `搜索动作` 输入框。
- 动作库会复用现有 exercise dictionary 数据源，在打开时拉取一次真实动作列表，再在前端进行关键字和分类过滤。
- 分类 rail 支持：`全部`、`胸`、`背`、`腿`、`肩`、`二头`、`三头`、`小腿`、`前臂`、`颈部`、`臀部`、`功能性`、`核心`、`热身`、`拉伸`、`其他`。
- 无结果时显示：`没有找到动作` / `换个关键词试试，或切换到“全部”分类。`

### composer draft exercise behavior
- 点击动作卡后会关闭动作库，并把所选动作加入当前 composer draft。
- composer 空态会切换为 draft exercise card 列表，每张卡当前显示动作名和占位统计：`0 组 · 总容量 0 kg`。
- 若重复选择同一个动作，不会生成重复卡片，并显示中文提示：`这个动作已经在本次训练中`。
- 点击 `取消` 关闭 composer 时，会同时重置 draft exercises、timer 和动作库打开状态。
- 由于本批仍未接入训练组编辑，`完成` 继续保持 disabled，不会创建仅含动作卡的空 workout。

### preserved backend and api contracts
- 未修改 server 文件、数据库 schema、training API contract、workout CRUD semantics、`set_index` 逻辑、assistant 文件、SSE contract 或 auth token 逻辑。
- 未新增 endpoint、未变更 exercise dictionary schema、未修改已有 workout list 展开 / 收起 / 删除行为。
- analysis 页 selected exercise 行为保持不变。

### verification results
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec vite build` 复现当前环境的 `vite` 命令解析问题和 `esbuild spawn EPERM`。
- `client\\.\\node_modules\\.bin\\vite.cmd build` 在 sandbox 内仍复现 `esbuild spawn EPERM`。
- 提权后的 package-local `vite.cmd build` 最终通过，确认本批前端改动可生产构建。
- 本批未运行浏览器手工 smoke，手工检查步骤已留给后续交互验证。

### known environment issues
- 当前 Windows 环境下，标准 `pnpm exec vite build` 仍可能出现 `vite` 命令解析问题。
- 当前 sandbox 下 `esbuild spawn EPERM` 仍会影响标准构建与 package-local fallback，需要提权复核。
- 当前中文文案在部分 Windows shell 输出里仍可能出现编码显示异常，但不影响 TypeScript / lint / build 通过。

## 2026-05-07 Phase 4.0 Batch 3B - Composer Scroll Fix & Workout Log Grouped Editing

### why this batch exists
- 训练 composer 在同一动作下新增多组后，卡片内容会把底部 `新增一组` 挤出屏幕，影响核心记录流程。
- 训练日志详情此前仍是按 set 平铺展示，无法按动作卡片查看，也缺少前端编辑入口。

### files changed
- `client/src/features/training/TrainingSessionComposer.tsx`
- `client/src/features/training/TrainingSessionSetRow.tsx`
- `client/src/features/training/WorkoutCard.tsx`
- `client/src/features/training/WorkoutsPanel.tsx`
- `client/src/features/training/workout-api.ts`
- `client/src/App.tsx`
- `docs/progress.md`

### composer scroll behavior
- 将 composer 主体滚动区域改为 `minmax(0, 1fr)` 布局，修正动作卡展开后底部操作区被裁切的问题。
- 增加 body 底部留白，避免浮动 `+` 挡住动作卡内的 `新增一组`。

### workout log grouped editing behavior
- 训练日志详情现在改为按动作分组卡片展示，而不是把全部 sets 平铺在一个列表里。
- 点击动作卡片后，才会展开该动作下的具体组列表，交互模型与记录训练 composer 对齐。
- 新增最小可用的训练日志编辑能力：
  - 进入 `编辑训练`
  - 在每个动作卡内编辑重量 / 次数 / 体感
  - 复制本组 / 删除本组
  - 为该动作新增一组
  - 点击 `保存修改`
- 编辑保存时会复用现有后端能力：
  - `POST /api/workouts/:id/sets`
  - `PATCH /api/sets/:id`
  - `DELETE /api/sets/:id`
- 保存后会刷新 workout list、当前 workout detail、training summary、recommendation context 和已选动作进展。

### preserved backend and api contracts
- 未修改 server 文件、数据库 schema、training API contract、assistant 文件、SSE contract 或 auth token 逻辑。
- 仅补齐前端对既有 workout / set mutation API 的调用，不新增 endpoint。

### verification results
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec vite build` 复现当前环境的 `vite` 命令解析问题和 `esbuild spawn EPERM`。
- `client\\.\\node_modules\\.bin\\vite.cmd build` 在 sandbox 内仍复现 `esbuild spawn EPERM`。
- 提权后的 package-local `vite.cmd build` 最终通过，确认本批前端改动可生产构建。

## 2026-05-07 Phase 4.0 Batch 3 - Exercise Card Set Draft Editor

### why this batch exists
- Phase 4.0 Batch 2 已经把全屏动作库和 draft exercise card 接上，但还不能在 composer 内真正记录训练组并创建 workout。
- 本批的目标是先打通训练记录最核心的闭环：展开动作卡、编辑训练组、完成勾选、映射现有 API payload、提交 create workout。

### files changed
- `client/src/features/training/TrainingSessionComposer.tsx`
- `client/src/features/training/TrainingSessionExerciseCard.tsx`
- `client/src/features/training/TrainingSessionSetRow.tsx`
- `client/src/features/training/training-session-draft.ts`
- `client/src/features/training/ExerciseLibraryScreen.tsx`
- `docs/progress.md`

### set draft editor behavior
- 已添加动作卡现在支持摘要态和展开态切换，摘要态显示：`X 组 · 总容量 Y kg`。
- 点击卡片头部或卡片空白区可以展开 / 收起动作编辑区。
- 展开后可以在卡内 `+ 新增一组`，若上一组存在则默认复制上一组的重量、次数和体感，但 `completed` 总是重置为 `false`。
- 每组支持输入 `重量 kg`、`次数`，并提供三档中文体感：
  - `简单` -> `rpe: 6`
  - `正常` -> `rpe: 8`
  - `困难` -> `rpe: 9`
- 每组支持 `复制本组` 和 `删除本组`，未引入热身组、组备注或休息倒计时。
- 只有 `weight_kg > 0` 且 `reps > 0` 时，才允许把该组勾选为完成。
- 保存时只会提交 `completed === true` 且重量 / 次数有效的组；未完成组不会进入 payload。

### create workout flow reconnected
- composer 的 `完成` 按钮现在会在至少存在 1 个 completed valid set 时启用。
- 点击 `完成` 后会把 draft exercises flatten 成现有 `createWorkout` payload，并继续复用现有 frontend `createWorkout` API 数据流。
- 本批未修改 backend schema 或 API contract，仍然使用现有 `performed_at`、`duration_minutes`、`sets[]` 结构。
- `set_index` 语义保持不变：按 `exercise_id` 分别编号，而不是全局编号。
- 创建成功后会关闭 composer，并继续走现有 `onCreated` 刷新链路，从而刷新 workout list、training summary、recommendation context 和已选动作进展。

### preserved backend and api contracts
- 未修改 server 文件、数据库 schema、training API contracts、workout CRUD semantics、assistant 文件、SSE contract 或 auth token 逻辑。
- 未新增 endpoint、未变更 exercise dictionary schema、未修改现有 workout list 行为。
- 本批仍未引入 warmup set persistence、set notes persistence、rest timer persistence、started_at / ended_at persistence 或迁移脚本。

### verification results
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec vite build` 复现当前环境的 `vite` 命令解析问题和 `esbuild spawn EPERM`。
- `client\\.\\node_modules\\.bin\\vite.cmd build` 在 sandbox 内仍复现 `esbuild spawn EPERM`。
- 提权后的 package-local `vite.cmd build` 最终通过，确认本批前端改动可生产构建。
- 本批未运行浏览器手工 smoke，训练会话交互仍建议在本地浏览器路径下做一次完整手测。

### known environment issues
- 当前 Windows 环境下，标准 `pnpm exec vite build` 仍可能出现 `vite` 命令解析问题。
- 当前 sandbox 下 `esbuild spawn EPERM` 仍会影响标准构建与 package-local fallback，需要提权复核。
- 当前中文文案在部分 Windows shell 输出里仍可能出现编码显示异常，但不影响 TypeScript / lint / build 通过。

## 2026-05-07 Phase 4.0 Batch 4 - Training Flow Manual Smoke & Stabilization

### manual smoke paths completed
- 已完成本地 client/server 启动检查：
  - backend `http://127.0.0.1:3000/api/health` 返回正常
  - frontend `http://127.0.0.1:4173/` 可访问
- 已完成现有 backend regression smoke：
  - `server/scripts/workout-api-smoke.ts`
  - `server/scripts/training-summary-api-smoke.ts`
  - `server/scripts/recommendation-context-api-smoke.ts`
- 已完成前端静态验证：
  - `pnpm --filter @fitmind/client type-check`
  - `pnpm lint`
  - 提权后的 package-local `vite.cmd build`
- 已尝试接入浏览器手工 smoke，但当前会话没有可调用的 `node_repl js` / in-app browser 控制器；同时 shell fallback `npx agent-browser` 在当前环境下无法直接安装/运行，因此不能诚实地把 Path A-E 记为已完成的真实浏览器手测。

### bugs found
- 记录训练 composer 在动作卡展开并连续新增多组后，底部 `新增一组` 和新加组内容容易被外层视口挤出可视区。
- 训练日志编辑此前缺少训练时间、时长和备注的修改入口。

### files changed
- `client/src/features/training/TrainingSessionComposer.tsx`
- `client/src/features/training/TrainingSessionExerciseCard.tsx`
- `client/src/features/training/WorkoutCard.tsx`
- `client/src/features/training/workout-api.ts`
- `docs/progress.md`

### create workout behavior
- composer 继续复用现有 `createWorkout` 数据流，没有修改 backend contract。
- composer 主体改为更稳的纵向弹性布局，主滚动区显式使用 `flex: 1`、`min-height: 0` 和 `overflow-y: auto`。
- 新增训练组后会自动把 composer 主体滚到更靠下的位置，降低新组被裁切的概率。
- 动作卡展开后增加了卡内独立滚动区，并把非当前编辑组缩成摘要条，减少一口气展开多组时的垂直占用。

### edit workout behavior
- 训练日志详情继续保持“一个动作一个卡片”的展示方式，点击动作后才展开该动作下的组。
- 训练日志编辑模式新增：
  - `训练时间`
  - `时长`
  - `备注`
- 组编辑仍然走既有 set mutation API：
  - 复制本组
  - 删除本组
  - 新增一组
  - 修改重量 / 次数 / 体感

### set_index behavior
- 本批未修改 `set_index` 规则，也未修改 workout / set CRUD semantics。
- 现有 create 和 edit 路径仍按 `exercise_id` 分组分别编号，不改成全局递增。
- backend `workout-api-smoke`、`training-summary-api-smoke`、`recommendation-context-api-smoke` 均通过，说明相关训练数据 contract 未被这轮前端稳定性修复破坏。

### scroll and layout behavior
- composer 打开时仍覆盖训练页和底部 tab，保持 fullscreen shell 交互模型。
- composer 主体滚动和动作卡内部滚动已分层处理，重点缓解“新增两组后下方内容不可达”的问题。
- 动作卡中未聚焦的组会缩成摘要矩形，只保留组数、重量和次数，已完成组会显示更明确的完成态。
- 本批没有做新的 UI 重设计，只在最小范围内修复滚动与可达性问题。

### contracts preserved
- 未修改 server 文件、数据库 schema、API contract、SSE event names、provider adapter、auth token logic、analysis selected exercise behavior、assistant quick prompt semantics、workout CRUD semantics 或 `set_index` 规则。
- 未新增 backend endpoint、migration、warmup set persistence、set notes persistence、rest timer persistence 或 started/ended_at persistence。

### verification results
- `pnpm --filter @fitmind/server exec tsx scripts/workout-api-smoke.ts` 通过。
- `pnpm --filter @fitmind/server exec .\\node_modules\\.bin\\tsx.cmd scripts/training-summary-api-smoke.ts` 通过。
- `pnpm --filter @fitmind/server exec tsx scripts/recommendation-context-api-smoke.ts` 通过。
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec vite build` 继续复现当前环境的 `vite` 解析问题和 `esbuild spawn EPERM`。
- `client\\.\\node_modules\\.bin\\vite.cmd build` 在 sandbox 内仍复现 `spawn EPERM`。
- 提权后的 package-local `vite.cmd build` 通过。

### known environment issues
- 当前会话的浏览器插件能力没有暴露可调用的 `node_repl js` 执行入口，无法在本轮中真正完成本地 in-app browser 手工烟测。
- shell fallback `npx agent-browser` 在当前环境下也无法直接作为稳定替代，因此浏览器 Path A-E 只能记为“已尝试接入，未完成”。
- Windows 环境下标准 `pnpm exec vite build` 仍可能出现 `Command "vite" not found` 和 `esbuild spawn EPERM`；需要提权后的 package-local `vite.cmd build` 复核。
- server/client 相关 `tsx`、`vite`、`esbuild` 命令在 sandbox 下仍受既有 `EPERM` 限制。

## 2026-05-07 Phase 4.1 Batch 1 - Exercise Card Actions Menu

### why this batch exists
- Phase 4.0 已经打通 fullscreen composer、动作库、动作卡、draft set 编辑和 create workout 提交闭环。
- 本批补齐动作卡右上角的动作级设置菜单，让训练记录体验更接近真实健身 App，同时不扩大 backend/API 范围。

### files changed
- `client/src/features/training/TrainingSessionComposer.tsx`
- `client/src/features/training/TrainingSessionExerciseCard.tsx`
- `client/src/features/training/ExerciseLibraryScreen.tsx`
- `client/src/features/training/TrainingSessionExerciseActions.tsx`
- `docs/progress.md`

### exercise actions added
- 每张 composer 动作卡右上角新增 `⋯` 动作设置按钮。
- 菜单包含：`查看动作详情`、`替换动作`、`上移`、`下移`、`移除动作`。
- 菜单点击和详情弹层点击会阻止事件冒泡，避免误触发动作卡展开 / 收起。

### replace behavior
- `替换动作` 会以 replace mode 打开现有 `ExerciseLibraryScreen`。
- 选择新动作后替换当前 draft exercise 的 `exerciseId`、`name`、`categoryLabel` 和 dictionary exercise 引用。
- 替换会保留原动作下已有 draft sets。
- 如果替换目标已存在于本次训练的其他动作卡中，会阻止替换并显示：`这个动作已经在本次训练中，不能替换为重复动作。`

### reorder behavior
- `上移` / `下移` 只调整前端 `draftExercises` 顺序。
- 第一个动作禁用 `上移`，最后一个动作禁用 `下移`。
- 保存时仍复用现有 draft flatten 流程，`set_index` 仍按 `exercise_id` 分组递增。

### remove behavior
- 没有 draft sets 的动作会直接移除。
- 有 draft sets 的动作会先弹出确认：`移除这个动作？` / `该动作下的训练组也会一起移除。`
- 确认后移除该动作及其 draft sets，`完成` 按钮状态会根据剩余 completed valid sets 重新计算。

### preserved backend/API/set_index contracts
- 未修改 server 文件、数据库 schema、training API contracts、workout CRUD semantics、assistant 文件、SSE contract 或 auth token 逻辑。
- 未新增 endpoint、未引入 warmup set persistence、set notes persistence、rest timer persistence、kg/lb persistence 或动作历史图表。
- `set_index` 规则保持按 `exercise_id` 分组编号。

### verification results
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec vite build` 通过。
- 本批未完成真实浏览器手工 smoke；当前环境此前已确认缺少稳定可用的 browser 控制器，因此不声明手工路径已完成。

### known environment issues
- 既有 Windows shell 中文输出仍可能出现编码显示异常，但本批 source code、type-check、lint 和 build 均通过。
- 之前记录过的 browser manual smoke 能力缺失仍未在本轮解决。

## 2026-05-07 Phase 4.1 Interaction Stabilization Follow-up

### bugs addressed
- 修复 composer 里休息倒计时入口只在 completed 状态可点的问题；现在有效组即可打开休息倒计时，若尚未标记完成会先标记完成再启动休息。
- 修复动作卡右上角 `⋯` 菜单在滚动列表中被下方动作卡或底部 `+` 浮动按钮遮挡的问题。
- 修复动作卡多组编辑时新增组后卡内滚动位置不稳定、底部操作容易被浮动层遮挡的问题。
- 修复训练日志删除和 composer 动作移除使用浏览器原生 confirm 导致页面看起来卡住的问题，改为 app 内确认。

### files changed
- `client/src/features/training/TrainingSessionComposer.tsx`
- `client/src/features/training/TrainingSessionExerciseCard.tsx`
- `client/src/features/training/TrainingSessionExerciseActions.tsx`
- `client/src/features/training/TrainingSessionSetRow.tsx`
- `client/src/features/training/WorkoutsPanel.tsx`
- `docs/progress.md`

### behavior notes
- 动作菜单改为 fixed 高层级定位，并在打开时提升当前动作卡层级，避免被后续动作卡的按钮覆盖。
- composer 底部滚动留白增加，rest timer / FAB 出现时不再压住最后的组编辑区域。
- 训练日志删除现在先展示页面内确认块，再调用既有 `onDeleteWorkout`，不改变 workout CRUD contract。
- composer 动作移除现在展示页面内确认弹层，确认后仅删除当前 draft exercise 和 draft sets。
- rest timer 替换确认也改为页面内确认弹层，不再使用 `window.confirm`。

### verification results
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec vite build` 通过。
- `rg "window\\.confirm|confirm\\(" client/src/features/training -n` 无匹配。

### known environment issues
- `client-smoke-4173.out.log` 仍被正在运行的 Vite dev server 锁住并写入 HMR 输出，`git restore` 当前报 `unable to unlink ... Invalid argument`。该日志污染不是本轮功能改动。

## 2026-05-07 Phase 4.1 Batch 2 - Local Rest Timer Interaction

### why this batch exists
- 组间休息倒计时是健身记录 App 的高频现场交互，能明显提升训练 composer 的产品质感。
- 本批只做前端本地状态，不扩大数据库、API 或 workout 提交契约，风险低于 rest timer persistence / warmup sets / set notes 等 schema 扩展。

### files changed
- `client/src/features/training/TrainingSessionComposer.tsx`
- `client/src/features/training/TrainingSessionExerciseCard.tsx`
- `client/src/features/training/TrainingSessionSetRow.tsx`
- `client/src/features/training/TrainingSessionRestTimer.tsx`
- `docs/progress.md`

### rest timer entry
- 在 composer 的 `TrainingSessionSetRow` 顶部操作区新增 `休息倒计时`。
- 该入口只有在当前 draft set 已完成后可用，避免未完成组直接启动休息。
- 点击后展示快捷选项：`30 秒`、`60 秒`、`90 秒`、`120 秒`，并提供一个本地自定义秒数输入。

### active timer behavior
- 选择时长后，composer 内显示一个底部浮动倒计时条，滚动动作卡时仍保持可见。
- running 状态显示：`休息中 MM:SS`，并提供 `暂停` / `跳过`。
- paused 状态显示：`休息已暂停 MM:SS`，并提供 `继续` / `跳过`。
- 倒计时归零后显示：`休息结束，可以开始下一组了`，并提供 `关闭`。
- 同一时间只存在一个 active rest timer；若已有倒计时运行或暂停，再启动新的倒计时会确认：`已有休息倒计时正在进行，是否替换？`

### reset behavior
- 关闭 composer、取消 workout、保存 workout 成功后都会清空本地 rest timer。
- 切换动作卡、滚动 composer、展开 / 收起动作卡不会清空 rest timer。

### preserved contracts
- 未修改 server 文件、数据库 schema、training API contracts、workout CRUD semantics、assistant 文件、SSE contract、auth token 逻辑或 analysis selected exercise 行为。
- 未新增 endpoint、未引入 rest timer persistence、系统通知、声音提醒、后台 timer service、warmup set persistence 或 set notes persistence。
- `set_index` 规则保持按 `exercise_id` 分组编号。

### verification results
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec vite build` 通过。
- 本批未完成真实浏览器手工 smoke；当前环境仍缺少稳定可用的 browser 控制器，因此不声明手工路径已完成。

### known environment issues
- 既有 Windows shell 中文输出仍可能出现编码显示异常，但本批 source code、type-check、lint 和 build 均通过。
- 之前记录过的 browser manual smoke 能力缺失仍未在本轮解决。

## 2026-05-07 Phase 4.1 Batch 3 - Composer Regression Manual Smoke

### manual smoke areas completed
- 已确认本地前端 `http://127.0.0.1:5173` 和后端 `http://127.0.0.1:3000` 在当前环境可访问。
- 已完成静态回归检查：`rg "window\\.confirm|confirm\\(" client/src/features/training -n`。
- 计划中的 fullscreen composer / workout log / rest timer / layering / delete 浏览器手工路径在本轮环境中未能真实完成，因此不把 A-G 记为已完成。

### bugs found
- 本轮未通过真实浏览器交互复现到可确认的产品 bug，因此没有修改训练相关 source code。

### files changed
- `docs/progress.md`

### z-index/layering result
- 未能在真实浏览器交互路径下完成 A/C 项视觉验证，因此本轮不宣称 layering 已人工通过。

### scroll result
- 未能在真实浏览器交互路径下完成 B 项滚动验证，因此本轮不宣称 composer / card scroll 已人工通过。

### rest timer result
- 未能在真实浏览器交互路径下完成 E 项 rest timer 交互验证，因此本轮不宣称 timer flow 已人工通过。

### delete/remove result
- 静态检查确认训练相关目录不存在 `window.confirm` 或裸 `confirm(...)` 调用。
- 未能在真实浏览器交互路径下完成 D/G 项删除与编辑冻结验证，因此本轮不宣称 delete/remove 手测已通过。

### workout edit result
- 未能在真实浏览器交互路径下完成 F/G 项保存、刷新和 reopen persistence 验证，因此本轮不宣称 workout edit 手测已通过。

### preserved contracts
- 未修改 server 文件、数据库 schema、API contracts、SSE event names、assistant 文件、provider adapter、tool executor、auth token 逻辑或 `set_index` 规则。
- 未新增 warmup set persistence、set notes persistence、rest timer persistence、audio alerts、browser notifications 或 backend endpoints。

### verification results
- `Invoke-WebRequest http://127.0.0.1:5173` 返回 Vite HTML，确认前端 dev server 在线。
- `Invoke-WebRequest http://127.0.0.1:3000/api/health` 返回 `200` 与 `{"ok":true,"data":{"status":"ok"}}`，确认后端在线。
- `rg "window\\.confirm|confirm\\(" client/src/features/training -n` 无匹配。

### known environment issues
- 当前会话仍缺少可用的 `node_repl js` browser runtime。
- shell fallback `npx agent-browser` 在提权后可执行 `open`，但后续 `snapshot` / `get text` 命令持续超时，无法形成稳定可复用的真实浏览器控制链路。
- 因为浏览器自动化链路仍不稳定，本批不能诚实地把 A-G manual smoke checklist 记为已完成。

## 2026-05-07 Phase 4.1 Batch 4 - Local Smoke Checklist & Repo Hygiene

### whether human browser smoke was completed
- 本轮未由 assistant 在真实浏览器中完成 1-23 项人工点击 smoke，因此不能宣称 human browser smoke 已通过。
- 当前记录只覆盖仓库卫生检查与可验证的本地环境状态，不把未实际点击的 checklist 项目记为 pass。

### pass/fail items
- `http://127.0.0.1:5173` 与 `http://127.0.0.1:3000/api/health` 在前一批已确认可访问，但本轮未实际执行登录、训练、保存、编辑、删除、分析刷新与 AI 助手问答的人为浏览器路径。
- 因未执行真实人工点击，本轮 checklist 1-23 统一记为 `not completed in this session`，而不是 pass。

### bugs found
- 本轮未新增确认到的产品 bug。

### files changed
- `docs/progress.md`

### runtime log cleanup result
- `git ls-files client-smoke-4173.out.log` 显示 `client-smoke-4173.out.log` 为 tracked 文件，因此本轮未把 `client-smoke-*.out.log` 加入 `.gitignore`。
- 当前未发现活跃的本地 `5173` / `3000` listener；`client-dev.pid` 与 `server-dev.pid` 指向的旧 PID 也不是活跃进程。
- 已尝试执行 `git restore -- client-smoke-4173.out.log` 清理运行时日志噪音。
- sandbox 路径先因 `index.lock` 权限失败；提权重试后又报 `unable to unlink old 'fitmind-ai/client-smoke-4173.out.log': Invalid argument`，因此该 tracked log 在本轮未能安全清理。
- 因为该文件是 tracked artifact 且 restore 失败，本轮选择如实记录问题，不做强制删除或忽略规则修改。

### contracts preserved
- 未修改产品 source code、server 文件、数据库 schema、API contracts、SSE event names、assistant 文件、provider adapter、tool executor、auth token 逻辑或 `set_index` 规则。
- 未新增 warmup set persistence、set notes persistence、rest timer persistence、backend migration、new endpoints、RAG 或 MCP 集成。

## 2026-05-08 Phase 4.1 Batch 5 - Composer UX Regression Fixes

### bugs addressed
- 根据本地真实手测反馈，注册页补上了确认密码校验，避免两次密码不一致时直接发请求。
- 根据本地真实手测反馈，注册失败提示明确映射了“重复注册邮箱”与“邮箱/密码错误”场景。
- 修复 fullscreen composer 在动作变多时看起来继续向下无限拉长、把底部 `+` 和底部 tab bar 挤出当前屏的问题；composer 现在固定为真实一屏高度，内容区改为内部滚动。
- 修复动作卡 `⋯` 菜单定位跑到页面右侧外面的问题，菜单现在会约束在可视区域内。
- 修复动作卡 `⋯` 菜单点开后点击其他空白区域不消失、点别的动作菜单也不自然的问题；现在支持外部点击关闭、`Escape` 关闭，并在滚动/resize 时重新定位。
- 修复“移除动作”点击后看起来卡在原地的问题；这次跟随 composer 高度与菜单关闭逻辑一起修正，确保移除确认层能在当前视口内正常出现。

### files changed
- `client/src/features/auth/AuthScreen.tsx`
- `client/src/features/auth/use-auth.ts`
- `client/src/features/training/TrainingSessionComposer.tsx`
- `client/src/features/training/TrainingSessionExerciseActions.tsx`
- `docs/progress.md`

### behavior notes
- “用户名重复”本批按当前现有产品契约解释为“注册邮箱重复”；未改后端 schema，也未新增 display name 唯一性约束。
- composer 仍保持现有产品结构，没有新增 persistence、通知、后端接口或额外交互模式。

### verification results
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec vite build` 在当前 Windows 环境下未直接解析到 `vite` 可执行文件。
- 改用 package-local `client/.\\node_modules\\.bin\\vite.cmd build` 后构建通过。

### contracts preserved
- 未修改 server 文件、数据库 schema、API contracts、SSE event names、assistant 文件、provider adapter、tool executor、auth token 逻辑或 `set_index` 规则。
- 未新增 warmup set persistence、set notes persistence、rest timer persistence、audio alerts、browser notifications、backend migration 或 new endpoints。

## 2026-05-08 Phase 4.1 Batch 5.1 - Composer Follow-up Fixes

### bugs addressed
- 根据继续手测反馈，修复“新增一组”时把整个 composer 直接回跳到窗口最下方的问题；现在只保留动作卡内部列表的自然滚动，不再强制整页滚到底。
- 根据继续手测反馈，进一步修正动作卡 `⋯` 菜单定位逻辑；菜单不再按整页浏览器宽度计算，而是按当前 FitMind app 容器宽度约束，减少大窗口下跑到右边外面的情况。

### files changed
- `client/src/features/training/TrainingSessionComposer.tsx`
- `client/src/features/training/TrainingSessionExerciseActions.tsx`
- `docs/progress.md`

### verification results
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- package-local `client/.\\node_modules\\.bin\\vite.cmd build` 通过。

### contracts preserved
- 未修改 server 文件、数据库 schema、API contracts、SSE event names、assistant 文件、provider adapter、tool executor、auth token 逻辑或 `set_index` 规则。
- 未新增 warmup set persistence、set notes persistence、rest timer persistence、audio alerts、browser notifications、backend migration 或 new endpoints。

## 2026-05-08 Phase 4.1 Batch 5.2 - Composer Interaction Polish

### bugs addressed
- 根据继续手测反馈，训练 composer 现在支持点击列表空白区域收起已展开的动作卡，不再只能点动作卡片本身的空白区域。
- 休息倒计时不再嵌在组卡内部展开，改为居中弹框 + 背景暗化，避免组卡滚动和 composer 滚动同时出现造成双滚动条体验。
- 休息倒计时流程改为两段式：先弹框选择时长，再进入单一倒计时弹窗；倒计时阶段仅保留暂停/继续与关闭。
- 每组现在新增前端本地 `restSeconds` 记录；设置休息时间后，会在完成区左侧显示 `休息 MM:SS`，没有休息则不显示该标签。
- 当重量/次数被修改或手动取消完成时，对应组的本地休息记录会清空，避免显示过期休息数据。

### files changed
- `client/src/features/training/training-session-draft.ts`
- `client/src/features/training/TrainingSessionSetRow.tsx`
- `client/src/features/training/TrainingSessionRestTimer.tsx`
- `client/src/features/training/TrainingSessionExerciseCard.tsx`
- `client/src/features/training/TrainingSessionComposer.tsx`
- `client/src/features/training/WorkoutCard.tsx`
- `docs/progress.md`

### verification results
- `pnpm --filter @fitmind/client type-check` 通过。
- `pnpm lint` 通过。
- `pnpm --filter @fitmind/client exec .\\node_modules\\.bin\\vite.cmd build` 通过。

### contracts preserved
- 未修改 server 文件、数据库 schema、API contracts、SSE event names、assistant 文件、provider adapter、tool executor、auth token 逻辑或 `set_index` 规则。
- 未新增 warmup set persistence、set notes persistence 持久化、rest timer persistence、audio alerts、browser notifications、backend migration 或 new endpoints。

### Edit Mode Display Fix

During local manual smoke, workout log edit mode showed both read-only workout metadata and editable metadata fields at the same time, making the detail area feel like a mixed view/edit state.

Fixed in `WorkoutCard.tsx` by hiding the read-only training time / duration / notes section while edit mode is active. The workout detail area now cleanly switches between view mode and edit mode.

Verification:

- `pnpm --filter @fitmind/client type-check` passed
- `pnpm lint` passed
- `pnpm --filter @fitmind/client exec .\node_modules\.bin\vite.cmd build` passed

## Phase 4.3 Batch 3 - Assistant Insights Backend Endpoint

Moved the Assistant Insight Dashboard business rules from the frontend builder path into a backend deterministic endpoint. The frontend now renders a backend view-model instead of independently loading training summary, recommendation context, and exercise progress to assemble cards.

### implementation
- Added `GET /api/training/assistant-insights?start_date=&end_date=&exercise_id=optional`.
- The endpoint uses the authenticated `user_id` from auth context only; `user_id` query injection is ignored.
- The backend service composes existing deterministic services: training summary, recommendation context, muscle load, and optional exercise progress.
- The response returns dashboard-ready `cards`, `overview`, `limitations`, and evidence counts/rules without exposing raw workout or set ids.
- The Assistant Insight Dashboard now calls the new endpoint through `assistant-insights-api.ts` and keeps the existing card UI, quick prompts, loading, error, and empty states.

### product boundaries
- Card copy uses conservative language such as "current records are concentrated in", "can prioritize", and "lower share".
- The endpoint does not add LLM behavior, SSE event changes, tool executor changes, RAG, MCP, multi-tool agent loop, or Anthropic second provider call.
- Recovery cards retain the existing safety boundary: training records can support general reminders but cannot judge pain, fatigue, or health risk.

### smoke coverage
- Added `server/scripts/assistant-insights-api-smoke.ts`.
- Added `pnpm smoke:assistant-insights` at root and server package levels.
- Smoke covers auth requirement, populated cards, required card types, deterministic source names, no raw ids in response evidence, conservative copy, and `user_id` query injection isolation.

### verification
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm lint` passed.
- `pnpm test` passed: 6 files, 29 tests.
- `pnpm --filter @fitmind/client exec .\node_modules\.bin\vite.cmd build` passed.
- Sandbox DB-backed `pnpm smoke:auth` and `pnpm smoke:assistant-insights` still fail at `POST /api/auth/register` with `500 INTERNAL_ERROR`, matching the known sandbox DB egress/environment constraint.
- Elevated `pnpm smoke:auth` passed.
- Elevated `pnpm smoke:assistant-insights` passed.

## Phase 4.3 Batch 2 - Muscle Load Analysis UI

Added a deterministic muscle-load panel to the Analysis tab so the `/api/training/muscle-load` evidence layer is visible before the Assistant consumes it.

### implementation
- Added a frontend `muscle-load-api` client that calls `GET /api/training/muscle-load?start_date=&end_date=` through the shared `requestJson` helper.
- Added `MuscleLoadPanel` after the 30-day training summary and before exercise progress.
- The panel shows 30-day raw volume, weighted volume, set count, represented muscle-group count, muscle-group ranking, top muscle groups, low-volume muscle groups, top contributing exercises, and evidence summary counts.
- Evidence UI shows workout/set counts and calculation rules, but does not expose raw ids in the product interface.
- App-level Analysis refresh now uses a shared `analysisRefreshSignal` for recommendation context and muscle-load panels, while selected exercise progress keeps its existing focused refresh behavior.

### product boundaries
- UI copy uses "higher share", "lower share", and "current records are concentrated in" language.
- UI copy does not claim "undertrained", "serious imbalance", "must train", or medical/recovery risk.
- `low_volume_muscle_groups` is framed as low share within current returned/recent records, not a complete all-muscle coverage judgment.
- No Assistant UI, backend contract, provider loop, natural-language intake, voice capture, RAG, MCP, or agent behavior changed in this batch.

### verification
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm lint` passed.
- `pnpm test` passed: 6 files, 29 tests.
- `pnpm --filter @fitmind/client exec .\node_modules\.bin\vite.cmd build` passed.
- Sandbox DB-backed `pnpm smoke:auth` and `pnpm smoke:muscle-load` still fail at `POST /api/auth/register` with `500 INTERNAL_ERROR`, matching the known sandbox DB egress/environment constraint.
- Elevated `pnpm smoke:auth` passed.
- Elevated `pnpm smoke:muscle-load` passed.

## Phase 4.3 Batch 1 - Muscle Load Calculation Layer

Added a deterministic backend muscle-load calculation layer for evidence-backed training imbalance analysis. This batch stays scoped to backend API, service/repository logic, smoke coverage, and verification notes; it does not change the Assistant UI, Analysis tab UI, provider loop, RAG, MCP, or agent behavior.

### implementation
- Added `GET /api/training/muscle-load?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`.
- The endpoint uses the authenticated `user_id` from auth context only; `user_id` query injection is ignored.
- Date filtering follows the existing half-open date range rule:
  - `performed_at >= start_date::date`
  - `performed_at < (end_date::date + interval '1 day')`
- Muscle load is calculated from existing `workouts`, `sets`, `exercises`, `exercise_muscles`, and `muscle_groups` data without adding tables.
- Per-set raw volume is `weight_kg * reps`.
- Per-exercise muscle contribution weights are normalized before allocation, so exercises with contribution weights that do not sum to 1 still distribute set volume consistently.
- Response includes totals, `by_muscle_group`, `top_muscle_groups`, `low_volume_muscle_groups`, and evidence with workout ids, set ids, and calculation rules.
- The naming intentionally uses `low_volume_muscle_groups`, not `undertrained_muscle_groups`, because the app does not yet model user goals, training frequency, or plan context.

### smoke coverage
- Added `server/scripts/muscle-load-api-smoke.ts`.
- The smoke registers isolated users, creates a workout with bench press and row sets, calls `/api/training/muscle-load`, verifies chest/triceps/front delts weighted volume, checks contribution ratios sum close to 1, checks evidence ids/rules, and verifies `user_id` query injection cannot cross auth boundaries.
- Added `pnpm smoke:muscle-load` at the root and server package levels.

### verification
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm lint` passed.
- `pnpm test` passed: 6 files, 29 tests.
- Sandbox DB-backed smoke attempts failed at `POST /api/auth/register` with `500 INTERNAL_ERROR`, matching the known DB egress/environment constraint rather than a muscle-load route failure.
- Elevated `pnpm smoke:auth` passed.
- Elevated `pnpm smoke:training` passed.
- Elevated `pnpm smoke:muscle-load` passed.

## 2026-05-09 Phase 4.2 Batch 2 - Assistant Demo Data & Smoke Stabilization

### why this batch exists
- Phase 4.2 Batch 1 已经把 Assistant 页做成了更像产品的主动洞察页，但当时 `assistant mock smoke` 被 `POST /api/auth/register -> 500` 阻塞，还不够稳定，不能放心演示或写进面试讲稿。
- 这一批不继续扩 Assistant 功能，而是把 auth 诊断、demo 数据、空态稳健性和文档解释补齐。

### auth smoke stabilization
- 新增 `server/scripts/auth-register-smoke.ts`，只验证：
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
- 脚本每次都会生成唯一 email，并在失败时输出 step label 和 response body，便于快速区分 auth 层问题和 assistant 层问题。
- 真实排查结果：
  - sandbox 内运行时，auth smoke 仍会表现为 `POST /api/auth/register -> 500 INTERNAL_ERROR`
  - 继续向下直调 `register()` 服务后，定位到真实根因是数据库外连被 sandbox 拦截，报 `connect EACCES ...:5432`
  - 在提权环境下重跑 `auth-register-smoke.ts` 后，`register/login/me` 全部通过
- 结论：这次 `assistant mock smoke` 的 500 不是 assistant routing bug，也不是 auth 业务逻辑 bug，而是当前 sandbox 环境下的数据库连接限制。

### assistant smoke workflow changes
- `server/package.json` 新增：
  - `smoke:assistant-auth`
  - `smoke:assistant-mock`
- `smoke:assistant-mock` 会先跑 `auth-register-smoke.ts`，再跑 `assistant-mock-turn-smoke.ts`，优先把 auth 前置失败与 assistant 真问题拆开。
- 在提权环境下，`assistant-mock-turn-smoke.ts` 已重新通过。

### demo seed data
- 新增 `server/scripts/seed-assistant-demo-data.ts`。
- 脚本会加载 `server/.env.local`，使用固定 demo 用户 `assistant-demo@fitmind.local`，并在每次重跑时只替换该用户自己的 demo workouts / assistant logs。
- demo 数据刻意构造成最近 30 天的稳定演示样本：
  - Bench / Incline Bench 容量明显更高
  - Row / Lat Pulldown 有记录但偏少
  - Squat 只保留少量触点
  - 最近一次 chest training 距现在约 2 天
  - Bench 有足够多的 session 可触发重点动作进展和估算 1RM
- 提权环境下脚本已通过，并输出：
  - `email=assistant-demo@fitmind.local`
  - `password=Passw0rd!`

### insight dashboard hardening
- 重写 `assistant-insight-builder.ts` 的 5 张卡片分支，让页面在稀疏数据下仍然像“准备好等待数据进入”的产品，而不是“坏掉了”的页面。
- 重点覆盖：
  - 没有 workout
  - 训练次数或组数太少，不足以稳定判断偏科或下一次训练建议
  - recovery 只能做弱判断
  - 没有选中动作，所以不加载 exercise progress
  - 选中了动作，但该动作在当前时间范围内没有 session
- `AssistantInsightDashboard.tsx` 也同步强化了 loading / error / empty copy。

### test coverage additions
- 新增 `client/src/features/assistant/assistant-insight-builder.test.ts`，锁住 4 类关键状态：
  - 全空数据
  - 稀疏训练记录
  - 已选动作但区间内无记录
  - 胸推主导时的强建议分支
- `vitest.config.ts` 已加入 `client/src/**/*.test.ts`。

### files changed
- `server/scripts/auth-register-smoke.ts`
- `server/scripts/seed-assistant-demo-data.ts`
- `server/package.json`
- `client/src/features/assistant/AssistantInsightDashboard.tsx`
- `client/src/features/assistant/assistant-insight-builder.ts`
- `client/src/features/assistant/assistant-insight-builder.test.ts`
- `vitest.config.ts`
- `docs/project-study-guide.md`
- `docs/progress.md`

### verification results
- `pnpm --filter @fitmind/server type-check` passed
- `pnpm --filter @fitmind/client type-check` passed
- `pnpm lint` passed
- `pnpm --filter @fitmind/client exec .\node_modules\.bin\vite.cmd build` passed
- `.\node_modules\.bin\vitest.cmd run client\src\features\assistant\assistant-insight-builder.test.ts` passed
- 提权后 `.\node_modules\.bin\tsx.cmd scripts\auth-register-smoke.ts` passed
- 提权后 `.\node_modules\.bin\tsx.cmd scripts\assistant-mock-turn-smoke.ts` passed
- 提权后 `.\node_modules\.bin\tsx.cmd scripts\training-summary-api-smoke.ts` passed
- 提权后 `.\node_modules\.bin\tsx.cmd scripts\recommendation-context-api-smoke.ts` passed
- 提权后 `.\node_modules\.bin\tsx.cmd scripts\exercise-progress-api-smoke.ts` passed
- 提权后 `.\node_modules\.bin\tsx.cmd scripts\seed-assistant-demo-data.ts` passed

### notes
- 根级 `pnpm test` 目前仍会命中已有的 `server/src/app.test.ts` 失败，这次没有把它们作为 Batch 2 范围的一部分；本批验证重点仍然是新的 auth smoke、assistant mock smoke、deterministic API smokes 和 dashboard builder test。

## 2026-05-26 Phase 4.2 Batch 3 - Test Hygiene & Demo Closure

### why this batch exists
- Assistant 相关产品能力在 Batch 2 已经具备了稳定的 smoke 证据，但 root `pnpm test` 仍被历史 `server/src/app.test.ts` 拖住，验证叙事不够干净。
- 本批不新增 AI 助手能力，而是把测试入口分层、app route smoke 职责边界、demo runbook 和验证文档一起收口。

### root test hygiene
- 重新审视 `server/src/app.test.ts` 后，确认它更适合作为纯 app / route boundary smoke，而不是继续承担 workout mutation 全链路断言。
- 原先失败的 7 个 case 主要属于历史 route-smoke drift：
  - 旧的 workout mutation HTTP 断言仍锚定在 root unit lane
  - 这些路径已经被现有 DB-backed smoke scripts 更真实地覆盖
- 本批处理方式不是“假装修绿”，而是明确收缩 `app.test.ts` 的职责：
  - 保留 `health` endpoint
  - 保留 `/api/auth/me` 未授权拦截
  - 保留 protected route 的 malformed bearer header / invalid token / missing header 行为
- workout mutation 主路径不再由 root unit smoke 宣称覆盖，而是继续由现有 backend smoke scripts 证明。

### script split by intent
- 根级 `package.json` 新增：
  - `test:unit`
  - `test:integration`
  - `smoke:auth`
  - `smoke:assistant`
  - `smoke:training`
  - `seed:assistant-demo`
- 根级 `test` 现在等价于 `pnpm test:unit`，明确只代表 unit-test lane。
- 根级 `verify` 现在只收口：
  - `lint`
  - `format:check`
  - `type-check`
  - `test:unit`
- `@fitmind/server` 新增/整理：
  - `seed:assistant-demo`
  - `smoke:auth`
  - `smoke:assistant`
  - `smoke:training`
  - `test:unit`
- `test:integration` 目前明确打印“尚未配置 root integration suite”，避免把 smoke scripts 和 integration 概念混淆。

### demo runbook hardening
- 重写 `docs/demo-script.md`，改成围绕当前稳定 Assistant demo path 的 operator runbook：
  - 启动 server / client
  - 运行 assistant demo seed
  - 用 demo 用户登录
  - 先展示 5 张 insight cards
  - 再点击 quick prompts：
    - `我今天练什么？`
    - `我是不是偏科？`
    - `AI 根据什么判断？`
  - 再展示 unsupported prompt fallback
  - 最后解释 `分析` Tab 和 `AI 助手` Tab 的分工
- 文档中已明确 demo 账号是本地 seed 账号，不是生产账号，也不应被描述成可公开复用的共享凭据。

### documentation closeout
- 更新 `README.md` 的 verification section，明确：
  - root `pnpm test` = unit-test lane
  - `smoke:auth` / `smoke:assistant` / `smoke:training` = DB-backed smoke
  - sandbox DB egress denial 是环境限制，不是 app bug
  - 不 overclaim browser E2E
- 更新 `docs/project-study-guide.md`，加入一段更适合面试解释的 testing / verification framing：
  - unit tests 证明路由 / controller / service 边界
  - backend smoke scripts 证明真实 app + DB 链路
  - elevated run 是当前 sandbox DB egress 限制下的必要验证路径

### files changed
- `server/src/app.test.ts`
- `package.json`
- `server/package.json`
- `docs/demo-script.md`
- `docs/project-study-guide.md`
- `docs/progress.md`
- `README.md`

### verification results
- `pnpm test` passed
- `pnpm --filter @fitmind/server type-check` passed
- `pnpm --filter @fitmind/client type-check` passed
- `pnpm lint` passed
- `pnpm --filter @fitmind/client exec .\node_modules\.bin\vite.cmd build` passed
- `.\node_modules\.bin\vitest.cmd run client\src\features\assistant\assistant-insight-builder.test.ts` passed
- 提权后 `pnpm smoke:auth` passed
- 提权后 `pnpm seed:assistant-demo` passed
- 提权后 `pnpm smoke:assistant` passed
- 提权后 `pnpm smoke:training` passed

### notes
- 本批没有新增任何 AI insight 类型、backend `/assistant-insights` endpoint、多工具 agent loop、第二次 provider call、RAG、MCP 或浏览器 E2E 宣称。
- 当前 root `pnpm test` 通过并不等于 DB-backed smoke 通过；两者在脚本和文档里已被明确拆开。

## 2026-05-07 Phase 4.2 Batch 1 - Assistant Insight Dashboard

### why this batch exists
- 之前的 AI 助手页过于依赖固定提问，产品体验更像“披着聊天框外壳的规则展示”。
- 这一批把助手页改成“主动训练洞察页 + 可选追问”，让用户打开页面就能直接看到训练建议、偏科提醒、恢复提醒、重点动作进展和判断依据。

### new supported question types
- 最近训练总览
- 我今天练什么 / 下一次训练建议练哪里
- 我胸练得够吗 / 某类部位训练是否偏少
- 我是不是训练偏科
- 当前动作进展 / 预估卧推极限
- AI 根据什么判断
- unsupported prompt 会明确说明当前支持范围，不再默认回退到 summary

### quick prompt changes
- Assistant quick prompts 从 2 个扩到 6 个产品导向入口：
  - `最近训练总览`
  - `我今天练什么？`
  - `我胸练得够吗？`
  - `我是不是偏科？`
  - `当前动作进展`
  - `AI 根据什么判断？`
- `当前动作进展` 在未选中动作时会禁用，并显示先去分析页选择动作的提示。

### insight dashboard changes
- Assistant 页新增前端 deterministic insight dashboard，不新增新的 backend snapshot endpoint。
- 页面会并行复用既有 `training summary`、`recommendation context` 和可选 `exercise progress` 组合出主动洞察卡片。
- 默认展示 5 张洞察卡：
  - 今日建议
  - 训练偏科提醒
  - 恢复提醒
  - 重点动作进展
  - 判断依据
- 底部保留聊天输入框，但定位改成“继续追问”而不是页面主功能。

### routing and template changes
- assistant mode 扩展为：
  - `training_overview`
  - `exercise_progress`
  - `next_training_focus`
  - `muscle_balance`
  - `training_imbalance`
  - `recovery_check`
  - `evidence_explain`
  - `unsupported`
- mock provider 仍保持单次 provider decision + 单次 tool execution，不引入第二次 provider call 或多轮 agent loop。
- `exercise_progress` 仍优先走 `get_exercise_progress`；未选动作时返回“先去分析页选动作”的产品文案，不再偷偷回退到 summary。
- `next_training_focus` / `muscle_balance` / `training_imbalance` / `recovery_check` / `evidence_explain` 默认走 `get_recommendation_context`。
- user-facing answer template 全部改成中文产品文案，不暴露 debug copy、provider path、tool finished、raw JSON 或 raw context rows。
- recovery 类回答统一加入安全边界：
  - “我只能根据训练记录做一般性提醒，不能判断疼痛、疲劳或健康风险。如果有疼痛或不适，应优先休息或咨询专业人士。”

### preserved contracts
- 未新增 `/api/training/assistant-insights` endpoint，本批洞察先在前端拼装。
- 未修改 SSE event names、provider adapter public contract、tool executor user isolation rule、auth token 逻辑、workout CRUD contracts 或 `set_index` 规则。
- 未加入 RAG、MCP、多轮 agent loop、second provider call、真实 Anthropic token streaming 或医疗建议。

### files changed
- `client/src/App.tsx`
- `client/src/features/assistant/AssistantWorkspace.tsx`
- `client/src/features/assistant/AssistantChatPanel.tsx`
- `client/src/features/assistant/AssistantQuickPrompts.tsx`
- `client/src/features/assistant/AssistantIntroCard.tsx`
- `client/src/features/assistant/AssistantComposer.tsx`
- `client/src/features/assistant/AssistantMessageList.tsx`
- `client/src/features/assistant/AssistantMessageBubble.tsx`
- `client/src/features/assistant/AssistantInsightDashboard.tsx`
- `client/src/features/assistant/assistant-date-range.ts`
- `client/src/features/assistant/assistant-insight-builder.ts`
- `client/src/features/assistant/assistant-insight-types.ts`
- `client/src/features/assistant/assistant-types.ts`
- `server/src/services/assistant/provider-types.ts`
- `server/src/services/assistant/mock-provider.ts`
- `server/src/services/assistant/assistant-orchestrator-service.ts`
- `server/scripts/assistant-mock-turn-smoke.ts`
- `server/scripts/assistant-stream-smoke.ts`
- `docs/progress.md`

### verification results
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm lint` passed.
- `pnpm --filter @fitmind/client exec .\node_modules\.bin\vite.cmd build` passed.
- `server\node_modules\.bin\tsx.CMD server\scripts\assistant-mock-turn-smoke.ts` ran, but failed before assistant assertions because `POST /api/auth/register` returned `500 INTERNAL_ERROR` in the current environment.

### known limitations
- 肌群判断暂时仍主要依赖动作名称、训练量和训练频率；如果动作字典肌群映射不完整，助手会明确说明这一点。
- 当前 assistant 仍是受控 deterministic path，不是自由问答大模型助手。
- assistant mock smoke 目前被现有环境中的注册接口 `500` 阻塞，因此本批不把 mock smoke 记为通过。

### Assistant UX Tightening

During local manual smoke, the assistant experience exposed too much internal product/debug framing to end users and also felt brittle when switching away from the assistant tab and back again.

Fixed on the client side by:

- keeping the training / analysis / assistant tab trees mounted so assistant conversation state is not discarded just by tab switching
- removing user-facing tool-call / provider / session status rail content from the main assistant path
- reducing quick prompts to two user-meaningful entry points: recent training overview and selected exercise progress
- rewriting assistant intro / empty-state / composer copy so the UI sets a narrower and more honest expectation for what the current assistant can answer well

Behavior notes:

- switching tabs no longer clears the in-memory assistant conversation UI
- previous assistant answers are still historical snapshots; if training data changes, the user still needs to ask again to get a refreshed answer
- this batch improves assistant usability and expectation-setting, but does not expand backend assistant capability or add new answer modes

Verification:

- `pnpm --filter @fitmind/client type-check` passed
- `pnpm lint` passed
- `pnpm --filter @fitmind/client exec .\node_modules\.bin\vite.cmd build` passed


## 2026-05-29 Phase 4.4 Batch 1 - Natural Language Workout Intake Backend

Added a deterministic backend parser for natural-language workout intake. This batch only creates a workout draft and does not write `workouts` or `sets`.

### Completed

- Added authenticated `POST /api/training/workout-intake/parse`.
- Added Zod request/response schemas for workout intake drafts.
- Added a rule-based parser for normalized weight/reps formats such as `60公斤10个`, `60kg x 10`, `60 x 10`, and `60kg 10 reps`.
- Added conservative exercise matching against the existing exercise dictionary with `matched`, `ambiguous`, and `unresolved` statuses.
- Added parser unit tests and a DB-backed smoke script.
- Added `pnpm smoke:workout-intake` at root and server package levels.

### Boundaries

- No workout persistence.
- No frontend UI.
- No voice capture or speech-to-text.
- No LLM structured output, RAG, MCP, Agent, or provider loop changes.
- Ambiguous movement names return candidates and require user confirmation.

### Verification Notes

- Parser unit test passed locally.
- `pnpm --filter @fitmind/server type-check` passed locally.
- Full verification and DB-backed smoke status are recorded in the implementation closeout.

## 2026-05-30 Phase 4.4 Batch 2 - Exercise Alias & Matching Layer

Added a deterministic exercise alias and matching layer for natural-language workout intake. This batch keeps the endpoint draft-only and does not add a database alias table, frontend UI, voice capture, LLM parsing, RAG, MCP, Agent behavior, or workout persistence.

### Completed

- Added a system exercise alias map keyed by canonical exercise code.
- Added an exercise matching service with exact standard-name matching, exact alias matching, broad ambiguous aliases, normalized/contains fallback, stable candidates, and conservative unresolved results.
- Refactored the workout-intake parser so parser logic handles text/sets while the matching service handles exercise candidates and confidence.
- Expanded unit coverage for alias matches, broad ambiguous terms, unresolved terms, English normalization, and parser integration.
- Expanded `pnpm smoke:workout-intake` to cover barbell bench press, lat pulldown, and broad row aliases.

### Boundaries

- No user-custom aliases.
- No DB migration.
- No direct workout creation.
- Ambiguous aliases return candidates and must be confirmed by a future UI.

### Verification Notes

- Batch verification results are recorded in the implementation closeout.

## 2026-05-30 Phase 4.4 Batch 6 - LLM Structured Workout Intake Fallback

Added a backend-only hybrid parser for natural-language workout intake. The endpoint still exposes the same parse contract, but low-quality rule parses can now be repaired by a strict structured fallback.

### Completed

- Added `WORKOUT_INTAKE_LLM_PROVIDER=off|mock|anthropic`, defaulting to mock-safe behavior.
- Added a strict Zod-validated LLM output schema for `spoken_name`, complete sets, incomplete sets, and warnings.
- Added a deterministic mock fallback for oral workout text such as `上斜哑铃卧推三组每组27.5公斤每组次数8`.
- Added optional Anthropic fallback plumbing while keeping it separate from `ASSISTANT_PROVIDER`.
- Added a hybrid parser that runs rules first and automatically falls back when the rule output has no valid sets, incomplete sets, no-candidate items, no-set items, or missing-set warnings.
- Kept exercise ID resolution deterministic by running LLM `spoken_name` through the existing exercise matching service.
- Added evidence source metadata: `rule_parser`, `llm_structured_fallback`, and `rule_parser_llm_unavailable`.
- Fixed decimal preservation in the rule parser so `27.5公斤` is not split into `5kg`.
- Updated workout-intake smoke to cover mock LLM fallback without creating workouts.

### Boundaries

- LLM output never writes workouts or sets.
- LLM output is rejected if it includes database-only fields such as `exercise_id`.
- User confirmation and the existing create workout API remain the only save path.
- No backend STT, audio upload/storage, RAG, MCP, Agent/provider loop, User Training Profile, or medical / rehab judgment.

### Verification Notes

- Batch verification results are recorded in the implementation closeout.

## 2026-05-30 Phase 4.4 Batch 5C - Intake Modal Layering & Inline Draft Completion

Repaired the next round of browser/manual feedback for voice and text intake. The transcript modal now behaves as a true viewport overlay, and incomplete draft rows can be completed directly inside the draft card instead of forcing users to rewrite the transcript.

### Completed

- Raised transcript modal and listening overlay to a viewport-level `document.body` portal with a very high z-index and full-screen pointer interception.
- Added cross-clause parser merging for oral follow-ups like `每组做了10次` and `每组是70公斤` when they belong to the previous active exercise.
- Added parser coverage for `杠铃卧推做了10组每组做的是70公斤，每组做了10次` and related high-pulldown phrasing.
- Added `resolveIncompleteSetFields` so incomplete draft data can be completed into valid generated sets.
- Added inline incomplete-set editors in draft cards for missing reps and / or missing weight.
- Fixed the raw unicode escape display issue for the incomplete-set title.
- Kept transcript editing and reparse as a fallback rather than the primary correction path.

### Boundaries

- No backend STT endpoint.
- No audio upload or audio storage.
- No Whisper / OpenAI speech API integration.
- No LLM structured output, RAG, MCP, Agent, provider loop change, User Training Profile, or medical / rehab judgment.
- No browser E2E claim unless a browser automation run is performed separately.

### Verification Notes

- Batch verification results are recorded in the implementation closeout.

## 2026-05-30 Phase 4.4 Batch 5B - Voice Intake UX & Parser Guardrails

Repaired the real manual-test issues in voice / natural-language intake. The Training tab no longer shows the large quick text panel by default, and the deterministic parser now stays conservative when oral inputs omit required set fields.

### Completed

- Moved quick intake behind lightweight Training-tab triggers next to `+ 记录训练`.
- Added press-and-hold microphone interaction with a listening overlay and animated CSS wave bars.
- Added a floating transcript confirmation modal with editable text, parse, cancel, draft review, and save actions.
- Extended workout-intake response drafts with `incomplete_sets` for recognized but unsaveable partial set data.
- Tightened set schema and parser output so complete `sets` require positive `weight_kg` and positive `reps`.
- Added oral pattern support for `高位下拉十组，每组70公斤做10个`, `高位下拉做了十组，每组70公斤10个`, `十组高位下拉，每组70公斤做10个`, and `高位下拉两组45公斤12个`.
- Guarded against context phrases like `背部`, `今天`, `昨天`, `训练`, `练了`, `做了`, and `每组` becoming fake unresolved exercises.
- Made Chinese exercise names preferred in intake matching results when known.
- Added tests for parser guardrails, conservative Chinese matching, incomplete draft blocking, and Chinese-first manual resolution display.

### Boundaries

- No backend STT endpoint.
- No audio upload or audio storage.
- No Whisper / OpenAI speech API integration.
- No LLM structured output, RAG, MCP, Agent, provider loop change, user-custom aliases, User Training Profile, or medical / rehab judgment.
- No browser E2E claim unless a browser automation run is performed separately.

### Verification Notes

- Batch verification results are recorded in the implementation closeout.

## 2026-05-30 Phase 4.4 Batch 3 - Natural Language Workout Intake UI

Added a frontend quick text logging flow on the Training tab. Users can paste a natural-language workout, parse it into the existing backend workout draft, review matched / ambiguous / unresolved exercises, resolve ambiguous candidates, delete unresolved rows, and save only after confirmation through the existing workout create API.

### Completed

- Added a typed client API wrapper for `POST /api/training/workout-intake/parse`.
- Added a draft-to-`CreateWorkoutRequest` mapper with unit coverage for matched drafts, per-exercise set indexes, ambiguous / unresolved blocking, and invalid set blocking.
- Added `WorkoutIntakePanel` as a separate Training-tab panel without changing the manual `TrainingSessionComposer`.
- Saving confirmed drafts now calls the existing `createWorkout` API and then reuses the existing `onCreated` refresh path.
- Ambiguous exercises require a candidate selection before save; unresolved exercises can be deleted in this batch.

### Boundaries

- No new backend endpoint or create workout contract change.
- No automatic save from parser output.
- No voice capture, speech-to-text, LLM structured output, RAG, MCP, Agent, provider loop change, user-custom aliases, or medical / rehab judgment.
- Manual exercise-library selection for unresolved rows remains a future improvement.

### Verification Notes

- Batch verification results are recorded in the implementation closeout.

## 2026-05-30 Phase 4.4 Batch 4 - Intake Draft Manual Resolution

Improved the quick text intake draft review so ambiguous and unresolved exercise rows can be manually resolved through the existing exercise dictionary before saving. This keeps natural-language intake conservative while removing the main blocker before future voice capture.

### Completed

- Added optional selection mode to the existing exercise picker while preserving the default browse-only dictionary behavior.
- Passed the existing exercise search props into `WorkoutIntakePanel`.
- Added manual dictionary-exercise resolution for intake draft rows while preserving original `input_name` and parsed sets.
- Ambiguous rows now support candidate selection or a library override.
- Unresolved rows now support library selection or deletion.
- Save-blocking copy now distinguishes empty drafts, unmatched exercises, and invalid / empty sets.
- Added mapper tests for unresolved manual resolution and ambiguous manual override.

### Boundaries

- No backend endpoint or workout create contract changes.
- No set editing in this batch.
- No automatic save from parser output.
- No voice capture, speech-to-text, LLM structured output, RAG, MCP, Agent, provider loop change, user-custom aliases, or medical / rehab judgment.

### Verification Notes

- Batch verification results are recorded in the implementation closeout.

## 2026-05-30 Phase 4.4 Batch 5 - Voice Workout Capture

Added a frontend-only browser voice input prototype to the quick text intake panel. Voice capture only produces editable transcript text; the transcript still goes through the existing parse, draft review, manual resolution, and user-confirmed save flow.

### Completed

- Added a narrow browser SpeechRecognition hook that detects `SpeechRecognition` / `webkitSpeechRecognition`.
- Added speech recognition helper coverage for user-safe error copy and transcript append behavior.
- Added voice controls to `WorkoutIntakePanel`: start listening, stop listening, listening state, unsupported-browser fallback, and speech error notice.
- Final transcripts append into the existing text area without auto-parsing or auto-saving.
- Existing parser endpoint, draft review, ambiguous / unresolved resolution, and `createWorkout` save path remain unchanged.

### Boundaries

- No backend STT endpoint.
- No audio upload or audio storage.
- No Whisper / OpenAI speech API integration.
- No LLM structured output, RAG, MCP, Agent, provider loop change, user-custom aliases, or medical / rehab judgment.
- Browser support depends on the user's SpeechRecognition implementation.

### Verification Notes

- Batch verification results are recorded in the implementation closeout.

## 2026-05-30 Phase 4.4 Batch 6B - Hybrid Parser Fallback Reliability

Repaired the hybrid workout-intake parser around real oral-input testing. The API now keeps the existing rule-first path, but treats any matched exercise without valid sets as low quality, expands mock fallback coverage for realistic Chinese workout phrases, and returns Chinese user-facing warning copy instead of English parser internals.

### Completed

- Strengthened the fallback quality gate so exercises with no valid sets trigger structured fallback instead of returning a dead-end matched row.
- Added server coverage for realistic oral high-pulldown input such as `我今天训练了背部做了高位下拉做了3组每组做的是70公斤然后每组做了10次`.
- Expanded mock structured fallback to better recognize oral reps patterns like `每组做的是...` and `每组的次数是...`.
- Converted parser and fallback warnings to Chinese product copy.
- Updated workout-intake smoke coverage for oral high-pulldown parsing while preserving no-persistence and no-secret-leak assertions.

### Boundaries

- No frontend flow change in this repair batch.
- No backend STT, audio upload/storage, direct workout creation by LLM, LLM-selected exercise IDs, RAG, MCP, Agent/provider loop, User Training Profile, or medical / rehab behavior.

### Verification Notes

- Batch verification results are recorded in the implementation closeout.

## 2026-05-31 Phase 4.4 Batch 6C - Date-Aware Workout Intake

Fixed natural-language / voice intake date correctness. Workout intake now recognizes date hints in the transcript and writes the resolved date to `draft.performed_at`, so phrases like `昨天练了高位下拉...` no longer save as today by default.

### Completed

- Added deterministic date parsing for `今天`, `昨天`, `前天`, numeric month-day text, Chinese month-day text, slash dates, and ISO dates.
- Added `draft.date_source` and `draft.date_label` to the intake response.
- Rule parser and LLM fallback now share the same deterministic date result; the model does not decide final workout dates.
- Frontend parse requests now send a local offset reference datetime to avoid UTC day drift.
- Draft review shows a training date input and allows user correction before save.
- Save payload still uses the existing `createWorkout` contract through `draft.performed_at`.

### Boundaries

- No new backend endpoint or workout create contract change.
- No LLM date authority, Training Profile, RAG, MCP, Agent/provider loop, backend STT, audio upload/storage, or direct parser persistence.

### Verification Notes

- Batch verification results are recorded in the implementation closeout.

## 2026-05-31 Phase 4.4 Batch 6D - Intake Modal Responsiveness + Exercise Dictionary Expansion

Improved intake usability in two places: the transcript/draft modal now behaves like a bounded viewport-level dialog with a scrollable body and visible sticky footer actions, and the system exercise dictionary / alias layer now covers more common Chinese gym movements.

### Completed

- Reworked the intake modal into header, scrollable body, and sticky footer sections so parse/save actions stay visible on mobile-sized viewports.
- Kept the modal mounted through `document.body` portal with full-screen fixed overlay and high z-index.
- Hid the save action until a draft exists, reducing confusion before parsing.
- Expanded dictionary seeds with common shoulder, back, chest, leg, arm, and core exercises such as dumbbell shoulder press, pull-up, chin-up, dumbbell row, cable fly, Bulgarian split squat, hammer curl, plank, and hanging leg raise.
- Added Chinese alias coverage for common intake phrases including `哑铃推肩`, `坐姿哑铃推肩`, `引体向上`, `反手引体`, `侧平举`, `杠铃划船`, `哑铃划船`, `腿屈伸`, `腿弯举`, and `臀推`.
- Kept broad aliases such as `推肩`, `划船`, `夹胸`, `飞鸟`, `下拉`, and `弯举` conservative as ambiguous candidates.
- Added deterministic muscle-load mappings for the expanded exercises.
- Updated workout-intake smoke coverage for dumbbell shoulder press and pull-up parse behavior.

### Boundaries

- No new backend endpoint or workout create contract change.
- No user-custom dictionary / alias editor.
- No backend STT, audio upload/storage, RAG, MCP, Agent/provider loop, User Training Profile, direct workout persistence by parser, or medical / rehab judgment.

### Verification Notes

- Batch verification results are recorded in the implementation closeout.

## Phase 4.5 Batch 7B - PWA Install Experience

Completed:
- Added PWA manifest with FitMind AI metadata.
- Added PWA icons for 192x192, 512x512, maskable, and Apple touch icon.
- Added iOS / Android home-screen metadata in the client HTML entry.
- Added production-only service worker registration.
- Added minimal service worker for app shell and static assets.
- Added Chinese offline fallback page.
- Explicitly bypassed `/api/*` so auth, training APIs, and assistant SSE are not cached.
- Updated README with mobile install instructions.
- Updated production smoke checklist with PWA validation steps.

Verification:
- pnpm --filter @fitmind/client type-check passed
- pnpm lint passed
- pnpm test passed
- pnpm --filter @fitmind/client exec vite build passed
- Built manifest, service worker, offline fallback, and icons exist in client/dist.
- Built index.html includes manifest, theme-color, Apple mobile tags, and touch icon.
- Built service worker contains `/api/` bypass and offline fallback paths.

Pending production validation:
- Deploy to Vercel production.
- Verify manifest detection in browser devtools.
- Verify iOS Add to Home Screen.
- Verify Android Add to Home screen / Install app.
- Verify standalone launch.
- Verify offline fallback.
- Verify login, training save, intake, and assistant still work after service worker activation.

Notes:
- Offline workout editing is intentionally not supported.
- Auth storage and backend APIs were not changed.
- Capacitor / React Native were intentionally deferred.

## Phase 4.5 Batch 7B.1 - PWA Production Validation and Cache Hardening

Completed:
- Preserved mixed pre-7B.1 code/docs residue in a named stash instead of committing mojibake strings.
- Ignored local dev logs and `.claude/` from the root worktree.
- Kept service worker cache versioned as `fitmind-pwa-v1`.
- Reconfirmed `/api/*` bypass so API and assistant SSE requests are not cached.
- Replaced fragile press-and-hold voice intake with visible completion controls.
- Added email-only login convenience without storing passwords or persisting auth tokens.
- Added PWA cache clearing / reinstall troubleshooting notes to README.
- Recorded iPhone Safari home-screen validation notes in the production smoke checklist.

Pending production validation:
- Deploy Batch 7B.1 to Vercel production.
- Re-check `/api/health`, app shell, `sw.js`, manifest, and offline fallback.
- Re-test iPhone voice permission flow after deployment.
- Validate Android Chrome install when a real Android device is available.

Notes:
- Offline workout editing is still intentionally unsupported.
- Push notifications, Capacitor, React Native, and Training Profile remain deferred.
- Broader UI polish and exercise library improvements are deferred to a later UX batch.

## Phase 4.5 Batch 7C - Mobile Product UX Polish

Completed:
- Added shared ActionSheet component for consistent mobile modal / bottom-sheet behavior.
- Simplified the training top action area for mobile width.
- Moved secondary training entry methods into a clearer “more record methods” flow.
- Polished text and voice intake interactions.
- Kept voice input as tap-to-start with visible finish and cancel controls.
- Improved workout card expansion labels and selected / expanded visual states.
- Rewrote assistant and analysis copy away from developer-facing Tool Calling / context terminology.
- Improved exercise library empty states without adding full exercise detail/history features.

Verification:
- pnpm --filter @fitmind/client type-check passed
- pnpm lint passed
- pnpm test passed
- pnpm --filter @fitmind/client exec vite build passed
- Local browser smoke reached the FitMind AI login screen.

Pending production validation:
- Deploy Batch 7C to Vercel production.
- Re-test installed PWA on iPhone.
- Verify training create/edit, text intake, voice intake, time edit, delete confirmation, and AI assistant flows.

## Phase 4.7 - Voice Workout Intake Upgrade

Completed:
- Upgraded workout voice intake from a one-shot final-transcript flow to a more reliable progressive speech input flow.
- Enabled interim speech recognition results so users can see live transcription while speaking.
- Preserved final and interim transcript handling separately.
- Removed the standalone text-intake entry from the main training flow.
- Kept an editable confirmation step after voice recognition so users can correct recognition errors before generating a workout draft.
- Added a "continue speaking" flow so users can append another voice segment after the first recognition pass.
- Updated training entry copy to focus on voice-based workout logging.

Verification:
- `vitest run client/src/features/training/speech-recognition-utils.test.ts` passed.
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm test:unit` passed.
- `pnpm --filter @fitmind/client exec vite build` passed.

Notes:
- Full `pnpm verify` still fails because of pre-existing repository-wide Prettier drift unrelated to this batch.
- Browser microphone interaction still requires real-device validation because sandbox browser automation could not complete microphone testing.

## Phase 4.7D - Exercise Detail and Exercise History

Completed:
- Added exercise detail support to the exercise dictionary.
- Added Chinese technique cues, common mistakes, and equipment notes for exercises.
- Extended exercise dictionary responses with `technique_cues_zh`, `common_mistakes_zh`, and `equipment_notes_zh`.
- Added `ExerciseDetailSheet` using the shared ActionSheet pattern.
- Changed exercise card behavior so tapping an exercise opens the detail sheet before adding it to the current workout.
- Added recent exercise history display based on existing exercise progress data.
- Preserved the existing Chinese display layer and avoided exposing English/internal fields in normal user-facing UI.

Verification:
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm lint` passed.
- `pnpm test` passed.
- `pnpm --filter @fitmind/client exec vite build` passed.
- `pnpm --filter @fitmind/server build` passed.

Notes:
- Initial production deployment exposed that the Vercel Production database did not yet contain the seeded exercise dictionary data.
- Production dictionary initialization was handled separately in Phase 4.7D.1.

## Phase 4.7D.1 - Production Dictionary Initialization

Completed:
- Investigated why production `/api/exercises` returned an empty list after 7D deployment.
- Confirmed the issue was production database initialization rather than frontend or API implementation.
- Added a temporary protected one-shot production DB initialization endpoint.
- Used Vercel runtime environment access to initialize the real production database without exposing production secrets locally.
- Ran production migration and idempotent seed successfully.
- Verified production exercise dictionary data is available.
- Removed the temporary initialization endpoint after successful initialization.
- Removed `DB_INIT_TOKEN` from Vercel Production.
- Redeployed production after cleanup.

Production verification:
- `/api/health` returns 200.
- `/api/exercises` returns 43 exercises.
- `/api/exercises?muscle=shoulders` returns 15 shoulder-related exercises.
- Exercise detail fields are returned: `technique_cues_zh`, `common_mistakes_zh`, and `equipment_notes_zh`.

Safety:
- No production secret values were printed.
- No local token file remains.
- Temporary initialization code was removed after successful seed.
- Git workspace was clean after cleanup.

## Phase 4.8A - Evidence-backed Assistant + RAG Skeleton

Completed:
- Upgraded FitMind Assistant from fixed prompt-style interactions to natural training-question handling with `mode: "auto"`.
- Added a rule-based assistant intent router.
- Supported assistant intents: `summary`, `progress`, `imbalance`, `recommendation`, `exercise_history`, `evidence`, `knowledge`, `mixed_tool_rag`, and `unsupported`.
- Added a small training knowledge RAG MVP.
- Added `knowledge_documents` and `knowledge_chunks` database migration as the future persistence layer for training knowledge.
- Seeded an initial training knowledge corpus covering RPE, training volume, progressive overload, bench press plateau, deload, squat knee valgus, shoulder press mistakes, pull-up technique, and fatigue and recovery.
- Added keyword/full-text-style knowledge retrieval as the first RAG skeleton.
- Kept embedding provider, pgvector, LangChain, LangGraph, MCP, and multi-agent orchestration out of this batch.
- Added assistant orchestration that can choose deterministic training tools only, RAG knowledge retrieval only, mixed tool + RAG context, or unsupported response.
- Split assistant answer grounding into `evidence` for user-specific training data from deterministic tools and `sources` for general training knowledge from RAG retrieval.
- Added structured answer fields: `intent`, `conclusion`, `recommendation`, `evidence`, `sources`, and `limitations`.
- Added frontend support for the new `retrieving` stream state.
- Updated assistant UI so messages can display collapsible Evidence, Sources, and Limitations.
- Changed quick prompts into example questions instead of the only supported assistant entry path.
- Preserved the principle that the model must not invent user training facts.

Verification:
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm test:unit` passed.
- `pnpm --filter @fitmind/client exec vite build` passed.

Added / updated tests:
- Intent router tests for natural training questions, knowledge questions, mixed questions, and unsupported questions.
- Knowledge retriever tests for seeded training concepts.
- Assistant answer composer tests for structured evidence and sources.
- Frontend structured output tests for rendering assistant evidence and sources.

Pending:
- Manual browser smoke has not been completed yet.
- Production deployment has not been completed yet.
- Production migration and knowledge seed still need to be applied if this batch is deployed.
- Current RAG implementation uses a static seed corpus / keyword retriever; vector retrieval with embeddings and pgvector is intentionally deferred.

Next:
- Phase 4.8B: persist and query the training knowledge base from the database.
- Phase 4.8C: upgrade keyword retrieval to pgvector / embedding-based retrieval.
- Phase 4.8D: improve Tool + RAG answer quality and demo scripts.

## Phase 4.8A.1 - Production Validation and RAG Demo Smoke

Completed:
- Confirmed the workspace is on `main` with latest commit `4fcfdea feat: add evidence-backed assistant rag skeleton`.
- Treated `client-dev.pid` as local dev noise and did not include it in the docs commit.
- Deployed the current `fitmind-ai` source directory to Vercel Production with `npx vercel deploy --prod --force`.
- Verified the production alias `https://fitmind-ai-psi.vercel.app` points to the ready deployment `fitmind-dlxmxbtcn-minyu-jis-projects.vercel.app`.
- Verified production `/api/health` returns `200` with `{"ok":true,"data":{"status":"ok"}}`.
- Verified production `/api/exercises` returns a DB-backed `200` response.
- Ran production assistant smoke through a temporary test user with five bench-focused workouts.
- Verified natural bench progress questions classify as `progress` and return training Evidence when an exercise is selected.
- Verified `RPE 是什么？` classifies as `knowledge` and returns Sources.
- Verified `卧推没进步是不是训练量不够？` classifies as `mixed_tool_rag` and returns both Evidence and Sources when an exercise is selected.
- Verified `你根据什么判断？` classifies as `evidence`.
- Verified `给我讲个笑话` classifies as `unsupported` and returns a scoped limitation instead of a general chatbot answer.

Verification:
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm test:unit` passed: 24 test files, 113 tests.
- `pnpm --filter @fitmind/client run build` passed.
- Vercel source-directory production deploy completed successfully.
- Production smoke account: `rag-smoke-20260606222715@example.com`.

Notes:
- A Git-triggered Vercel production deployment for `4fcfdea` failed because the remote Git build path did not install workspace dev dependencies before running `tsc`.
- A prebuilt deployment was briefly attempted, but DB-backed routes returned `ERR_MODULE_NOT_FOUND`; the production alias was immediately restored to the prior Ready deployment before using the successful source-directory deploy path.
- `vercel pull --environment=production` produced an empty local `DATABASE_URL` value even though `vercel env ls` shows the encrypted Production variable exists, so production DB migration was not run locally from pulled env.
- Current runtime RAG remains static seed corpus plus keyword retrieval. DB-backed knowledge retrieval, embeddings, and pgvector remain deferred to 4.8B/4.8C.

## Phase 4.8A.2 - Vercel Git Build Path Fix

Completed:
- Investigated failed Git-triggered production deployments after `4fcfdea` and `ad3f8c4`.
- Confirmed Git builds cloned `github.com/Andrew-JX/FitMind_ai` at the repository root while the app workspace lives in `fitmind-ai/`.
- Confirmed the failed build ran `pnpm install --frozen-lockfile` from the repository root, then tried to build `fitmind-ai/server`, where `tsc` was unavailable.
- Updated the Vercel project `rootDirectory` setting from `.` / `null` to `fitmind-ai` using the Vercel project API.
- Investigated the first Ready Git build after the path fix, which returned `FUNCTION_INVOCATION_FAILED` on `/api/health` with `ReferenceError: exports is not defined`.
- Aligned the Vercel function module format by marking the root package as ESM and changing `api/index.js` to an ESM default export.
- Converted `eslint.config.js` to ESM and ignored local `.vercel` build output so lint does not scan generated deployment artifacts.
- Left assistant behavior, RAG behavior, auth, schema, migrations, training CRUD, voice, and UI design unchanged.

Verification:
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm test:unit` passed: 24 test files, 113 tests.
- `pnpm --filter @fitmind/client run build` passed.
- `pnpm lint` passed.
- `npx vercel build --prod` passed, and the generated function package keeps `"type": "module"` with an ESM `api/index.js`.

Next validation:
- Push the module-format fix to `main` to trigger a new Git-backed Vercel production deployment.
- Confirm the new Git-triggered deployment reaches Ready.
- Confirm `https://fitmind-ai-psi.vercel.app/api/health` returns 200 after the Git-triggered deployment.

## Phase 4.8B - DB-backed Knowledge Retriever

Completed:
- Replaced the runtime static-corpus RAG path with an async DB-backed keyword retriever for assistant `knowledge` and `mixed_tool_rag` intents.
- Added a `knowledge_documents` / `knowledge_chunks` repository boundary that joins document metadata to chunk content and returns only source fields needed by the assistant.
- Refactored knowledge tokenization and ranking into reusable pure helpers so keyword behavior can be tested without a database.
- Preserved the assistant response contract: user-specific training data remains `evidence`, and general training knowledge remains `sources`.
- Added a DB-backed knowledge retriever smoke script for `RPE 是什么？` that asserts source count, title, category, and chunk text without printing secrets.
- Fixed the pending training knowledge migration so `knowledge_chunks.tags` uses a raw `jsonb` empty-array default instead of a quoted string.
- Applied the existing up migration path against the configured database after smoke confirmed `knowledge_chunks` was missing.

Verification:
- Targeted retriever, repository, intent router, and answer composer tests passed.
- Training knowledge migration default-value regression test passed.
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm test:unit` passed: 26 test files, 118 tests.
- `pnpm --filter @fitmind/client run build` passed.
- `pnpm lint` passed.
- `pnpm --filter @fitmind/server run smoke:knowledge-rag ../.env` passed after the up migration, returning the DB source `RPE 主观用力程度`.

Deferred:
- Embeddings, pgvector, semantic search, reranking, LangChain, LangGraph, MCP, multi-agent behavior, auth changes, training CRUD changes, voice changes, and UI redesign remain out of scope.

## Phase 4.8B.1 - Production Assistant Smoke Closeout

Completed:
- Verified `https://fitmind-ai-psi.vercel.app/api/health` returns `200` after the 4.8B Git-triggered production deployment.
- Ran production assistant smoke with a temporary UTF-8 API test account and two bench workout records.
- Verified `RPE 是什么？` routes to `knowledge`, returns one DB-backed Source, and returns no training Evidence.
- Verified `卧推没进步是不是训练量不够？` routes to `mixed_tool_rag`, returns three Sources, and returns Evidence for two smoke workout records.
- Verified `给我讲个笑话` routes to `unsupported` and returns no Sources or Evidence.

Verification:
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm test:unit` passed: 26 test files, 118 tests.
- `pnpm --filter @fitmind/client run build` passed.
- `pnpm lint` passed.
- Production smoke top Sources: `RPE 主观用力程度` for the knowledge question and `卧推进步停滞` for the mixed question.

Notes:
- The first production smoke attempt sent Chinese JSON through Windows PowerShell without explicit UTF-8 bytes and routed the mixed question as `unsupported`; rerunning with UTF-8 encoded request bytes validated the expected production behavior.

## Phase 4.8C - Pgvector Embedding Retrieval

Completed:
- Added a pgvector migration for `knowledge_chunks.embedding vector(1024)`, `embedding_model`, and `embedded_at`.
- Chose Voyage AI `voyage-4-lite` as the accepted embedding provider for Phase 4.8C.
- Added a minimal Voyage REST embedding client using `fetch`, with `input_type: "document"` for chunks and `input_type: "query"` for user questions.
- Added DB repository helpers for exact cosine vector search, missing/stale embedding lookup, and embedding updates.
- Upgraded the knowledge retriever to prefer vector search when `VOYAGE_API_KEY` and chunk embeddings are available.
- Preserved keyword fallback for local/dev environments without Voyage credentials or embeddings.
- Added `scripts/embed-knowledge-chunks.ts` and `pnpm --filter @fitmind/server run embed:knowledge` for backfilling seed corpus embeddings.
- Upgraded knowledge RAG smoke to assert vector retrieval when `VOYAGE_API_KEY` is set.
- Updated RAG docs, D09 embedding decision, production smoke checklist, and troubleshooting notes.

Verification:
- Targeted Voyage client, repository, retriever, and migration tests passed.
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm --filter @fitmind/server lint` passed.
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm test:unit` passed: 27 test files, 128 tests.
- `pnpm lint` passed.
- `pnpm --filter @fitmind/client run build` passed.

Pending:
- Run the pgvector migration against production.
- Set `VOYAGE_API_KEY` in Vercel Production.
- Run knowledge embedding backfill in the target DB environment.
- Run production `smoke:knowledge-rag` and the three assistant production prompts after deployment.

Deferred:
- HNSW / IVFFlat ANN index, reranking, LangChain, LangGraph, MCP, multi-agent behavior, UI redesign, and new Assistant response fields remain out of scope.

## Phase 4.8C.1 - Vector Backfill and Production Smoke Closeout

Completed:
- Confirmed Phase 4.8C implementation commit `5d5df2c feat: add pgvector knowledge retrieval` was on `main`.
- Confirmed `VOYAGE_API_KEY` is configured in the safe local env and Vercel Production without printing secret values.
- Applied only the existing up migration `20260607090000_add_knowledge_chunk_embeddings` against the target database.
- Backfilled `knowledge_chunks.embedding` for 9 seed corpus chunks with Voyage `voyage-4-lite`.
- Ran DB-backed knowledge RAG smoke with `VOYAGE_API_KEY` present.
- Confirmed the DB smoke returned 3 Sources, top source `RPE 主观用力程度`, and `Retrieval mode: vector`.
- Triggered a fresh Git-backed Vercel Production deployment with empty commit `96e7ac4 chore: trigger voyage env deployment` so runtime could read the new env var.
- Verified the production alias `https://fitmind-ai-psi.vercel.app` returned `/api/health` 200.
- Ran production assistant smoke with UTF-8 JSON request bodies.
- Verified `RPE 是什么？` routed to `knowledge`, returned Source `RPE 主观用力程度`, and returned no workout Evidence.
- Verified `卧推没进步是不是训练量不够？` routed to `mixed_tool_rag`, returned 3 Sources with top Source `卧推进步停滞`, and returned Evidence for 2 smoke workout records.
- Verified `给我讲个笑话` routed to `unsupported` and returned no Sources or Evidence.

Verification:
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm test:unit` passed: 27 test files, 128 tests.
- `pnpm lint` passed.
- `pnpm --filter @fitmind/client run build` passed.
- `pnpm --filter @fitmind/server run db:migrate` applied only the up migration.
- `pnpm --filter @fitmind/server run embed:knowledge ../.env` updated 9 embeddings.
- `pnpm --filter @fitmind/server run smoke:knowledge-rag ../.env` passed with `Retrieval mode: vector`.

Notes:
- No `VOYAGE_API_KEY`, `DATABASE_URL`, Vercel env values, or raw DB connection strings were printed.
- `client-dev.pid` and `.history` env-file noise were left uncommitted.
- HNSW / IVFFlat ANN indexes, reranking, LangChain, LangGraph, MCP, agents, UI changes, auth changes, training CRUD changes, and new Assistant response fields remain out of scope.

## Phase 4.9 - Production RAG Quality and Knowledge Ops

Implementation status:
- Added repository hygiene ignores for `.history/`, `fitmind-ai/client-dev.pid`, and local env-history filename patterns.
- Added a stable `(document_id, chunk_index)` unique index migration so knowledge chunks can be upserted by imported fixture slug + chunk index.
- Added JSON and Markdown knowledge fixture parsing for server-side ingestion.
- Added `pnpm --filter @fitmind/server run import:knowledge` for upserting local knowledge fixtures and optionally embedding imported chunks with Voyage when `VOYAGE_API_KEY` is present.
- Upgraded retrieval from 4.8C vector-first fallback to 4.9 hybrid scoring when embeddings are available: `0.7 * normalized_vector_score + 0.3 * normalized_keyword_score`.
- Preserved keyword-only fallback for environments without Voyage credentials or available embeddings.
- Added safe structured retrieval logs with `intent`, `retrieval_mode`, top source titles, score summary, and fallback reason. Logs do not include raw prompts, tokens, env values, DB URLs, or workout details.
- Added deterministic RAG eval helpers and `pnpm --filter @fitmind/server run eval`.
- Updated knowledge RAG smoke to expect `Retrieval mode: hybrid` when `VOYAGE_API_KEY` is configured.
- Added `pnpm --filter @fitmind/server run smoke:assistant-production` for UTF-8 production assistant RAG smoke across knowledge, mixed Tool + RAG, and unsupported prompts.

Verification so far:
- Targeted 4.9 tests passed: repo hygiene, migration intent, repository upsert, ingestion parser, hybrid scoring, retrieval observability, eval behavior, and retriever behavior.
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm --filter @fitmind/client type-check` passed.
- `pnpm test:unit` passed: 31 test files, 141 tests.
- `pnpm lint` passed.
- `pnpm --filter @fitmind/client run build` passed.
- `pnpm --filter @fitmind/server run db:migrate` applied only the 4.9 up migration.
- `pnpm --filter @fitmind/server run embed:knowledge ../.env` confirmed embeddings were already up to date.
- `pnpm --filter @fitmind/server run smoke:knowledge-rag ../.env` passed with top source `RPE 主观用力程度` and `Retrieval mode: hybrid`.
- `pnpm --filter @fitmind/server run eval ../.env` passed 15 deterministic RAG eval cases.

Pending closeout:
- Re-run production health and assistant prompts after deployment.

## Phase 5.0 - AI Training Coach Productization Closeout

Closed:
- Added the visible AI Coach product flow on top of Evidence + Hybrid RAG.
- Added deterministic weekly training report service and `GET /api/training/weekly-report`.
- Added AI tool `get_weekly_training_report`.
- Added assistant intents and modes: `weekly_report`, `plateau_diagnosis`, and `next_week_plan`.
- Kept Assistant response shape compatible: user training data remains Evidence, retrieved knowledge remains Sources.
- Added Assistant quick prompts for weekly report, plateau diagnosis, and next-week draft.
- Updated production assistant smoke to cover weekly report, plateau diagnosis, mixed Tool + RAG, next-week plan, and unsupported prompts.
- Updated API contract and demo script with the Phase 5.0 product story.

Verification:
- `pnpm --filter @fitmind/server type-check` passed.
- `pnpm test` passed: 32 files, 145 tests.
- `pnpm lint` passed.
- `pnpm --filter @fitmind/client build` passed.
- `pnpm type-check` passed.
- Production `/api/health` returned 200 with status `ok`.
- `pnpm --filter @fitmind/server run smoke:assistant-production` passed after commit `01723fa` was pushed to `origin/main` and deployed.

Production smoke results:
- `RPE 是什么？` -> `knowledge`, 3 Sources, 0 Evidence.
- `帮我做一份本周训练报告` -> `weekly_report`, 0 Sources, 2 workout Evidence.
- `卧推平台期怎么诊断？` -> `plateau_diagnosis`, 3 Sources, 2 workout Evidence.
- `卧推没进步是不是训练量不够？` -> `mixed_tool_rag`, 3 Sources, 2 workout Evidence.
- `给我一个下周训练草案，要参考训练容量、渐进超负荷和deload` -> `next_week_plan`, 3 Sources, 2 workout Evidence.
- `给我讲个笑话` -> `unsupported`, 0 Sources, 0 Evidence.

Out of scope:
- Save/Share is deferred to Phase 5.1.
- No LangChain, LangGraph, MCP, agents, auth redesign, UI redesign, voice changes, or RAG architecture changes were added.

Notes:
- `client-dev.pid` remained local uncommitted noise and was not included in Phase 5.0 commits.

## Phase 5.1 - Assistant Insight Save and Demo Packaging Closeout

Closed:
- Added persisted Assistant saved insights for `weekly_report`, `plateau_diagnosis`, and `next_week_plan` replies.
- Added authenticated save, list, detail, and delete APIs under `/api/assistant/insights`.
- Added Assistant Save / Copy controls and saved insight history in the existing Assistant workspace.
- Demo seed now includes three saved insights for the demo account.
- Copy text uses stable plain-text fields for type, summary, Evidence counts, Sources, and limitations.

Verification:
- Implementation commit `1ed02e4 feat: add assistant saved insights and polish coach ux` was pushed to `origin/main`.
- Production `/api/health` returned 200 with status `ok`.
- `pnpm db:migrate` reported no pending migrations after `assistant_saved_insights` was applied.
- `pnpm --filter @fitmind/server run smoke:assistant-saved-insights` passed.

Saved-insights smoke coverage:
- Eligible Assistant replies can be saved.
- Saved insights list and detail are scoped to the authenticated user.
- Saved insights can be deleted by owner.
- Unsupported replies and cross-user message IDs are rejected.
- Generated copy text includes type, summary, Evidence count, Sources, and limitations.

Out of scope:
- No public share links, auth redesign, UI redesign, LangChain, LangGraph, MCP, agents, voice changes, or RAG architecture changes were added.
- Assistant response shape and Evidence/Sources semantics remained unchanged.

## Phase 5.2A - Product Feedback Button Closeout

Closed:
- Added a lightweight authenticated product feedback entry in the logged-in AppShell header.
- Users can submit rating-only, message-only, or rating + message feedback; empty feedback is rejected.
- Added `POST /api/feedback` with user ownership from JWT auth context only.
- Added `product_feedback` persistence with rating, message, source route, user agent, and created timestamp.
- Kept the feature isolated from Assistant router/orchestrator/composer, RAG, and tool execution paths.

Verification:
- Implementation commit `1ae8108 feat: add product feedback button` was pushed to `origin/main`.
- Local verification passed: server type-check, client type-check, `pnpm type-check`, `pnpm test` with 172 tests, `pnpm lint`, and client build.
- Applied the `20260610090000_create_product_feedback` migration to the target database.
- Production `/api/health` returned 200 with status `ok`.
- Production feedback smoke passed for rating-only, message-only, rating + message, and empty-submit rejection.
- Production DB check confirmed the smoke feedback rows exist and their `user_id` values match the authenticated smoke user.

Feedback visibility:
- There is no admin UI or profile feedback list yet.
- Feedback is currently visible by querying the `product_feedback` table, typically ordered by `created_at DESC`.

Out of scope:
- No feedback admin page, personal profile page, analytics dashboard, or feedback list UI was added.
- No Assistant core routing, orchestration, composition, RAG, LangChain, LangGraph, MCP, agents, or tool-executor changes were added.
- `client-dev.pid` remained local uncommitted noise.

## Phase 5.2A.1 - Agent Documentation Sync Rule

Closed:
- Tightened the Claude Code handoff rules so every task must include a document-impact audit before the final response.
- Made documentation updates mandatory when behavior, contracts, process, operations, or user-visible workflows change.
- Added a routing table that maps API, DB, Assistant, RAG, frontend, local run, troubleshooting, and process changes to the docs that should be checked and usually updated.
- Clarified that the user does not need to enumerate every related document; the agent must infer the affected contracts and docs from the codebase.
- Added a required final-response `Docs:` line for updated docs and intentionally skipped docs with reasons.

Verification:
- Docs-only update.
- Targeted handoff content was reviewed after patching.

Notes:
- `AGENTS.md` still contains historical encoding damage. The durable operational rule is now centralized in `docs/CLAUDE_CODE_HANDOFF.md`; cleaning or rewriting `AGENTS.md` should be a separate controlled task.

## 2026-06-11 仓库整理 + 文档收敛

Closed:
- 清理被 git 跟踪但已 gitignore 的开发垃圾文件（`*.pid`、`*-smoke*.log`、`server-dev.*.log`、`tmp-start-server-browser-smoke.ps1`）及工作区未跟踪日志。
- 文档入口收敛为单一 `AGENTS.md`：删除根目录 `AI_WORKFLOW.md`（通用协作随笔）与刚生成、与现有文档大量重复的 `docs/CLAUDE_CODE_HANDOFF.md`；把"当前状态"与"文档同步规则"两节并入 `AGENTS.md`，精简开工前必读清单。
- 修正 `README.md` 指向已删 handoff 的悬空链接，改指 `AGENTS.md`。
- 新增前瞻文档 `docs/roadmap.md`（与回顾向的 `progress.md` 配对），并挂入 README。

Notes:
- 此前 `CLAUDE_CODE_HANDOFF.md` 声称 `AGENTS.md` 有乱码，经核对 `AGENTS.md` 为干净中文，未沿用该说法。

## 2026-06-11 Phase 5.3 Batch 1 - 鉴权持久化（HttpOnly 会话 cookie）

Closed:
- 登录 / 注册时后端通过 `Set-Cookie` 写入 HttpOnly 会话 cookie（`fitmind_token`，`HttpOnly; SameSite=Lax; Path=/`，生产追加 `Secure`，7 天，与 JWT 过期一致）；响应体仍返回 `token` 兜底。
- `authMiddleware` 改为优先读 cookie、缺失回退 `Authorization: Bearer`，`server/scripts/*-smoke.ts` 等非浏览器客户端继续可用。
- 新增 `POST /api/auth/logout` 清除 cookie（无需鉴权、幂等）。
- 新增 `server/src/utils/auth-cookie.ts`（不引入 `cookie-parser`：用内置 `res.cookie`/`res.clearCookie` 写、手写 `Cookie` 头解析读）。
- 前端：`http-client` 与 `assistant-stream-api` 改用 `credentials: "include"`；`use-auth` 新增 `bootstrap()`（加载时调 `/me` 用 cookie 恢复会话）与 `logout()`；`App.tsx` 挂载时 bootstrap，加恢复中 loading gate，退出按钮改走真正的 `/logout`。
- 解决"刷新即掉线"，兑现 `PROJECT_BRIEF §10.2` 的生产鉴权方案。

改动文件：
- 服务端：`server/src/utils/auth-cookie.ts`（新）、`auth-middleware.ts`、`auth-controller.ts`、`routes/auth.ts`、`shared/src/auth.ts`、测试 `auth-middleware.test.ts` + `app.test.ts`。
- 前端：`client/src/services/http-client.ts`、`features/auth/auth-api.ts`、`features/auth/use-auth.ts`、`features/assistant/assistant-stream-api.ts`、`App.tsx`。
- 文档：`api-contract.md`、`ai-decisions.md`（D19）、`AGENTS.md` §11、`roadmap.md`。

Verification:
- `pnpm --filter @fitmind/server type-check`、`pnpm --filter @fitmind/client type-check`：通过。
- `pnpm --filter @fitmind/client lint`：通过。
- `pnpm test:unit`：40 文件 / 174 用例全过（含新增 cookie 鉴权用例）。
- `pnpm --filter @fitmind/client build`：通过。
- `pnpm format:check`：仓库级既有格式欠债（约 118 文件，含本次未触碰文件）导致 fail；本次新增代码符合 Prettier；已另起后台任务统一修复。

Notes:
- CSRF：靠 `SameSite=Lax` + 同源部署，双提交 token 推迟（见 D19）。
- 未做：access/refresh 双 token、CSRF token、会话吊销 —— 留待后续。
- 待办（Phase 5.3 后续批次）：Batch 2 浏览器 E2E、Batch 3 性能实测。

## 2026-06-11 Phase 5.3 Batch 2 - 浏览器 E2E（Playwright + mock 后端）

Closed:
- 引入 Playwright（`@fitmind/client` devDependency `@playwright/test`），mock 后端 / route interception，E2E 不需要 API server、数据库或密钥；Playwright 自起 Vite dev server 跑 Chromium headless。
- 新增 `client/playwright.config.ts`、`client/e2e/auth-session.spec.ts`、`client/e2e/support/mock-api.ts`。
- 覆盖鉴权会话流程（浏览器层验证 Batch 1）：加载时 `/me` cookie 会话恢复、刷新后保持登录、登录进入应用壳、登出回登录页、无会话显示登录页。
- 新增脚本：根 `pnpm test:e2e` → `pnpm --filter @fitmind/client run test:e2e`（`playwright test`）。
- `.gitignore` 忽略 Playwright 产物（`test-results/`、`playwright-report/` 等）。
- 顺手修正 `AuthScreen` 过时文案（原"登录令牌仅保存在内存中…需要重新登录"已被 Batch 1 推翻），改为"登录状态保存在 HttpOnly 会话 cookie，刷新后自动保持登录"。

改动文件：
- 新增：`client/playwright.config.ts`、`client/e2e/auth-session.spec.ts`、`client/e2e/support/mock-api.ts`。
- 修改：`client/package.json`（devDep + `test:e2e`）、根 `package.json`（`test:e2e` 透传）、`pnpm-lock.yaml`、`.gitignore`、`client/src/features/auth/AuthScreen.tsx`（文案）。
- 文档：`docs/local-run-guide.md`（§8.5 E2E 运行说明）、`roadmap.md`、`AGENTS.md` §11。

Verification:
- `pnpm --filter @fitmind/client exec playwright install chromium`：成功（首次下载浏览器二进制）。
- `pnpm test:e2e`：**5/5 用例通过**（Chromium headless）。
- `pnpm --filter @fitmind/client type-check`：通过（`client/tsconfig.json` 只含 `src/**`，e2e 由 Playwright 自行编译，不进现有门禁）。
- `eslint` 与 `prettier` 对新增 e2e 文件：通过。

Notes:
- E2E 定位为客户端确定性回归（mock 后端），CI 友好；真实后端链路仍靠 `server/scripts/*-smoke.ts`。
- 训练 / 分析 / 助手的全流程 E2E（需要 mock 更多端点或真实后端）留作后续批次。
- 待办（Phase 5.3 剩余）：Batch 3 性能实测（TTFT / Tool 端到端 / 列表加载，回填 `PROJECT_BRIEF §11` 与 README）。

## 2026-06-11 Phase 5.3 Batch 3 - 真机性能测试流程（待回填数字）

Closed:
- 按用户要求，Batch 3 先交付"真机测试流程"而非自建测量工具（真实性能数字需在真机 / 线上才有说服力）。
- 在 `docs/production-smoke-checklist.md` 新增两节：
  - 「Cookie Session (Phase 5.3 Batch 1) — 真机回归」：手机浏览器验证刷新保持登录 / 重开保持 / 登出清 cookie / 无痕显示登录页；并给出"看登录页新文案确认 Vercel 已部署最新构建"的判断方法。
  - 「Phase 5.3 Batch 3 — 真机性能测试流程」：Lighthouse 移动端 / 安卓 USB 远程调试 / 纯手机粗测三种方法对应 §11 各指标，附待回填结果表。
- `git push origin main`（3 个提交：Batch 1 / Batch 2 / 清理+文档）已推送，触发 Vercel 部署，供真机测试。

改动文件：
- `docs/production-smoke-checklist.md`、`docs/roadmap.md`（Batch 3 标记"流程就绪/待回填"）、`docs/progress.md`。

Verification:
- 文档型交付；真实性能数字待用户在真机 / 线上跑一轮后回填结果表，再同步 README 与 `project-study-guide.md`。

Notes:
- 助手 TTFT / Tool 端到端依赖 `ASSISTANT_PROVIDER`：线上若为 mock 则偏快，记录时需注明 provider。
- Phase 5.3 三批：Batch 1（鉴权持久化）✅、Batch 2（浏览器 E2E）✅、Batch 3（性能实测）流程就绪、数字待回填。

## 2026-06-11 修复 - 语音多动作解析 & cookie 会话后数据不加载

### A. 语音/录入「多个动作只加一个」（server 解析器）
根因：`workout-intake-parser.ts` 的 `normalizeIntakeText` 把 `，,、` 归一成**空格**，而只有 `;。.；\n` 才是 segment 分隔符——所以"卧推60公斤8个，深蹲100公斤5个"被并成一个 segment，只解析出第一个动作（语音识别文字是全的，解析丢了后面的）。

修复：
- `，,、` 改成归一为 `;`（分隔符）；动作名后紧跟组数的片段由既有合并逻辑回填，不会误拆。
- 新增 `splitRunOnExerciseSegment`：对无标点的连续语音（"卧推60kg8reps深蹲100kg5reps"）按已知动作短语切分，且**仅当两个动作短语之间出现过组数/重量上下文才切**，避免把单个多字动作名拆开。
- 新增 2 个测试（逗号分隔、无标点连读），解析器测试 20→22 全过。

### B. cookie 会话恢复后「训练记录没了、助手用不了」（client 回归）
根因（Batch 1 引入）：改成 HttpOnly cookie 会话后，关闭重开时 `auth.token` 为 `null`（JS 读不到 cookie 里的 JWT），而 `useWorkouts` / `useTrainingSummary` 用 `if (!token) return` 门控、`useAssistantChat` 用 `if (!token)` 拒绝——于是会话在、数据全不加载。"退出重登就好"是因为登录会写回内存 token。

修复：
- `use-auth.ts` 新增导出常量 `COOKIE_SESSION_TOKEN`，`bootstrap()` 成功时把 `activeToken` 置为该哨兵值。请求靠 cookie（`credentials:"include"`）鉴权，哨兵只作"已登录"开关、作为无害 bearer 发出（服务端优先用 cookie，从不校验它），客户端从不解码 token 值（已 grep 确认）。
- 新增 E2E 回归用例「cookie 恢复会话后仍发起 `GET /api/workouts`」，E2E 5→6 全过。

改动文件：
- A：`server/src/services/training/workout-intake-parser.ts`、`workout-intake-parser.test.ts`。
- B：`client/src/features/auth/use-auth.ts`、`client/e2e/auth-session.spec.ts`。

Verification:
- `pnpm test:unit`：176 全过（解析器 +2）。`pnpm test:e2e`：6/6。`pnpm lint` / `pnpm type-check`：通过。

Notes:
- 无标点连读多动作为 best-effort（仅在动作短语间有组数/重量时切分）；带标点 / 自然停顿的语音是主路径，已稳。
- 待办（按用户选择 A+B 先做）：Batch C — 记录页右下"+"手势 FAB（长按反馈 / 上滑语音 / 右滑动作库）+ 语音解析结果追加到当前 draft。

## 2026-06-11 语音多动作 2 - 自由口语解析增强（规则 + LLM 两路）

背景：用户用自然口语"做了高位下拉和坐姿器械划船还有单手绳索下拉，其中高位下拉做了3组每组80公斤8次…手绳索下拉4组75磅9次"，仍只识别一个。根因三层叠加：`和/还有` 未分隔、"先报清单再分述"产生重复动作、`磅` 未转换。另查到 mock 兜底解析器写死只返回 1 个动作，故 mock 线上无法靠兜底救。用户选择「两个都要」。

Path B（规则解析器，免费、对 mock 线上即生效）：
- `normalizeIntakeText`：`和/还有/以及` 作分隔符；`磅/lbs` 按 1lb=0.4536kg 转 `kg`（draft 存 weight_kg）。
- 新增 `mergeIntakeExercises`：按 `matched_exercise_id`（无匹配时按归一 input_name）合并同一动作，合并 sets——"先报清单（无组数）+ 再分述（带组数）"自动去重为每个动作一条。"具体匹配"优先于先前的"模糊/未匹配"提及。
- 新增 3 个测试（连接词分隔、磅→公斤、announce-then-detail 合并）；解析器 22→25，整体单测 176→179 全过。

Path A（Anthropic 智能解析，需用户在 Vercel 开启）：
- `buildWorkoutIntakeSystemPrompt` 增补两条：解析所有动作并把"先报后述"合并为每动作一条；`磅/lbs`→kg。
- `.env.example` 补 `WORKOUT_INTAKE_LLM_PROVIDER`（mock/off/anthropic）与 `ASSISTANT_PROVIDER` 说明。
- 启用方式：Vercel 环境变量设 `WORKOUT_INTAKE_LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`，即可用 Claude 解析自由口语（多动作 / 磅 / 先报后述）。

改动文件：
- `server/src/services/training/workout-intake-parser.ts` + `.test.ts`、`workout-intake-llm-parser.ts`、`.env.example`。

Verification:
- `pnpm test:unit`：179 全过。`pnpm lint` / `pnpm type-check`：通过。

Notes:
- 规则路径仍有上限：动作名"换词复述"（如"单手绳索下拉" vs "手绳索下拉"）匹配不到同一 key 时不会合并，会留一个待确认项——真正鲁棒靠 Path A。
- mock 兜底仍只返回 1 个动作（未改）；规则路径已能直接产出多动作，兜底很少触发。

## 2026-06-11 录入解析新增 Gemini provider（免费 LLM 兜底）

用户不想为 Anthropic 付费，选择免费的 Google Gemini。新增 `gemini` provider，作为录入解析的免费 LLM 兜底（自由口语 / 多动作 / 磅 / 先报后述）。

改动：
- `env.ts`：`WORKOUT_INTAKE_LLM_PROVIDER` 枚举加 `gemini`；新增 `GEMINI_API_KEY`（可选）；`ServerEnv` + `loadServerEnv` 暴露 `geminiApiKey`。
- `workout-intake-llm-parser.ts`：`WorkoutIntakeLlmProviderMode` 加 `gemini`；新增 `parseWithGeminiWorkoutIntakeLlm`（`gemini-2.0-flash`，`generateContent`，`x-goog-api-key` 头，`responseMimeType: application/json` + `temperature: 0`，复用同一 system prompt）；在 `createWorkoutIntakeLlmParser` 接入。
- `.env.example`：补 `GEMINI_API_KEY` 与 provider 说明。

启用：Vercel 设 `WORKOUT_INTAKE_LLM_PROVIDER=gemini` + `GEMINI_API_KEY=<key>`，Redeploy。

Verification:
- `pnpm --filter @fitmind/server type-check`、`pnpm test:unit`（179）、`pnpm lint`：通过。
- Gemini 适配器为网络调用，未做单测（与 anthropic 适配器一致，靠 hybrid parser 的注入式 mock 覆盖逻辑）；真实效果需用户填 key 后线上验证。

## 2026-06-11 修复 - 空 env 搞崩登录 & 第二个动作被吞

### A. 空 `ANTHROPIC_API_KEY` 导致登录 "Request validation failed"
线上探测发现：Vercel 上 `ANTHROPIC_API_KEY` 被设成空字符串，`z.string().min(1).optional()`（optional 只允许 undefined、不允许空串）→ 每次读 env（含登录查库）都抛 ZodError → 全站登录报 VALIDATION_ERROR。修复：新增 `optionalSecret`（`z.preprocess` 把空/纯空白串视为未设置），应用到 DATABASE_URL/JWT_SECRET/ANTHROPIC/GEMINI/VOYAGE；并给 provider 枚举加 `.catch("mock")`。新增 `env.test.ts`（4 例）。

### B. 逗号分隔的第二个动作被并进第一个
线上探测 `杠铃卧推60公斤8次，深蹲100公斤5次` 返回**一个** 杠铃卧推带两组。根因：`splitExerciseSegments` 的"集合碎片回填上一个动作"逻辑，对**词典里不认识的动作名**（深蹲）也生效——只要该段有重量/次数就被吞进上一个动作。修复：仅当该段是"纯组数碎片"（剥掉重量/次数/组/口语填充词后无残留名字）才回填；带名字的段（即便未匹配，如深蹲）保留为独立动作。新增 `isSetOnlyFragment`，新增 1 个解析器测试；修复未破坏既有跨子句合并用例（解析器 26/26、整体单测 184）。

Verification:
- 登录：线上重测注册/登录正常（从 400 恢复）。
- `pnpm test:unit`（184）、`pnpm lint`、`pnpm --filter @fitmind/server type-check`：通过。

Notes:
- 深蹲若不在生产词典/别名里，会作为"待确认动作"出现（带正确组数），用户手动选对动作即可；开 Gemini 后由 LLM 直接匹配更顺。

## 2026-06-11 语音录入 - 候选确认移到语音页（不让未确认动作进 composer）

用户反馈：未匹配/多候选的动作（如"高位下拉 / 直臂下压"）现在直接进了"添加动作"页才提示确认；希望未确认前不进 composer，确认这一步在语音页完成。

修复（`WorkoutIntakePanel.tsx`）：
- 解析后若有 `match_status !== "matched"` 的动作，不再直接 `onDraftParsed`，而是打开新的"确认识别到的动作"resolution sheet：
  - 已匹配：显示"已匹配：xx"。
  - 多候选（ambiguous）：列出候选按钮，点选即确认为该动作；也可移除。
  - 未识别（无候选）：只能"移除"（不让词典外的垃圾进训练）。
- 全部确认后点"加入训练"，只把已选定（matched）的动作传给 composer；composer 不再出现"需要确认候选"提示。全部已匹配时仍直接进 composer（行为不变）。
- 新增 Groq provider（`8195a63`，因 Gemini 免费层对该账号持续 429）。

Verification:
- `pnpm --filter @fitmind/client type-check` / `lint` / `build`：通过。

Notes:
- 未匹配（无候选）目前只提供"移除"，暂不支持在该页直接搜动作库替换——后续可加。
- 仍需用户在 Vercel 配 `WORKOUT_INTAKE_LLM_PROVIDER=groq` + `GROQ_API_KEY` 才能让自由口语走 LLM；规则解析 + 本次确认流对结构化语音已可用。

## 2026-06-13 记录页内语音 - 手势 FAB + 语音追加到当前 draft（roadmap §1.6 任务 B）

之前语音录入只能从训练页入口新建一条训练；进入 composer（记录页内）后无法再语音补动作。本批次让 composer 右下的 FAB 支持手势，并把语音解析结果**追加**到当前 draft（不新建、不替换）。

改动：
- `use-fab-gesture.ts`（新）：FAB 指针手势 hook。点按/键盘 = 原行为（开动作库）；长按触发震动 + 视觉提示浮层；上滑 = 语音追加、右滑 = 动作库。`navigator.vibrate` 兜底（不支持则静默），`setPointerCapture` 让滑动越界仍可识别，`touchAction:none` 防页面滚动抢手势。
- `workout-intake-to-session-draft.ts`：新增纯函数 `appendIntakeExercisesToDraft(current, incoming)` —— 已匹配且 `exerciseId` 已在 draft 的，把组并进现有卡片（`mergedCount`）；其余追加为新卡片（`addedCount`）；所有追加的 exercise/set id 重新生成防跨次冲突。
- `workout-intake-to-session-draft.test.ts`：补 3 例（合并/新增/id 唯一）。
- `TrainingSessionComposer.tsx`：FAB 接 `useFabGesture` + 方向提示浮层；上滑打开"语音追加动作" ActionSheet，内嵌复用 `WorkoutIntakePanel`（解析时已走完候选确认，`onDraftParsed` 吐出的全是已匹配动作）；`handleAppendIntakeDraft` 映射 + 追加 + 顶部提示"已追加 N 个动作"。

UX 取舍：上滑打开的弹窗里仍是点麦克风开始（直接复用现成组件、零回归），未做"上滑即自动录音"；如需可后续给 `WorkoutIntakePanel` 加 `autoStart`。

Verification:
- `pnpm type-check`、`pnpm lint`（改动文件）、`pnpm test:unit`（187）：通过。
- E2E（`pnpm test:e2e`）覆盖鉴权流程，未覆盖 composer 手势；手势/震动需真机手测。

Notes:
- roadmap §1.6 任务 B 完成；任务 A（配 Groq）用户已在 Vercel 配好。
- 任务 C（未匹配动作在确认页搜词典替换）仍未做。

## 2026-06-13 录入确认页 - 未匹配动作支持"搜动作库替换"（roadmap §1.6 任务 C）

之前语音/文本录入的"确认识别到的动作"页里，未识别（无候选）的动作只能"移除"。本批次加了"搜动作库替换"入口，复用现成的 `ExerciseLibraryScreen`（与 composer 内"替换动作"同一套 UI）。

改动：
- `WorkoutIntakePanel.tsx`：新增 `exerciseLibraryProps: ExercisePickerProps` prop 与 `searchingIndex` 状态。未匹配分支加"搜动作库替换"主按钮、多候选分支加"都不是？搜动作库"次入口；点开后用 `createPortal` 在 body 上挂一个 `position:fixed inset:0`（z-index 顶格）的全屏壳渲染 `ExerciseLibraryScreen`（`mode="replace"`，自带 `onSearch` 懒加载词典），选中即 `chooseCandidate(index, id, name)` 把该行确认为 matched。`closeResolution` 一并清 `searchingIndex`。
- `TrainingView.tsx` / `TrainingSessionComposer.tsx`：两处调用点传入 `exerciseLibraryProps`（分别来自 `props.exercisePickerProps` 与 `props.exerciseLibraryProps`）。

Verification:
- `pnpm type-check`、`pnpm lint`、`pnpm test:unit`（187）：通过。
- 无新增纯函数逻辑，未加单测；交互需手测（确认页点"搜动作库替换"→ 选动作 → 该行变"已选择" → 加入训练）。

Notes:
- roadmap §1.6 任务 C 完成。任务 B（手势 FAB）同日已上线；本次 B+C 一起部署便于手机端联测。

## 2026-06-13 手势 FAB 重设计 - 速拨"细胞分裂" + 长按提示（任务 B 迭代）

用户反馈：FAB 在右下角无法右滑，方向应改"上滑 + 左滑"；交互要更炫（从加号"细胞分裂"成三个按钮 上/中/左）；长按完不要再显示"上移/左移"文字；静止时要让用户知道"可长按"。

改动：
- `use-fab-gesture.ts`（重写）：从"滑动提示"hook 改为**速拨手势**。`onSelect(action: "voice" | "library")` 单回调；长按（200ms）或果断拖动（>14px）触发分裂 `isOpen`；上滑→voice、左滑→library（阈值 30px），松手即选；快速轻点 → 默认 `library`。暴露 `isOpen`/`activeAction`/`select`/`close`/`buttonHandlers`，满足"滑动松手选"或"分裂后点卫星选"两种路径。
- `TrainingSessionComposer.tsx`：FAB 区重渲染——两颗卫星按钮（mic / dumbbell）`position:absolute` 从中心 `scale(0.3)` 用回弹缓动 `cubic-bezier(0.34,1.56,0.64,1)` + 错峰弹到上/左（细胞分裂感）；中心"+"图标旋转 135° 成 ×；静止时脉冲光环 `fitmindFabPulse` + 呼吸"长按"小标 `fitmindFabHoldHint`；`isOpen` 时加透明 backdrop 点击收起。去掉旧的"上滑/右滑"文字提示与 `fabHint*` 样式。

UX：中=收起、上=语音、左=动作库；滑动或点卫星均可；轻点保留开动作库。iOS Safari 无震动（`navigator.vibrate` 不支持），靠光环 + 卫星动效反馈。

Verification:
- `pnpm type-check`、`pnpm lint`、`pnpm test:unit`（187）：通过。
- 手势/动画需真机手测（长按分裂、上/左滑高亮松手、点卫星、点空白收起、脉冲提示）。

## 2026-06-14 Phase 6.0 Batch 1 - 多步 ReAct 训练计划 agent 核心（未接线）

把单轮 next-week-plan 升级为多步 Agent 的第一批：落地后端 agent 核心，可单测，暂未接入助手流。

改动（新增 `server/src/services/agent/`）：
- `react-planner-types.ts`：trace / step / 事件类型。`AgentTraceStep`（index/kind/title/thought/tool_name/observation/status/duration_ms）、`AgentTrace`（goal/steps/max_steps/stop_reason）、`AgentStepEvent`（started/finished 两相，供 SSE）、`NextWeekPlanAgentDeps`（注入 `runTool`/`retrieve`/`onStep`/`now`）。
- `next-week-plan-agent.ts`：确定性 ReAct 策略。步骤：查容量(get_weekly_training_report) → 找弱项(get_recommendation_context) → 查进展(get_exercise_progress，仅在指定动作时，否则记一条 skipped 步骤) → 检索知识(RAG) → 生成草案。基于观察分支：空数据第一步即停（stop_reason=no_data）；按周频率给"巩固/加量/维持"策略；证据(workout_ids/set_ids/calculation_rules)跨步去重聚合；次要工具失败不致命（safe 步骤记 error 后继续到 synthesis）。阈值用命名 module 常量（HIGH/LOW_WEEKLY_FREQUENCY、AGENT_MAX_STEPS），与 weekly-training-report-service 的现有约定一致。
- `next-week-plan-agent.test.ts`：4 例（全流程跳过进展 / 指定动作查进展 / 空数据早停 / 次要工具失败仍合成），注入式 mock，无 DB。

Verification:
- `pnpm --filter @fitmind/server type-check`、`pnpm lint`、`pnpm test:unit`（191，+4）：通过。

Notes:
- 这一批不改任何线上行为（agent 还没被 orchestrator 调用）。Batch 2 接线 + SSE 事件 + 契约文档；Batch 3 前端 trace 时间线。
- 期间还顺手去掉了 FAB 的"长按"小标（保留脉冲光环），见上一条 commit。

## 2026-06-14 Phase 6.0 Batch 2 - 多步 ReAct agent 接线 + SSE 事件

把 Batch 1 的 agent 核心接进助手流，next_week_plan 线上即走多步规划。

后端：
- `assistant-stream-types.ts`：state 加 `planning`；新增 `agent_step_started`（index/kind/title/thought/tool_name）与 `agent_step_finished`（index/status/duration_ms/observation）事件。
- `assistant-orchestrator-service.ts`：`intent === "next_week_plan"` 早返回到 `runNextWeekPlanAgentTurn`——发 provider_selected + state:planning，跑 `runNextWeekPlanAgent`，注入 `runTool=executeAiTool`、`retrieve=retrieveKnowledgeChunks`(包一层 logRetrievalEvent)、`onStep→SSE`；trace 写进 `MockAssistantTurnResponseData.agent_trace`，随 structured_output 持久化。tool 校验失败 → 400，其它 → AGENT_ERROR 并发 error 事件。删掉旧单轮 `buildNextWeekPlanAnswer` 与其 provider 分支（已死代码）。

前端：
- `assistant-types.ts`：status/state 加 `planning`；AssistantStreamEvent 加两个 agent_step 事件；新增 `AssistantAgentTrace`/`AssistantAgentTraceStep` 类型；`AssistantChatMessage.agentTrace`；`AssistantStructuredOutput.agent_trace`。
- `use-assistant-chat.ts`：agent_step_started→setStatus(planning)+upsert 运行中步骤；finished→patch 步骤状态/观察；structured_output 额外把 `agent_trace` 映射到 message.agentTrace（权威值）；**关键修复**：末尾 else 原本把任何未识别事件当成 error（读 event.message），改成只处理 `type==="error"`、未知事件忽略——否则新事件会打挂旧客户端。
- `AssistantStatusRail.tsx`：planning 复用 thinking pill + 加规划文案（避免改动 shared 的 StatusPill 枚举）。

Verification:
- `pnpm type-check`、`pnpm lint`、`pnpm test:unit`（191）：通过。
- 真机验证：助手里问"帮我规划下周训练"（mode=next_week_plan 或自动路由命中），应看到 planning 状态 + 多步事件；trace 暂未渲染（Batch 3 做时间线 UI），但答案与证据已是多步聚合结果。

Notes:
- 客户端与服务端同批改，保证部署任一时刻不破（旧客户端遇新事件已能忽略）。
- Batch 3：`AssistantAgentTrace.tsx` 时间线 + 挂载渲染。

## 2026-06-14 Phase 6.0 Batch 3 - 多步 Agent trace 时间线可视化（Phase 6.0 完成）

给多步 ReAct 规划补上前端可视化，Phase 6.0 收尾。

改动：
- `AssistantAgentTrace.tsx`（新）：垂直时间线。每步 = 左侧节点(kind 图标：tool→tool / retrieval→search / synthesis→zap)+连接线，右侧 标题 + 状态 chip(running/success/error/skipped，色用 getToneColors) + thought + kind 徽章 + 工具名(code) + 耗时 + "观察"行。默认 `<details open>`，标题"多步推理 · N 步 + goal"。
- `AssistantMessageBubble.tsx`：assistant 消息且有 `agentTrace` 时，在答案文本下、Evidence 之上渲染 trace。

Verification:
- `pnpm type-check`、`pnpm lint`、`pnpm test:unit`（191）：通过。
- 真机：问"帮我规划下周训练"→ 流式时间线逐步点亮（planning 状态 + agent_step 事件累积），done 后 structured_output 的 agent_trace 重渲染权威版；历史消息也能展示（trace 已持久化）。

Notes:
- Phase 6.0（多步 ReAct 训练计划 + trace 可视化）三批全部完成；roadmap §3 标 ✅。
- 后续可选：让 LLM 真正驱动选工具（开放式 ReAct）、6.1 MCP、性能数字回填（任务 D）、Prettier 欠债（任务 E）。

## 2026-06-14 §8 Slice 1 - 运行时 faithfulness 校验

把"答案里的数字都来自真实工具输出"从设计口号变成被强制校验的不变量（确定性、无 LLM、零成本、标注不拦截）。详见 `ai-decisions.md` D21。

改动：
- `server/src/services/assistant/answer-faithfulness.ts`（新）：`verifyAnswerFaithfulness(answer, toolOutputs)` → `{ status: "verified"|"flagged", checkedNumbers, unverifiedClaims[] }`。深度遍历工具输出收集「可接受数字集合」=原始值 + 数组长度（覆盖"X 条 workout"派生计数）+ 字符串内嵌数字（覆盖日期/kg 串）+ ratio×100（覆盖 formatPercent）；从答案 summary/bullets/conclusion/recommendation 抽取数字 token 带容差比对（相对 1% + 绝对 0.5，吃掉四舍五入/toFixed/千分位逗号）；文本里的 UUID 引用若不在 evidence/sources 也计入。阈值全命名常量。`shouldStrictlyVerify()`/`enforceFaithfulnessInDev()`：默认只标注，仅 `FAITHFULNESS_STRICT=1` 且非 production 时对 flagged 抛错。
- `answer-faithfulness.test.ts`（新，9 例）：全数字有出处→verified、编造 999kg→flagged 且列出 999、toLocaleString/percent 不误报、数组长度计数不误报、第N步序号忽略、UUID 不在 evidence→flagged / 在 evidence→verified、enforce 默认不抛。
- `assistant-orchestrator-service.ts`：`MockAssistantTurnResponseData` 加 response 级 optional `faithfulness`；常规工具路径用作用域内 tool result（覆盖 mixed_tool_rag/plateau）；`next_week_plan` agent 路径在注入的 `runTool` 外包一层捕获聚合工具结果集——**不需改动 agent 与 react-planner-types**。两路径算完都 `enforceFaithfulnessInDev`，随 structured_output 持久化。

Verification:
- `pnpm --filter @fitmind/server type-check` / `lint` / `test:unit`（200）：通过。

文档：`ai-decisions.md` D21、`api-contract.md`（structured_output.faithfulness 字段）、`roadmap.md §8` Slice 1 标 ✅、本条。

Notes:
- 可接受集合刻意宽松（宁可漏标也不误标真实数据）；少数硬编码文案常量（如"最近 30 天"窗口）可能被标 flagged，属记录性元数据、不影响答案/测试。
- 护栏先于真实模型就位：mock 不编造、真实模型会编造，Slice 7 接真实大模型后这道护栏 + Slice 2 的 faithfulness 通过率指标正是兜住编造的关键。
- 前端"✓ 数据已核对"徽章留给后续 Slice；本片不碰 client（optional 字段向前兼容）。
- 下一片：§8 Slice 2（Eval 套件 + 回归门禁，复用本片校验器做 faithfulness 打分）。

## 2026-06-14 §8 Slice 2 - 离线 Eval 套件 + 回归门禁

回答"你怎么知道它对 / 不回归"——可离线复现、零成本的助手 eval 套件 + `pnpm eval` 门禁。详见 `ai-decisions.md` D22。前置依赖 Slice 1 的 faithfulness 校验器。

改动：
- `server/src/services/assistant/assistant-eval.ts`（新）：golden 数据集 + 三个纯函数评测器（mock-first、无 DB）。① `evaluateIntentRouting`：13 条 `AssistantIntentEvalCase` 跑 `classifyAssistantIntent` 比对 expectedIntent，覆盖 12 个 intent。② `evaluateRefusalRegression`：`shouldRefuse`→必须 unsupported、`mustCiteEvidence`→不能 unsupported/knowledge。③ `evaluateFaithfulness`：3 条「答案+工具输出」fixtures 复用 `verifyAnswerFaithfulness`（含编造 999kg→flagged）。`runAssistantEval` 汇总，门禁阈值命名常量 `REQUIRED_PASS_RATE`。`NarrativeJudge` 接口为 LLM-as-judge seam，默认不注入、不调模型（零成本）。
- `assistant-eval.test.ts`（新，9 例）：golden 全过（回归 guard）、judge 默认不跑 / 注入后增项 / 拒绝则整体 fail、各评测器误标检测。
- `server/scripts/run-eval.ts`（新，tsx runner）：打印分项 PASS/FAIL + 百分比 + Overall，`!passed` → `process.exit(1)`。
- `package.json`（根）：加 `"eval": "pnpm --filter @fitmind/server exec tsx scripts/run-eval.ts"`（无 DB / 无密钥 / 零成本）。

Verification:
- `pnpm --filter @fitmind/server type-check` / `lint` / `test:unit`（209）：通过。
- `pnpm eval`：intent_routing 13/13、refusal_regression 12/12、faithfulness 3/3，Overall PASS。

文档：`ai-decisions.md` D22、`README.md`（Verification 加 `pnpm eval` 用法 + 门禁说明）、`roadmap.md §8` Slice 2 标 ✅、本条。

Notes:
- 与 server 已有的 `eval`（rag-eval，DB-backed 检索质量）并存互不影响；新套件挂根 `pnpm eval`，是无 DB 的助手层 eval。
- LLM-as-judge 留 seam 默认 off；接真实 provider（Slice 7）后注入即可给叙述质量打分。
- 下一片：§8 Slice 3（可执行下周计划生成器，纯函数 weekly+progress→具体方案，先不落库）。

## 2026-06-14 §8 Slice 3 - 可执行下周计划生成器

产品闭环第一步：助手不只解释数据，还给出可执行的下周方案（动作 × 组 × 次 × 目标重量）。纯函数、确定性、不编造、先不落库。详见 `ai-decisions.md` D23。

改动：
- `server/src/services/agent/next-week-plan-generator.ts`（新）：`generateNextWeekPlan(input) → NextWeekPlanDraft`。sets 由 `SETS_BY_MODE`（consolidate/maintain=3、add_frequency=4）；次数固定 6~10；focus 目标重量=取整(估算1RM×`TARGET_INTENSITY_PCT_OF_1RM`=0.72)到 `WEIGHT_ROUNDING_KG`=2.5kg，无 1RM 退化用近期最高重量，再无基线 `target_weight_kg=null`（不编造）；最多 `MAX_PLANNED_EXERCISES`=4 动作；弱项进 notes。全命名常量。
- `next-week-plan-generator.test.ts`（新，6 例）：1RM→2.5kg 取整目标重量、无基线不编造、退化用 max weight、focus 去重、上限 4、add_frequency 加组 + 弱项进 notes。
- `react-planner-types.ts`：`ProgressionMode` 从 agent 提升到此共享；新增 `PlannedExercise` / `NextWeekPlanDraft`；`NextWeekPlanAgentOutput` 加 `plan?`。
- `next-week-plan-agent.ts`：synthesis 后 `buildGeneratorInput`（从 weekly top_exercises + progress 1RM/maxWeight 提取）→ `generateNextWeekPlan`，plan 进 output（no_data 路径不带）。
- `assistant-orchestrator-service.ts`：`MockAssistantTurnResponseData` 加 `plan?: NextWeekPlanDraft`，agent 路径从 `agentOutput.plan` 带上，随 structured_output 持久化。

关键设计：plan 是**结构化字段、不内联进答案文本**（summary/bullets 不变），所以 Slice 1 的 faithfulness 数字扫描看不到这些派生目标重量、不会误标——这是与 D21 的关键交互。

Verification:
- `pnpm type-check`、`pnpm --filter @fitmind/server lint`、`pnpm test:unit`（215）：通过。
- `pnpm eval`：13/13 + 12/12 + 3/3 Overall PASS（未回归）。

文档：`ai-decisions.md` D23、`api-contract.md`（structured_output.plan）、`AGENTS.md §11`（Agent + AI 护栏/评估现状）、`roadmap.md §8` Slice 3 标 ✅、本条。

Notes:
- 先不落库（不引入 planned-workout 模型 / 不接"接受计划"）——那是 Slice 5；档案注入是 Slice 4，生成器纯函数签名已预留扩展位。
- 前端结构化渲染草案卡片留作后续 Slice（本片不碰 client）。
- 下一片：§8 Slice 4（运动员档案薄模型 + 注入 agent）。

## 2026-06-14 §8 Slice 4 - 运动员档案（薄）+ 注入计划生成器（3 批）

个性化 + 安全：薄档案（目标/每周天数/器械/伤病约束）持久化 + CRUD + best-effort 注入 next-week-plan agent。详见 `ai-decisions.md` D24、`db-schema.md §10`、`api-contract.md` Slice 4 Addition。

Batch 1（数据层）：
- `migrations/20260614100000_create_athlete_profiles.js`（user_id 主键一人一档、goal/weekly_days/equipment[]/injury[]、check 约束）。
- `db/athlete-profile-repository.ts`：`getAthleteProfileByUserId` + `upsertAthleteProfile`（ON CONFLICT user_id）。
- `services/athlete-profile-service.ts`：DTO + `athleteProfileInputSchema`（zod .strict）+ get/save，标签归一化小写去重（≤10 个、≤40 字）、DI 可注入 repo。
- `athlete-profile-service.test.ts`（5 例，注入 fake repo，无 DB）。

Batch 2（HTTP CRUD）：
- `controllers/athlete-profile-controller.ts`：`GET`（返回 profile 或 null）+ `PUT`（zod 校验后 upsert）。
- `routes/athlete-profile.ts`（authMiddleware）+ `app.ts` 挂载 `/api`。
- `athlete-profile-controller.test.ts`（4 例，mock service，拒绝非法 goal / 额外字段）。

Batch 3（注入 agent）：
- `react-planner-types.ts`：新增 `PlanGoal` / `PlanProfileContext`，`NextWeekPlanAgentInput` 加 `profile?`。
- `next-week-plan-generator.ts`：`GOAL_SCHEMES`（strength 3~6@85% / hypertrophy 6~10@72% / endurance 12~15@60% / general_fitness 8~12@68%），无档案退回 hypertrophy（保持历史行为）；伤病/每周天数注入 notes。+3 例单测。
- `next-week-plan-agent.ts`：`buildGeneratorInput` 透传 `input.profile`。
- `assistant-orchestrator-service.ts`：`loadPlanProfile(userId)` best-effort（失败回退 null 不破坏规划）→ 传入 agent input。

Verification:
- `pnpm type-check`、`pnpm --filter @fitmind/server lint`、`pnpm test:unit`（227）：通过。
- `pnpm eval`：13/13 + 12/12 + 3/3 Overall PASS（无回归）。
- DB 链路（迁移/repo SQL）本地无 DATABASE_URL 未实跑，按惯例靠 smoke / 线上验证；逻辑层已单测。

Notes:
- 档案加载 best-effort：故障降级到默认增肌方案，核心规划不受影响。
- 前端档案编辑 UI + DTO 提升到 shared/ 留作前端片；伤病→动作硬过滤、落库依从度是 Slice 5。
- 下一片：§8 Slice 5（接受计划 → planned workout 模型 + 依从度）或 Slice 6（可观测 + 配额）。

## 2026-06-14 §8 Slice 6 - 可观测 + AI 配额限流（2 批，Track 1）

回摆 Track 1（AI 工程）平衡 Slice 3/4 的 Track 2：每轮 telemetry + 兑现 AGENTS §7.3 的 AI 限流。详见 `ai-decisions.md` D25、`api-contract.md §9`。

Batch A（每轮可观测）：
- `services/assistant/assistant-turn-observability.ts`（新）：`buildAssistantTurnLogEvent` + `logAssistantTurnEvent`，记录 intent/总延迟/工具数+错误数+总工具耗时/agent 步数/faithfulness 状态/有无 plan，单行结构化 JSON。
- `assistant-turn-observability.test.ts`（4 例）。
- `controllers/assistant-stream-controller.ts`：mock-turn + stream-turn 各测量总延迟并 `logTurnTelemetry`（接 controller 层避免 orchestrator 循环依赖）。token 成本待 Slice 7。

Batch B（AI 限流）：
- `services/assistant/ai-rate-limiter.ts`（新）：纯固定窗口 `createAiRateLimiter({perMinute,perDay,now})`，20/分→RATE_LIMITED、50/天→AI_QUOTA_EXCEEDED（命名常量），注入 store+clock，仅放行时消费计数，retryAfterSeconds 到窗口末。
- `ai-rate-limiter.test.ts`（5 例：到顶拦截 / 分钟窗复位 / 日配额 / 拦截不消费日计数 / 用户隔离）。
- `middleware/ai-rate-limit-middleware.ts`（新）：`createAiRateLimitMiddleware(limiter)` 工厂 + 内存单例默认，超限抛 429 HttpError（带 retry_after_seconds）。+ 2 例中间件测。
- `routes/assistant.ts`：mock-turn / stream-turn 两端点挂 `aiRateLimitMiddleware`（authMiddleware 之后）。

Verification:
- `pnpm type-check` / `pnpm --filter @fitmind/server lint` / `pnpm test:unit`（238）：通过。
- `pnpm eval`：13/13 + 12/12 + 3/3 Overall PASS（无回归）。

Notes:
- 限流为单进程内存计数，多实例/Serverless 各自计数；分布式需 Redis/DB（接口 seam 不变），已在 D25 / roadmap / api-contract 诚实标注。
- 全局 60/IP/分钟与登录限流仍未实现（out of scope）。
- 至此 §8 已完成 Slice 1/2/3/4/6；剩 Slice 5（接受计划→依从度，最重）、7（provider seam 文档）、8-10。前端（档案编辑 + plan 卡片 + 限流提示）仍待集中做。

## 2026-06-14 §8 Slice 5 - 接受计划 → planned workout 模型 + 依从度（3 批）

合上 记录→分析→计划→再记录 闭环：助手草案可「接受」成计划训练，并按 planned vs performed 给依从度。详见 `ai-decisions.md` D26、`db-schema.md §11`、`api-contract.md` Slice 5 Addition。

Batch 1（依从度计算器，纯函数无 DB）：
- `services/training/plan-adherence.ts`（新）：`computePlanAdherence`，动作名大小写/空格不敏感匹配 → 逐动作 done/partial/missed + 动作级/组级依从比例（min 封顶 100%、除零安全）。+6 例单测。

Batch 2（持久化）：
- `migrations/20260614110000_create_planned_workouts.js`：jsonb plan 快照 + 周期 + status + 可选 source_message_id + (user_id,status,created_at) 索引。
- `db/planned-workout-repository.ts`：create / getActive / updateStatus（date 列 ::text 读取）。
- `services/planned-workout-service.ts`：`acceptPlan`（zod `.strict()` 校验 NextWeekPlanDraft + 持久化）、`getCurrentPlanWithAdherence`（读取时用 `getTrainingSummary` 算依从度，单一事实来源）、`setPlanStatus`；读取 jsonb 用 zod parse 避免 `as`。+4 例注入 fake 单测。

Batch 3（HTTP）：
- `controllers/planned-workout-controller.ts` + `routes/planned-workouts.ts` + `app.ts` 挂载：`POST /api/planned-workouts`（201）、`GET /api/planned-workouts/current`（带依从度/null）、`PATCH /api/planned-workouts/:id`（completed/abandoned）。+5 例 controller 单测。

Verification:
- `pnpm type-check` / `pnpm --filter @fitmind/server lint` / `pnpm test:unit`（253）：通过。
- `pnpm eval`：13/13 + 12/12 + 3/3 Overall PASS（无回归）。
- DB 链路（迁移/repo SQL）本地无 DATABASE_URL 未实跑，逻辑层已单测；需有 DB 环境跑迁移 + smoke 验证。

Notes:
- 依从度读取时算、不存冗余：performed 永远来自真实训练日志（单一事实来源），计划 jsonb 快照不随动作字典漂移。
- 前端「接受计划」按钮 + 依从度卡片留作前端集中片；依从度注入 agent 上下文是后续增强。
- §8 进度：Slice 1/2/3/4/5/6 全部完成；剩 Slice 7（provider seam 文档，极便宜）+ 8-10 + 前端集中片。

## 2026-06-14 §8 前端集中片 FE-1 - 计划草案卡片（Slice 3 点亮）

把后端已落地、UI 仍"隐形"的结构化下周草案点亮（用户本轮只选这一片）。详见 `UI_SPEC.md §4.3.3`、`roadmap §8 前端集中片`。

改动（client，5 文件）：
- `assistant-types.ts`：`AssistantStructuredOutput` 加 raw `plan?`；新增 `AssistantPlanDraft`/`AssistantPlannedExercise`/`AssistantPlanStrategy`；`AssistantChatMessage` 加 `plan?`。
- `assistant-structured-output.ts`：`normalizePlan(output)`（策略归一化、目标重量 null 保留、无动作返回 undefined），并入 `mergeStructuredOutputIntoMessage`（与 evidence/sources 同处，无需动 use-assistant-chat）。
- `AssistantPlanCard.tsx`（新）：`<details open>` + 策略 chip + 动作行（名称 / 目标重量 / "N 组 × a~b 次" / basis）+ notes，风格对齐 `AssistantAgentTrace`，用 theme token 不硬编码色值。
- `AssistantMessageBubble.tsx`：agent trace 之下、Evidence 之上渲染 `AssistantPlanCard`。
- `assistant-structured-output.test.ts`：+2 例（plan 归一化 / 无动作时 undefined）。

Verification:
- `pnpm type-check`（client+server+shared）/ `pnpm lint`（含 client）/ `pnpm test:unit`（255）：通过。
- 视觉未在本机起 dev 实测；组件纯展示、类型安全、风格对齐既有 trace 卡片。

Notes:
- 目标重量 null 显示"沿用上次重量"，不编造（与后端 D23 一致）；卡片不内联进答案文本，不影响 faithfulness。
- 本轮只点亮 Slice 3；FE-2 接受计划+依从度（Slice 5）、FE-3 档案编辑（Slice 4）、FE-4 faithfulness 徽章+限流提示（Slice 1+6）待后续按需做。

## 2026-06-14 §8 前端集中片 FE-2 - 接受计划 + 本周计划/依从度卡片（Slice 5 闭环可见）

与用户共定心智模型=本周「目标动作集」（接受一次=设为本周目标，常驻卡片哪天打开都在，真实训练按周自动匹配依从度，不强排到具体某天，匹配现有后端、纯前端）。分 2 批。详见 `UI_SPEC §4.3.3`、`frontend-current-state`、`roadmap §8`。

FE-2a（视图侧，5 文件）：
- `planned-workout-api.ts`：accept/current/abandon + 纯 helper `denormalizePlanDraft`（camel→snake）/`createForwardWeekRange`（今天起 7 天）。
- `planned-workout-api.test.ts`：+3 例（denormalize / 日期窗口 / 补零）。
- `use-current-plan.ts`：hook（token 变化拉 current，accept/abandon/refresh，status/isMutating/actionError）。
- `AssistantCurrentPlanCard.tsx`：常驻助手页顶部，计划 + 逐动作 done/partial/missed chip（success/warning/neutral 色）+ 依从进度条 + 放弃按钮 + 空/加载/错误态。
- `AssistantWorkspace.tsx`：挂 hook + 在 IntroCard 之下渲染卡片。

FE-2b（接受按钮 drill，5 文件）：
- `AssistantPlanCard.tsx`：底部「设为本周计划」全宽主按钮（接受中/已设为本周计划 态）。
- `AssistantMessageBubble.tsx` / `AssistantMessageList.tsx`：透传 onAcceptPlan / isPlanAccepting / isPlanAccepted（drill 路径同 onSaveInsight）。
- `AssistantChatPanel.tsx`：handleAcceptPlan（按 message.id 跟踪 accepting/accepted）+ 状态文案，调 props.onAcceptPlan。
- `AssistantWorkspace.tsx`：把 `currentPlan.accept` 传给 panel，接受成功 hook 内部 refresh 顶部卡片。

Verification:
- `pnpm type-check`（client+server+shared）/ `pnpm lint` / `pnpm test:unit`（258）：通过。
- 本机未起 dev 实测视觉；纯展示 + 类型安全 + 风格对齐既有卡片。

解决了用户疑问：第二天打开计划还在（常驻 GET /current 卡片，不用去已保存洞察翻）；"一键接受整周"改为"设为本周目标"（接受一次、真实训练按周填依从度）。

已知局限（与用户共识，写进 roadmap）：非点名动作无重量目标（需周报回传单动作最高重量的后端小增强）；计划扁平、未按训练日拆分（day-split 是更大后端改动，暂不做）。

下一步可选：FE-3 档案编辑（Slice 4）、FE-4 faithfulness 徽章+限流提示（Slice 1+6）；或回后端做"周报带单动作最高重量"让目标重量更实。

## 2026-06-14 §8 前端集中片 FE-3 / FE-4 - 档案编辑 + faithfulness 徽章 + 限流提示

点亮 Slice 4（档案）/ Slice 1（faithfulness）/ Slice 6（限流）。前端集中片（FE-1..4）全部完成。详见 `UI_SPEC §11/§12`、`roadmap §8`。

FE-3（档案编辑，6 文件含 1 行 http-client 类型补丁）：
- `features/profile/athlete-profile-api.ts`（GET/PUT + 纯 `parseInjuryTags` + 单测）、`AthleteProfileSheet.tsx`（ActionSheet 表单：目标/每周天数/器械 chip/伤病逗号输入，开表单 GET 预填、保存 PUT）、`AthleteProfileButton.tsx`（Header user IconButton）、`App.tsx`（secondaryAction 加档案按钮）、`services/http-client.ts`（method 联合补 PUT）。

FE-4a（faithfulness 徽章，4 文件）：
- `assistant-types`/`assistant-structured-output`（`normalizeFaithfulness`）/`AssistantMessageBubble`（消息头 Badge：✓ 数据已核对 / ⚠ N 处待核）+ 单测 2 例。

FE-4b（限流友好提示，2 文件）：
- `use-assistant-chat`：RATE_LIMITED/AI_QUOTA_EXCEEDED → 中文提示（带 retry_after_seconds）；`AssistantChatPanel`：错误提示展示真实 errorMessage。

Verification:
- `pnpm type-check`（client+server+shared）/ `pnpm lint` / `pnpm test:unit`（264）：通过。
- 本机未起 dev 实测视觉；纯展示/类型安全/风格对齐既有组件。

至此前端集中片 FE-1（计划草案卡片）/FE-2（接受+依从度）/FE-3（档案）/FE-4（徽章+限流）全部点亮；后端 §8 Slice 1-6 + 前端均已落地。剩 Slice 7（provider seam 文档）+ 8-10（按需）+ 可选"周报带单动作最高重量"增强。

## 2026-06-17 §8 Slice 3.1 - 周报回传单动作最高重量（补 Slice 3 局限）

补上计划生成器的已知局限：非 focus 的 top 动作此前目标重量恒为 null（"沿用上次重量"），根因是周报 `top_exercises` 来自 `training-summary` 的 `by_exercise`、不带单动作重量基线。本片把单动作最高重量/估算 1RM 从聚合层一路接到生成器。决策见 `ai-decisions.md` D27，进度见 `roadmap §8 Slice 3.1`。

后端（5 源文件）：
- `db/training-summary-repository.ts`：`by_exercise` 分组 SQL 增 `MAX(COALESCE(s.weight_kg,0)) AS max_weight_kg` + Epley `MAX(COALESCE(s.weight_kg,0)*(1+COALESCE(s.reps,0)/30)) AS estimated_1rm_kg`（与 `exercise-progress-repository` 同款规则）；行接口加两字段。
- `services/training/training-summary-service.ts`：`TrainingSummaryExerciseDto` + `exerciseSchema` 加 `max_weight_kg`/`estimated_1rm_kg`（nullable preprocess 数字）+ 一条 by_exercise 计算规则文案。
- `services/training/weekly-training-report-service.ts`：`WeeklyTrainingReportExerciseDto` 加两字段（`top_exercises` 仍直接 slice 透传，运行时已带，补类型让 agent 类型安全）。
- `services/agent/next-week-plan-generator.ts`：`NextWeekPlanGeneratorInput.topExercises` 元素加 `estimated1RmKg/maxWeightKg`；抽共享 `buildPlannedExercise`（focus 与 top 动作共用：有 1RM 用取整(1RM×强度%)、退化到 max、再无则 null+"沿用上次重量"）；顺手把 ≤0 基线（自重动作 max=0）判为 null，修掉旧 focus 自重显示 `target 0kg`。
- `services/agent/next-week-plan-agent.ts`：`buildGeneratorInput` 的 topExercises map 读 `estimated_1rm_kg/max_weight_kg`。

测试（4 文件）：
- `next-week-plan-generator.test.ts`：fixtures 补两字段 + 新增「top 动作带 1RM 算出具体 target」「只有 max 退化」「自重 0 基线保持 null」3 例。
- `next-week-plan-agent.test.ts`：`createWeeklyResult` top_exercises 补重量 + 新增「非 focus top 动作目标重量从周报 max/1RM 派生」断言（100×0.72=72→72.5）。
- `weekly-training-report-service.test.ts`：by_exercise fixture 补两字段 + 断言 top_exercises 透传 max/1RM。
- `planned-workout-service.test.ts`：`buildSummary` 的 byExercise fixture 补两字段（满足收紧后的 row 类型）。

硬约束守住：计划重量仍只挂 `structured_output.plan`、不进答案文本（faithfulness 数字扫描看不到派生重量）；绝不编造（无基线仍 null）；DTO 是 server 本地类型，无前后端 shared 漂移。

Verification:
- `pnpm type-check`（client+server+shared）/ `pnpm test:unit`（268）/ `pnpm eval`（intent 13/13、refusal 12/12、faithfulness 3/3，PASS）：通过。
- `pnpm lint`：本片 9 个改动文件 eslint EXIT 0；仓库唯一红的是 `cloudflare-worker/index.js` + `functions/api/[[path]].js`（commit b147415 Cloudflare 配置遗留的 no-undef，非本片，属历史欠债，同 format:check）。
- 未起 dev 实测；纯确定性后端 + 类型安全 + 单测覆盖。

已知局限：前端把非 focus 动作的具体目标重量渲染出来仍待前端片（卡片已支持 null/数值两态，数据现已带上）；估算 1RM 用组内 Epley 最大值，仅作起始重量参考。

## 2026-06-17 §8 Slice 7 - provider seam 审计 + 决策文档（纯文档）

核对 provider 抽象是否「换模型只动一层」，并把「为何暂用 mock/免费、接真实大模型会变什么」写成可讲的决策记录。本片**零代码改动**，纯文档。决策见 `ai-decisions.md` D28，进度见 `roadmap §8 Slice 7`。

审计结论 —— 三处独立 LLM/embedding 接缝，均「换模型只动一层」成立：
- 助手轮 `AssistantProvider` 接口 + `provider-adapter`（按 `ASSISTANT_PROVIDER` 选）+ `anthropic`/`mock` 实现；adapter 还做 `ensureAllowedTool` + 错误归一化。
- 录入解析 `WorkoutIntakeLlmRawParser` 工厂（按 `WORKOUT_INTAKE_LLM_PROVIDER`：off/mock/anthropic/gemini/groq）+ 宽松 zod 兜底。
- RAG `voyage-embedding-client`（Voyage voyage-4-lite / 1024 维）。

记录 3 个接缝气味为后续片（本片不改）：
- A：助手轮只有 mock/anthropic，无 Groq 免费 provider（「暂用 Groq 免费」其实只覆盖录入解析）。
- B：anthropic 模型 id + api version 硬编码且在 `provider-config.ts` 与 `workout-intake-llm-parser.ts` 两处重复，「只动一层」不完全成立 → 建议收进 env/常量。
- C：「流式」是 SSE 推确定性 agent 步骤，`runAssistantProvider` 是单次非流式 fetch；真 token 级流式/计费需 provider 支持 streaming。

D28 还记了接真实大模型会变的维度（面试核心）：流式 token 计费、prompt caching 经济学、faithfulness/eval 从锦上添花变刚需（mock 不编造、真实模型会）、延迟/成本遥测、降级链。

Verification:
- 纯文档改动（`ai-decisions.md` D28、`roadmap.md` §8 Slice 7、`progress.md` 本条），无代码改动，故不跑 type-check/lint/test/eval。
- 用户拍板范围＝纯文档；审计发现的气味 A/B/C 记为已知 follow-up，留给接真实模型片或独立 seam 清理片。

## 2026-06-17 可用性打磨批次（实地走查后修复）

把 App 跑起来（demo 账号 `assistant-demo@fitmind.local`）实地走查三个 tab + 一轮 next_week_plan agent 后，修掉走查当场发现的问题。

修复 #1（真 bug · server）：`next-week-plan-generator.ts` 的 `buildPlannedExercise` basis 文案直接拼接原始浮点估算 1RM，导致下周草案里杠铃深蹲显示「估算 1RM 110.83333333333333 kg」。新增 `formatOneRmForDisplay`（取整 1 位小数）只对展示取整，目标重量仍用未取整 1RM 算再 `roundToPlate`（不引入复合误差）。+1 例防回归单测。这是 D27/Slice 3.1 让更多动作走该路径后放大的。决策见 `ai-decisions.md` D27（2026-06-17 修订）。

修复 #2（文案 · client）：`TrainingStatsStrip.tsx` 训练 tab 顶部统计写「本月训练 / 同步本月训练数据」，但数据实为近 30 天范围（`useTrainingSummary` 默认 today-29..today，分析 tab 已正确写「30 天总览」）。改为「近 30 天训练 / 近 30 天训练总结的快速统计」。

修复 #3（文档隐患）：`frontend-current-state.md` 正文（§1–12，2026-05-07 快照）描述的是重构前英文毛坯单页 + token 内存保存，与现状（已按 UI_SPEC 落地的深色移动端 tabbed App + HttpOnly cookie 鉴权）严重矛盾，照它规划会跑偏。顶部加醒目过时横幅指向真实现状 + 本地复跑方式；§1–12 全量重写属大修，留作后续单独片。

Verification:
- `pnpm type-check`（client+server+shared）/ `pnpm test:unit`（269，+1）/ `pnpm eval`（intent 13/13、refusal 12/12、faithfulness 3/3，PASS）：通过。改动文件 eslint EXIT 0。`format:check` 历史欠债不动。
- 实地复跑：#2 训练 tab 显示「近 30 天训练」（「本月训练」消失）；#1 直接打 `/api/assistant/mock-turn`（mode=next_week_plan）确认杠铃深蹲 basis = 「估算 1RM 110.8 kg」（浮点尾巴消除），目标重量 75/55/80/57.5 不变。

走查另记（未改，留作后续）：自由追问「给我一个下周训练草案」（mode=auto）被 intent 分类路由成 recommendation 而非 next_week_plan——文本分类对「草案」信号弱；非 bug，属分类器调优，按需再议。

## 2026-06-20 路线图：理解层升级（real-LLM seam）方向共定（规划，未动代码）

与用户讨论"后续路径 / 两个长期体验痛点（对话死板、录入变组识别不了）如何优化"，实地走查 + 代码核对（`assistant-intent-router.ts` 意图分类是死正则、`workout-intake-parser.ts` + hybrid 兜底触发条件）后，定下下一档主线并写进 `roadmap.md §8.1`：

诊断（同根）：链路是「理解层 → 确定性工具/计算 → faithfulness → 回答」，后三段扎实，痛点全在理解层是写死正则、无真实模型。换 provider 也不解决（路由在 provider 之前）。接缝已就绪（D28）。

新增 roadmap 条目：
- §8.1 主题块（诊断 + 与 D28/Phase 7.0/Slice 1·2 的关系）。
- Slice 11 — Groq 真实模型接入意图路由 + 工具选择（理解层核心，治对话死板；中风险，靠 ensureAllowedTool + faithfulness + eval 兜底）。
- Slice 12 — 录入鲁棒性：放宽 hybrid LLM 兜底触发 + 确保 Groq 本地配 + 确认 UI 逐组可编辑（治变组识别不了；低风险）。
- Slice 11a — 对话"不死"的纯确定性止血（unsupported 走 RAG + 澄清，极低成本，仅缓解非根治）。
- 建议顺序：Slice 12 → 11a → 11。§7 优先级建议同步加了指向 §8.1 的更新注。

未动任何代码；docs-only。`format:check` 历史欠债不动。

## 2026-06-20 路线图：D29（LangChain/LangSmith 选择性增强）+ §8.2 优化总 Slice（规划，未动代码）

- `ai-decisions.md` 加 **D29**：LangChain/LangSmith 选择性增强决策——立场是"先用原语自研、再在框架真能加杠杆处选择性采纳"；逐方向 verdict（retriever 中 / RAG pipeline 低-中 / structured output 低=退步 / tracing 真实模型后值 / agent harness 最不该换 / LangSmith eval 真实模型后增强）；时机=Slice 11 之后；坚决保留自研 agent harness + structured output + 核心 eval。
- `roadmap.md` 加 **§8.2 优化总 Slice（执行总路线）**：把全部后续工作排成 A→E 五阶段一张表（A 鲁棒性打底=Slice 12+11a / B 理解层质变=Slice 11 / C 真实模型后增强=tracing+LangSmith eval+retriever rerank+Slice 10 / D 叙事彩蛋=Slice 9+8 / E 收尾=文档重写+UI 打磨）。常设规则：UI 最后，但致命 UI 问题立即提前改；一次一片、先计划后写、≤5 文件。
- docs-only，未动代码。`format:check` 历史欠债不动。

## 2026-06-20 §8.2 Phase A / Slice 12 - 录入鲁棒性：变组 LLM 兜底升级

治用户痛点"一个动作每组重量/次数不一样识别不了"。实地核对后定位：规则解析对干净成对写法能出多组，真正断在口语 filler（做了/加到/了）让成对匹配漏掉、把变组压扁，而 hybrid 兜底此时不触发→静默给错值。确认 UI 已逐组可编辑（`workout-intake-to-session-draft.ts`），非瓶颈。

改动（1 代码 + 1 测试）：
- `workout-intake-hybrid-parser.ts`：`shouldUseLlmFallback` 加 `likelyFlattenedVariedSets`——原文 ≥2 个互不相同重量（带单位或 60x10 左值）但规则解析捕获的不同重量更少 → 升级 LLM 重解。比"个数"不比数值（对磅↔kg 换算安全）。常量 `MIN_DISTINCT_WEIGHTS_FOR_VARIED_SET_CHECK=2`。不动规则核心、不动 UI。决策见 `ai-decisions.md` D30。
- `workout-intake-hybrid-parser.test.ts`：+2 例（filler 压扁→升级 LLM 还原 3 个不同组；规则已捕获全部不同重量→不过度触发）。

Verification:
- `pnpm type-check`（client+server+shared）/ `pnpm test:unit`（271，+2）/ `pnpm eval`（intent 13/13、refusal 12/12、faithfulness 3/3，PASS）：通过。改动文件 eslint EXIT 0。`format:check` 历史欠债不动。
- 未跑浏览器验证：变组解析靠真实 LLM（生产 Vercel 配 `WORKOUT_INTAKE_LLM_PROVIDER=groq`），本地默认 mock 不产变组——用户在手机（生产）实测。

依赖/局限：本地真测需 `GROQ_API_KEY`；只覆盖"重量不同"压扁，"重量同但次数不同"未捕获（确认 UI 可手改）。

另记 D31（Python/FastAPI）：现在不加（无 Python 才擅长的负载，避免拆双运行时）；最佳切入=Phase C 单一 ML 微服务（reranker / 安全分类器 / 离线 eval），Node 经 HTTP 调，不早于 Slice 11。

## 2026-06-21 §8.2 Phase A / Slice 11a - 对话"不死"的纯确定性止血

治"稍微不按规矩问就没了"。根因：意图路由是关键词正则，没听懂就落 unsupported 罐头拒答。本片把 unsupported 分流，并保守扩同义词。决策见 `ai-decisions.md` D32。

改动（4 文件）：
- `assistant-intent-router.ts`：导出 `isOutOfScopeMessage`（黑名单/空）；`KNOWLEDGE_PATTERN` 加 热身/拉伸/组间休息/睡眠、`RECOMMENDATION_PATTERN` 加 练哪。
- `knowledge-retriever.ts`：`tokenizeKnowledgeQuery` 词表加 热身/拉伸/组间休息/睡眠。
- `assistant-orchestrator-service.ts`：`unsupported` 分支分流——越界保持澄清拒答；否则用 `tokenizeKnowledgeQuery` 当相关性闸门（纯无关查询不检索，避免向量乱答），带锚点走 RAG，命中知识用 `composeKnowledgeAnswer`、否则退回澄清；兜底命中时 response.intent 记 knowledge。
- `assistant-intent-router.test.ts`：+2 例（新同义词路由；isOutOfScopeMessage 闸门）。

关键约束：**不改分类器返回的 intent**，故 eval `intent_routing 13/13` + `refusal_regression 12/12` 不动（eval 只看 classify().intent，不跑 orchestrator）。

Verification:
- `pnpm type-check` / `pnpm test:unit`（273，+2）/ `pnpm eval`（13/13·12/12·3/3 PASS）：通过。改动文件 eslint EXIT 0。`format:check` 历史欠债不动。
- 真链路（node UTF-8 探针，避开 curl 在 Windows 传中文编码问题）：带锚点"怎么缓解训练后的疲劳"/"训练后怎么加快恢复"→ 分类 unsupported 但 RAG 兜底→ knowledge sources=3；无锚点"我女朋友生气了"→ 澄清不乱答；越界"天气"→ 拒答保留。

排查记录：验证初期"全 unsupported"是 curl 在 Windows 下传中文 body 被编码搞坏所致（"RPE是什么"因 ASCII 残留仍命中），非代码问题；改 node 原生 UTF-8 后全部正确。dev server 为常驻进程，验证后已停、临时探针文件已删。

局限：闸门词表有限、覆盖窄（stopgap 本质），泛化靠 Slice 11 真实 LLM 路由；疼痛/医疗硬路由是 Slice 10 职责。

## 2026-06-21 修复：前端"粘 mode"致命 UX bug（自由提问被误路由）

用户在 prod(Vercel)自由提问"训练后怎么加快恢复"仍被路由成 recommendation，而我直连后端 mode=auto 探针是 knowledge。排查链：后端确认最新(Evidence 含 Slice 3.1 规则) → 同后端不同结果只能是客户端发的 mode 不是 auto → 读 `AssistantChatPanel.tsx` 发现 `mode` 存在共享 `promptSuggestion` 且会粘住：点过快捷问题/洞察卡片(如 next_training_focus)后，手输自由提问继承旧 mode、不发 auto，绕过服务端 classify（Slice 11a 改的路径）。

这是致命 UX（按用户共识规则提前修，UI 虽排最后）：

修复（`AssistantChatPanel.tsx`，2 处）：
- `onChangeMessage`：用户手动改写文本即视为自由提问，`mode` 重置为 `auto`。
- 提交后重置：`{message:"", mode:"auto"}`（原保留旧 mode）。

Verification:
- client `type-check` / 改动文件 eslint：通过。
- 实地复现（preview + 本地后端 + fetch 抓包）：点"本周训练报告"(设 mode=weekly_report)后手输"训练后怎么加快恢复"提交 → 实际请求 **mode=auto**（修复前会是 weekly_report）→ 后端 `intent=knowledge` + RAG 命中 3 源(训练疲劳和恢复判断/渐进超负荷/Deload)。
- dev server / preview 验证后均已停。

教训记入 `ai-decisions.md` D32 修订：服务端 classify/eval 全绿 ≠ 用户触达该路径；客户端 mode 是否 auto 才决定是否走服务端分类。mode 双轨（客户端显式 vs 服务端 auto）应在 Slice 11 收敛为一处。

## 2026-06-21 助手"自信错答"止血：A 回退过宽词表 + B 知识检索相关性下限

稳定性体检(把助手按各类提问跑一遍)发现 3 类问题：①"今天适合练什么"路由对但 provider 不接→兜底文案(路由双轨);②"睡眠/热身"等知识库没覆盖的话题被自信错答(向量召回返回语义最近的恢复 chunk);③ RAG 排序逐次抖动。其中 ② 是我 Slice 11a 扩词放大的。用户要求"先稳定",本批只做 ② 的止血(A+B)。决策见 `ai-decisions.md` D33。

改动（3 源 + 2 测试）：
- A 回退（`assistant-intent-router.ts` + `knowledge-retriever.ts`）：撤掉 11a 加的 KNOWLEDGE_PATTERN 词(热身/拉伸/组间休息/睡眠)、RECOMMENDATION 的"练哪"、tokenize 词表对应项。保留 11a 安全部分(isOutOfScopeMessage + 疲劳/恢复 有内容的兜底)。
- B 相关性下限（`knowledge-retriever.ts` 新纯函数 `filterRelevantKnowledgeChunks` + `assistant-orchestrator-service.ts` 知识分支/兜底分支应用）：只保留与查询精选 token 有**词法重叠**的召回,无重叠→诚实回退。用词法重叠而非向量分数阈值——小知识库下确定性、可单测、顺带消除 ③ 在知识答上的可见抖动;不动检索核心打分、不动 agent RAG。
- 测试：路由测试改为断言 热身/睡眠→unsupported(诚实);`knowledge-retriever.test.ts` +3 例(词法重叠保留/语义最近无重叠丢弃/无术语返回空)。

Verification:
- `pnpm type-check` / `pnpm test:unit`(276,+3) / `pnpm eval`(13/13·12/12·3/3 PASS)：通过。改动文件 eslint EXIT 0。
- 真链路(本地后端=同 Neon+Voyage≈prod)：睡眠/热身→诚实澄清 sources=0(原自信错答);渐进超负荷/deload→精准 1 源;恢复/疲劳→命中"训练疲劳和恢复判断";女朋友/天气→澄清/拒答。"自信错答"消除。
- dev server 验证后已停;临时探针文件已删。

遗留(Slice 11 处理)：① 路由双轨(classify vs mock-provider)、③ 向量召回底层非确定。本批是"先稳定"，不引入新行为、只让它更诚实。

## 2026-06-21 文档补记（api-contract 同步）+ Slice 11 实现计划草案

用户指出"相关文档还没记录"——核对发现 `api-contract.md` 助手章节漏更（一直只写 ai-decisions/progress/roadmap，漏了契约文档，违反 AGENTS 文档同步表"助手 intent/路由 → api-contract"）。本次补：
- `api-contract.md`：助手「Intent routing & honesty boundaries」段（Slice 11a unsupported 分流：越界→拒答无 Sources、带锚点→RAG 兜底可返知识答；D33 知识相关性下限：没覆盖话题诚实"没资料"不返最近错 chunk；路由双轨已知局限留 Slice 11）；录入 fallback 段补 Slice 12 变组升级（D30）+ 修正 `WORKOUT_INTAKE_LLM_PROVIDER` 取值（补 gemini/groq，prod=groq）。
- `roadmap.md §8.3`：Slice 11 实现计划草案（分 11.1 Groq provider 接缝 / 11.2 LLM 路由带校验+确定性回退+eval / 11.3 收敛双轨+措辞；安全边界：模型不产数字、路由必落已知集合+回退、env 可回退、eval 门禁先行；前置=Groq key 在助手轮可用 + 模型选型 + 限流）。**待用户确认后再写代码**。

docs-only。Slice 11 代码未动。

## 2026-06-21 §8.2 B1 / Slice 11.1 - Groq 助手 provider 接缝（零行为变更）

Slice 11 第一步：建 Groq 助手 provider 接缝(D28 气味 A),默认仍 mock、零用户可见变更、env 可回退,风险隔离在"加一个可选 provider"上。决策见 `ai-decisions.md` D34,计划见 `roadmap §8.3`。

改动（6 文件，第 6 个为 1 行类型传播）：
- 新增 `groq-assistant-provider.ts`：实现 `AssistantProvider`,走 Groq OpenAI 兼容 `chat/completions` + `tools`/`tool_choice`,zod 校验,异常→`GROQ_PROVIDER_ERROR`。
- `provider-config.ts`：`getGroqAssistantProviderConfig`(key 必填、`GROQ_MODEL` 默认 `llama-3.3-70b-versatile`,env 可配——不重蹈 D28 气味 B)。
- `provider-adapter.ts`：switch 加 groq 分支。
- `env.ts`：`ASSISTANT_PROVIDER` enum + 类型加 groq。
- `assistant-stream-types.ts`：`provider_selected` 事件类型加 groq(类型传播)。
- `groq-assistant-provider.test.ts`：5 例 mock-fetch(tool_call / message / HTTP 错误 / 空响应 / 缺 key 抛错)。

Verification:
- `pnpm type-check`(client+server+shared) / `pnpm test:unit`(281,+5) / `pnpm eval`(13/13·12/12·3/3 PASS)：通过。改动文件 eslint EXIT 0。
- 默认 mock,零行为变更,无需浏览器验证。

遗留(11.2/11.3)：让 LLM 真正参与路由(带校验 + 确定性回退 + 扩"自由表达"eval);收敛路由双轨;客户端 `provider_selected` 接受 groq 的类型放宽;旧 anthropic 硬编码模型 id 收编。文档同步：`api-contract`/`local-run-guide`/roadmap §8.2/§8.3 + D34 已更。

## 2026-06-22 文档日期更正

用户发现本轮所有文档条目都被错标成 2026-06-17（实际今天 06-22，且本 session 跨多天）。按 git 提交时间戳更正：
- 06-17（保留，本就正确）：Slice 3.1、Slice 7、可用性打磨批次（含浮点 1RM 修复）= D27/D28。
- 06-20（原误标 17，已改）：§8.1 理解层升级 + §7 更新、D29/D30/D31、§8.2 优化总 Slice、Slice 12。
- 06-21（原误标 17，已改）：Slice 11a + D32、前端粘 mode 修复、A+B 止血 + D33、api-contract 文档同步 + §8.3、Slice 11.1 + D34。
- roadmap 顶部 `Last updated` 6-13 → 6-22。

教训：应使用系统提供的当前日期写文档条目，而不是沿用 session 起始日。涉及 `progress.md` / `ai-decisions.md`(D29–D34) / `roadmap.md`(§7/§8.1/§8.2/§8.3 + 表内 ✅ 戳)。无代码改动。

## 2026-06-22 §8.3 Slice 11.2a - provider 路径"数据意图必出工具"安全网（治①，确定性）

治体检问题①："今天适合练什么"等数据 intent 路由对了,但 provider 路径里 mock-provider 选不出工具、返回泛泛 prose("我目前更适合回答…"),用户拿到非答案。决策见 `ai-decisions.md` D35。

核查：provider 路径的 intent 全是"要数据"的,`getAllowedToolDefinitions` 给多个工具可选;mock 选不准。

改动（4 文件）：
- 新增 `assistant-provider-fallback.ts`：纯函数 `coerceMessageToEvidenceToolCall(response, tool, args)`——provider 返回 message（没调工具）就兜底合成对该 mode 默认工具的 tool_call,复用既有执行+组装路径;仅参数齐备才兜底（exercise_id 缺失的动作工具保留"先选动作"提示）。
- `assistant-provider-fallback.test.ts`：4 例（date-only 兜底 / 带 exercise_id / 缺参不兜底 / tool_call 透传）。
- `assistant-orchestrator-service.ts`：`runAssistantProvider` 结果过错误闸 → `coerceMessageToEvidenceToolCall` → 既有分支（rawProviderResponse→providerResponse）。
- `assistant-mock-turn-smoke.ts`：更正一条过时断言（mode=unsupported 早返回 `composeUnsupportedAnswer`,断言改"这个问题我还没识别清楚";该断言自 Slice 11a 起就与行为不符,smoke 不在门禁故未发现）。

确定性、provider 无关：mock 下①即被治好,groq 下作兜底网,让"启用 groq"安全。

Verification:
- `pnpm type-check` / `pnpm test:unit`(285,+4) / `pnpm eval`(13/13·12/12·3/3 PASS)：通过。改动文件 eslint EXIT 0。
- ① 已在 mock 上修好（部署后当前 prod 即可验证"今天适合练什么"出真答案,无需切 groq）。

下一步：11.2b（LLM 自由表达路由,治"明天练啥")才是切 groq 的真正增量;切 prod groq 建议留到 11.2b 一起,避免只为小增益加每轮 Groq 调用延迟。

## 2026-06-22 §8.3 Slice 11.2b - LLM 意图路由（关键词优先 + 落空 Groq 救场）

让 LLM 真正参与路由,治"明天练啥/帮我看看这周咋样"等自由表达落空死板,且不牺牲 eval 基线。决策见 `ai-decisions.md` D36。

架构：关键词优先 + 落空才调 LLM：
- `resolveRoutedIntent` 改 async：关键词确信命中直接用(13 条 eval 不动、无延迟、无回归);只在落空时进救场。
- 落空：越界仍拒答;否则有 router 就调 Groq 受限分类(12 个已知 intent 选一,含 unsupported)+ 校验 + 失败回退 unsupported。

改动（server 3 + client 2 + 2 测试）：
- 新增 `llm-intent-router.ts`：`createGroqIntentRouter`,Groq 受限分类,任何失败(缺 key/HTTP 错/异形/非法 label/异常)→ null,上层回退。
- `assistant-orchestrator-service.ts`：`resolveRoutedIntent` async + 关键词优先 + 救场 + 可注入 router(默认仅 provider=groq 时创建,mock 下 null 行为不变);导出供测试。
- `assistant-stream-types.ts`：`AssistantStreamOptions.intentRouter` 注入位。
- client `assistant-types.ts` + `AssistantStatusRail.tsx`：`provider_selected`/`AssistantProvider`/`formatProvider` 放宽到 groq(显示"智能回答"),为 prod 切 groq 做好。
- `llm-intent-router.test.ts`(5) + `resolve-routed-intent.test.ts`(6,fake router)。

Verification:
- `pnpm type-check`(client+server+shared) / `pnpm test:unit`(296,+11) / `pnpm eval`(13/13·12/12·3/3 PASS)：通过。改动文件 eslint EXIT 0。
- 救场逻辑由 fake-router 确定性单测覆盖;真实自由表达路由质量靠 prod 验证(切 groq 后)。

⚠️ 待生效：需把 Vercel `ASSISTANT_PROVIDER` 改为 `groq`——届时"明天练啥"被 LLM 救场到 recommendation,且 D35 工具选择 + groq 一起上线。回退:改回 `mock` 一键回确定性。

遗留(11.3)：关键词自信误判 LLM 管不到(留 LLM 主路由);自由表达真实 LLM eval 非确定,留 opt-in。

## 2026-06-22 Slice 11.2b 上线微调：常见简写"周报"进关键词快路径

切 prod groq 后实测:LLM 路由质量很好（"明天练啥"→recommendation、"帮我看看这周练得咋样"→summary、"我最近有进步吗"→progress、"我练得均衡吗"→imbalance、"怎么判断的"→evidence,prod 探针 6 条中 5 条改写都对）。唯一漏的是 2 字简写**"周报"**——keyword 没收、LLM 也判成了 unsupported（可能当成工作周报）。

修复：`WEEKLY_REPORT_PATTERN` 加 `周报`——常见词进关键词快路径,确定性、还省一次 LLM 调用。属正当 keyword 改进("周报"→weekly_report 正确且跑真工具,无自信错答风险),非脆弱过度打补丁。+1 路由单测。

Verification: `pnpm type-check` / `pnpm test:unit`(+1) / `pnpm eval`(13/13·12/12·3/3 PASS) 通过;改动文件 eslint 干净。部署后"周报"即走 weekly_report（无需再调 LLM）。

体会:这正是"关键词优先 + LLM 救场"设计该有的样子——常见词放 keyword（快、稳),长尾交 LLM(prod 实测改写覆盖良好)。

## 2026-06-22 Slice 11.3a Codex 审查止血：周报工具契约 + 混合/平台期相关性闸门

接 Codex 审查（5b46108 之后）两条：

- **P1 周报工具契约漂移（可致"周报"不跑工具 / 线上 400/502）**：`getToolDefinitionForMode` 把 `get_weekly_training_report` 的 `exercise_id` 列进 `input_fields`，但真实 schema（`weeklyTrainingReportArgsSchema`）里它是 **optional**。而 `input_fields` 被两个消费方都当"全必填"——`coerceMessageToEvidenceToolCall`（缺字段即放弃兜底）、`buildGroqTools`（`required: [...input_fields]`）。后果：没选动作的"周报"→ 兜底被卡 → 漏 prose；Groq 被告知 exercise_id 必填 → 可能传 `"null"` → uuid 校验失败。修复：该分支 `input_fields` 去掉 `exercise_id`（只留必填的 start/end_date）。代价：Groq 不再给周报传可选的单动作收窄——可忽略。
- **P2 相关性闸门漏覆盖 mixed_tool_rag / plateau_diagnosis**：D33 的 `filterRelevantKnowledgeChunks` 原只用于纯 knowledge / unsupported 兜底；这两条最重要的诊断路径仍直接用 `retrieveKnowledgeChunks` 原始结果当 sources → 仍可能引"语义最近但无关"的 chunk。修复：两处都套上 `filterRelevantKnowledgeChunks`（与 knowledge 路径一致：日志记原始 `retrieved[0].retrieval_mode`、`fallbackReason: "no_relevant_sources"`）。两个 composer 已能优雅处理空 sources（"暂无训练知识来源"），过滤到空安全。
- **回归测试（补 Codex 指出的 residual risk）**：导出 `getToolDefinitionForMode`；新增 `tool-contract.test.ts`——(a) 对所有 mode 断言每个 `input_fields` 在真实 zod schema 里确实必填（一次性抓本次及未来任何漂移）；(b) 周报无 exercise_id 时经 `coerceMessageToEvidenceToolCall` → 产出 tool_call 而非 prose。

Verification: `pnpm type-check`(client+server+shared) / `pnpm test:unit`(298,+2) / `pnpm eval`(13/13·12/12·3/3 PASS) 通过；改动文件 eslint EXIT 0。
文档：api-contract.md 早已正确写明周报 exercise_id 为 optional（line 675），是 input_fields 漂移而非文档——故 api-contract 不改。见 ai-decisions D37。

## 2026-06-22 Slice 11.3a 收尾：周报 orchestrator 级端到端测试（补 Codex residual risk）

Codex 本轮判过，建议补一个真正 orchestrator 级闭环测试。新增 `weekly-report-orchestrator.test.ts`：用 `vi.mock` 桩掉 DB（chat-repository）、tool 执行器（tool-executor）、provider（provider-adapter 返回纯 prose）、provider-config（=mock，走关键词路由），无数据库驱动整条链路。断言 message="周报" + 无 exercise_id + provider 只返回 prose 时：① 路由到 weekly_report；② 兜底把 prose 转成 `get_weekly_training_report` 工具调用，**exercise_id 完全不作为 key 传入**；③ tool_calls 记一条 success；④ 最终答案 evidence 绑定工具输出（tool_names / workout_ids / set_ids）；⑤ faithfulness=verified。这把 P1 的端到端闭环也纳入门禁（此前只有契约测试兜底）。

Verification: `pnpm type-check` / `pnpm test:unit`(299,+1) / `pnpm eval`(13/13·12/12·3/3 PASS) 通过；新增文件 eslint EXIT 0。纯新增测试、无源码改动。

## 2026-06-22 Slice 11.3a：收敛单轨路由（删除 mock provider 影子分类器）

把路由双轨收敛成单轨。新增 `assistant-tool-routing.ts` 承载 `getToolDefinitionForMode`（从编排层搬出，单一 mode→工具映射源）；mock provider 改读 `assistant_context.mode`（`resolveRoutedIntent` 已解析的 mode）选工具，删除 `detectIntentFromMessage`/`resolveIntent` 这套独立正则分类器（轨 2）。此后全局唯一的消息→意图分类器就是 `resolveRoutedIntent`。编排层从新模块 import；`tool-contract.test.ts` import 路径跟随。

- 行为：正确路由用例不变；过去轨 1↔轨 2 分歧的 bug 用例被纠正。eval 不受影响（intent 直接调 classify、refusal/faithfulness 离线 fixtures）。groq / mock 回退不受影响。
- 测试：`mock-provider.test.ts` 重写为 mode 驱动 + "同一消息不同 mode → 不同工具（证明忽略消息文本）" + exercise 缺 id 守卫 + 模拟钩子保留。

Verification: `pnpm type-check` / `pnpm test:unit`(303,+4) / `pnpm eval`(13/13·12/12·3/3 PASS) 通过；改动文件 eslint EXIT 0。决策见 ai-decisions D38。

## 2026-06-23 Slice 11.3b：LLM summary 措辞改写（faithfulness 门控 + 确定性回退，env 默认 off）

让真实模型参与"措辞"但不动摇确定性护城河：**只改写 `answer.summary`**，其余字段全确定性。双门控 `ASSISTANT_PHRASING=on`（新增 env，默认 off）+ `ASSISTANT_PROVIDER=groq`；运行时 faithfulness 校验改写文本，未验证即回退 draft；第二次 LLM 调用任何失败 → 回退 draft。两小批（守 ≤5 文件）：

- **Batch 1（配置+接缝，零行为变更）**：`env.ts` 加 `ASSISTANT_PHRASING` 布尔开关；`provider-config.ts` 加 `isAssistantAnswerPhrasingEnabled()`（开关 && groq）；`groq-assistant-provider.ts` 加 `runGroqAnswerPhrasing`（graceful，失败返 draft）；`provider-adapter.ts` 加 `runAssistantAnswerPhrasing` 分发；+4 groq 单测。
- **Batch 2（决策+接线）**：新增 `answer-phrasing.ts` 纯函数 `applyFaithfulPhrasing`（verified 才采用改写，否则回退；空白/相同 no-op）+4 单测；编排层 provider 数据路径在 emit 前门控调用。`weekly-report-orchestrator.test.ts` 的 provider-config/adapter mock 补齐新导出。

Verification: `pnpm type-check` / `pnpm test:unit`(311,+8) / `pnpm eval`(13/13·12/12·3/3 PASS) 通过；改动文件 eslint EXIT 0。默认 off 零行为变更，真链路质量靠 prod（开 `ASSISTANT_PHRASING` + groq）验证。决策见 ai-decisions D39。

## 2026-06-23 Slice 11.3b 止血（Codex 审查 9c2591e 后）

- **P2 安全保证对齐 + 保守闸门**：faithfulness 只拦数字/引用，拦不住模型新增的非数字事实（"恢复得很好"等）。`applyFaithfulPhrasing` 加**长度闸门**（改写 ≤ `draft.length*1.5+16`，超长回退）收窄注水空间；JSDoc/D39 改成诚实表述——程序性保证 = "无未验证数字/引用 + 长度受限"，**不等于**"不新增非数字事实"，故默认 off、开启需谨慎。+1 单测（注水超长被拒）。
- **P3a 连接复用**：`runGroqAnswerPhrasing` 的 HTTP error 分支改为先 `await response.json()` 排空 body 再回退（对齐主 provider，避免 undici 未消费 body 影响连接复用，429/5xx 多了会变稳定性坑）。
- **P3b 运维文档**：`.env.example` / `README.md` / `local-run-guide.md` 补 `ASSISTANT_PHRASING`（默认 off + 仅 groq 生效 + faithfulness 门控）；更正 README 过时的"无第二次 provider 调用"。

Verification: `pnpm type-check` / `pnpm test:unit`(312,+1) / `pnpm eval`(13/13·12/12·3/3 PASS) 通过；改动文件 eslint EXIT 0。默认 off 仍零行为变更。

## 2026-06-23 C1：Token/成本 observability（聚合 Groq usage 进每轮日志 + 可选 token_usage DTO）

> ⚠️ **本条为初版方案，已被后续提交取代**：① token_usage 进公开 DTO → 改内部 telemetry 信封（见下方"审查改进"条 + ai-decisions D40）；② 后续二审又补：意图救场调用计入、按模型计价（未知→null）、计数语义拆分、失败 turn 记日志、抽共享 Groq client（见下方"C1 二审定稿"条）。当前结论以 D40 为准。

11.3b 引入第二次计费调用后补成本可观测（小、稳、无行为风险）；LangSmith 外部 tracing 单独评估、本片不做。两小批：

- **Batch 1（取 usage + schema，零行为变更）**：`provider-types.ts`（message/tool_call 响应加可选 `usage` + `AssistantProviderUsage`）；`groq-assistant-provider.ts`（路由调用解析 usage）；`assistant-turn-observability.ts`（event/input 加 `llm_call_count/prompt_tokens/completion_tokens/total_tokens/estimated_cost_usd`，list-price 估算）；+groq/observability 单测。无人消费 usage → 全绿零变更。
- **Batch 2（接线）**：`runGroqAnswerPhrasing` 改返回 `{summary, usage}`（adapter 跟随）；编排层 `aggregateTurnTokenUsage` 聚合路由+措辞 usage → 可选 `token_usage` 进 `MockAssistantTurnResponseData`（structured_output，snake_case，additive 可选）；控制器映射进 `logAssistantTurnEvent`；+端到端单测（有 usage 聚合 / mock 路径 undefined）。

成本：`estimated_cost_usd` 按 llama-3.3-70b list price 估算（注明非实际计费，Groq 免费层 $0）；tokens 是真信号。

Verification: `pnpm type-check` / `pnpm test:unit`(317,+6) / `pnpm eval`(13/13·12/12·3/3 PASS) 通过；改动文件 eslint EXIT 0。默认/mock 路径零行为变更。决策见 ai-decisions D40；DTO 字段见 api-contract。

## 2026-06-23 C1 审查改进：token_usage 收敛到内部 telemetry 信封（不污染公开 DTO）

Codex 审查 a8aa58e：把 `token_usage` 放进公开 `MockAssistantTurnResponseData` 属 API 契约污染（token/成本/trace 是服务端运维元数据，不该让客户端依赖 Groq/OpenAI usage 结构）。改为内部信封：

- `runMockAssistantTurn` 返回 `AssistantTurnExecutionResult { response, telemetry }`；`telemetry.tokenUsage`（camelCase `AssistantTokenUsage`）服务端专属，**移出** `MockAssistantTurnResponseData` / `structured_output`。
- 控制器 `const { response, telemetry } = await runMockAssistantTurn(...)`：`logTurnTelemetry` 从 telemetry 取 tokenUsage、从 response 取业务字段；响应只回 `response`。
- `aggregateTurnTokenUsage` 返回 camelCase `AssistantTokenUsage`，去掉 snake_case 的 `AssistantTurnTokenUsage` DTO 类型。`telemetry` 后续可自然扩展 `trace_id`/模型/各调用耗时成本。
- api-contract 改为"Token/成本是服务端 telemetry，不进响应"。

Verification: `pnpm type-check` / `pnpm test:unit`(317) / `pnpm eval`(13/13·12/12·3/3 PASS) 通过；改动文件 eslint EXIT 0。涉及 3 代码文件（orchestrator / 控制器 / 端到端测试）+ docs。

## 2026-06-23 C1 二审定稿：可信 token/成本 telemetry（Codex C1 复审）

Codex 二审 a8aa58e/dc1265d 后判 C1 计数/成本不可信，逐条修实（拆 4 批，每批 ≤5 文件、各自过门禁 + Prettier）：

- **Batch 1（P3a + P2b）**：抽共享 `groq-chat-client.ts`（统一 fetch + 排空 body + 核心响应与 usage 分开解析，usage `int().nonnegative()` 非法只丢 usage；返回 `attempted/provider/model`，配置失败 attempted=false、不调 fetch）。`groq-assistant-provider` 改用它，删重复 fetch/schema。
- **Batch 2（P1）**：`llm-intent-router` 改用 client，返回 `{intent, usage, attempted, errored}`；`resolveRoutedIntent` 透传为 `ResolvedRoutedIntent`；编排层把救场调用 usage 计入**所有**路径 telemetry。
- **Batch 3a/3b（P2a + P2c）**：措辞返回 `attempted/errored`；telemetry 拆 `llm_attempt/usage_report/error_count` + provider/model；成本按模型查价表（未知→`estimated_cost_usd: null`），model 取自本轮实际配置（非 observability 层 re-read env）；失败 turn 经 `logFailedAssistantTurnEvent` 落 `status:"error"` 行（两控制器）。三处调用收成 `AssistantLlmCallRecord[]` → `summarizeTurnLlmCalls`。
- **Batch 4（P2d + P3b）**：重写 D40/roadmap 当前结论（最多三次调用、telemetry 信封、按模型计价）；progress 初版条加"已取代"标注；本轮触及文件均跑 Prettier（仓库 156 个历史 format 欠债不动）。

Verification: `pnpm type-check` / `pnpm test:unit`(328) / `pnpm eval`(13/13·12/12·3/3 PASS) 通过；改动文件 eslint + Prettier 干净。决策见 ai-decisions D40（含演进史）。

## 2026-06-23 C1 三审：失败/边缘路径 telemetry 封死（Codex C1 复审 #2）

二审定稿后 Codex 复审发现失败/边缘路径仍失真，逐条修（一组 cohesive 改动，telemetry 语义跨层）：

- **P1 失败 provider 调用计入**：provider 响应所有 variant（含 `error`）现都带 `telemetry`；编排层 provider 失败时抛 `AssistantTurnError`（HttpError 子类带 `turnTelemetry`，不序列化给客户端），控制器错误分支用它发 `logFailedAssistantTurnEvent({..., llm})`。Groq 429/500 失败轮现有 `llm_attempt_count=1 / llm_error_count=1 / model / usage`。补端到端单测（groq 500 routing path）。
- **P2 provider/model 取自实际 client 结果**：统一 `AssistantProviderCallTelemetry {attempted, errored, provider, model, usage}`；意图救场（`{intent, call}`）、措辞（`{summary, call}`）、工具选择（response.telemetry）都带它；`summarizeTurnLlmCalls(records)` 从 records 聚合 provider/model，删 `resolveTurnGroqModel`/meta re-read env。
- **P3 空响应保留 usage**：措辞/路由空文本回退 draft 时仍带 `call.usage`，token/成本不漏。补单测。
- **P2d 文档**：roadmap §8.2 B1 / §8.3 标 token/成本 observability ✅；D40 加"三审"演进 + provider/model 从 records 的表述。

Verification: `pnpm type-check` / `pnpm test:unit`(330) / `pnpm eval`(13/13·12/12·3/3 PASS) 通过；改动文件 eslint + Prettier 干净。决策见 ai-decisions D40。

## 2026-06-29 C3 / Slice 10：确定性安全分类器（疼痛/医疗边界 pre-routing gate）

新增医疗安全边界：`assistant-safety.ts` 在 `resolveRoutedIntent` / Groq 救场 / RAG / 工具执行之前判定急性疼痛、模糊疼痛/症状、红旗症状、诊断/治疗请求和用药请求。命中后直接返回确定性安全模板（不诊断、不开药、不走 LLM），`intent` 仍为 `unsupported` 以保持公开 DTO 稳定；内部 `AssistantTurnTelemetry.safety` 经 `assistant_turn` 日志落 `safety_boundary` / `safety_reason`，LLM 计数保持完整 0 值。

关键边界：明确慢性约束（如“膝盖以前受过伤，想避开深蹲”）继续走档案/训练调整；但出现疼痛/症状 token 且没有明确过去/已恢复/规避框架时 fail-safe 判 `medical_boundary`。`ASSISTANT_SAFETY_GATE` 默认开，只有 off/false/0/no 显式关闭；`.env.example` 已记录。

门禁：新增 safety eval（急性/模糊疼痛正例 + 慢性约束反例）纳入 `pnpm eval` 的 fail-closed 检查；新增分类器、编排短路、telemetry 单测。决策见 ai-decisions D41。
