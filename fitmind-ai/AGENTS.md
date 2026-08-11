# AGENTS.md — FitMind 协作与工程规则

本文件只保存会影响实现和验收的当前规则。历史、产品状态和长篇设计不在这里复制；按任务读取对应权威文档和目标代码/测试。

## 1. 开工入口

先读本文件，再按改动类型读取最小必要文档：

- API / HTTP 行为：`docs/api-contract.md`
- 数据库与迁移：`docs/db-schema.md`
- 助手、Tool Calling、RAG、模型成本：`docs/architecture.md`、`docs/ai-decisions.md`
- 前端交互与合规文案：`docs/UI_SPEC.md`
- 部署与线上验证：`docs/production-smoke-checklist.md`、`deploy/README.md`
- 历史与当前进度：`docs/INDEX.md`、`docs/progress.md`

文档与源码冲突时，不猜测也不把旧文档当事实：检查当前实现和测试，指出冲突，并把修正文档纳入任务范围或另建任务。

## 2. Beads：重新启用的任务流程

对可独立验收的中大型工作使用 `bd`：

1. 新会话先运行 `bd prime`，再用 `bd ready` 查看现有可执行任务。
2. 用户已经明确指定的新工作，不必改做 `bd ready` 中的无关任务；规划者可以创建 issue，再用 `bd update <id> --claim` 认领。
3. 实现前运行 `bd show <id>`，确认 description、依赖和 acceptance。acceptance 必须先冻结；执行者不得在实现中放宽、删除或改写。
4. 只做已认领 issue 的范围。发现额外问题时记录到新 issue，不顺手扩批。
5. 完成后把候选 SHA、命令、退出码、负向测试和未验证项写进 notes。
6. 创建并执行同一 issue 的人不关闭它；保持 `in_progress`，交给独立复核者验收和关闭。
7. `bd ready` 显示的依赖不可绕过。Dolt 数据库是 Beads 事实源；不要手改交换文件冒充状态。

多人同步、hooks 与恢复流程的生产级验证仍由 `fitmind-xbt` 跟踪；本地 Beads 可用不等于该任务已经完成。

## 3. 真实仓库地图

workspace 包为 `client`、`server`、`shared`。以下 manifest 由测试解析；新增、移动或删除架构目录时，源码与本节必须在同一批更新。

<!-- architecture-manifest:start -->

- `client/src/components/` — 可复用 UI 组件
- `client/src/features/` — 按业务域组织的页面、组件、hooks、纯逻辑与 `*-api.ts`
- `client/src/services/` — 跨 feature 的 HTTP transport
- `client/src/theme/` — 主题与设计 token
- `server/src/routes/` — Express 路由挂载
- `server/src/controllers/` — HTTP 参数、service 调用与响应映射
- `server/src/middleware/` — 鉴权、同意、限流和错误边界
- `server/src/schemas/` — 请求/响应运行时校验
- `server/src/services/training/` — 确定性训练计算与训练业务
- `server/src/services/assistant/` — 助手编排、provider、评测与可观测性
- `server/src/services/rag/` — 检索、embedding、语料和 RAG 评测
- `server/src/services/auth/` — 认证与同意业务
- `server/src/services/agent/` — 多步计划 agent
- `server/src/db/` — repository、连接池与数据库边界
- `server/src/utils/` — 通用服务端工具
- `shared/src/` — client/server 共同消费的跨边界契约

<!-- architecture-manifest:end -->

`server/migrations/` 保存顺序迁移，`server/scripts/` 保存迁移/烟测/维护脚本，`client/e2e/` 保存 Playwright 测试，`deploy/` 保存腾讯云部署链路。

## 4. 分层与依赖

### 客户端

- 共享请求行为集中在 `client/src/services/http-client.ts`；领域端点封装留在对应 feature 的 `*-api.ts`。
- `client/src/components/` 保持领域无关，通过 props/children 组合；业务状态、请求和文案留在 feature。
- 组件内状态优先 React state/reducer；跨组件状态通过已有 feature hook/context 传递。不要为不存在的抽象写规则。
- 跨前后端数据结构优先复用 `shared/src/` 的现有契约；不要为了“统一”把纯服务端 row 或运维 telemetry 暴露给客户端。

### 服务端

- routes 负责挂载，controllers 负责 HTTP 边界，services 负责业务，repositories 负责 SQL。以职责和测试为判据，不用行数判定“薄”。
- 所有用户资源查询/写入必须由已认证 `user_id` 约束。跨用户资源与不存在资源返回相同的安全 404，不做忽略 owner 的存在性探测。
- 确定性训练数据和数值来自 training/repository；assistant 可以消费它们，模型不得成为数值事实源。
- SQL 使用参数化查询。敏感同意检查与写入需要原子性时，在同一 `client` 事务内完成，不逃逸到共享 `pool.query`。

### training → assistant 临时例外

默认方向是 assistant 依赖 training。当前只冻结以下两个 importer；这是迁移期 allowlist，不是目录级许可。

<!-- training-assistant-allowlist:start -->

- `server/src/services/training/workout-intake-llm-parser.ts` — 训练录入暂时复用 assistant 下的 OpenAI-compatible client/config。
- `server/src/services/training/assistant-insights-service.ts` — 训练洞察 DTO 暂时复用 assistant intent type。

<!-- training-assistant-allowlist:end -->

到期点：修复计划“结构债 4.2”必须把 provider client/config 与共享 intent 类型抽到中立边界，并删除本 allowlist。到期不能用“主文件减少到 N 行”替代；抽出的模块要有自己的测试和拆分前后不变的 characterization 证据。

## 5. TypeScript、测试与错误边界

- 基础配置保持 `strict` 和 `noUncheckedIndexedAccess`。优先 `unknown` + 校验/类型守卫，禁止用 `as any`、双重断言或 `@ts-ignore` 掩盖错误。
- 外部输入在 HTTP/provider 边界用 Zod 或等价的运行时校验；数据库 row 与公开 DTO 不混用。
- 行为变更先补 characterization/失败测试，再修实现；测试必须断言副作用、状态或调用边界，不能只断言字符串存在。
- 已知失败不得标成环境 flaky。先保存输出、端口/PID 和复现条件，再判断环境还是产品漂移。
- provider、工具或数据库失败只捕获能够安全分类的错误；未知错误保留原始失败边界，不能静默伪装成功。

## 6. AI 可信度与成本

- 模型选择工具和可选措辞；训练数字、证据和计划内容由确定性函数/工具输出构造。
- provider 参数与响应均校验；工具参数失败走已有确定性引导/fallback，不信任模型输入。
- faithfulness、refusal、安全和 intent 回归由 `pnpm eval` 离线门禁；失败必须非零退出。
- 模型价格是会变化的外部事实。新增/修改价格要记录官方来源和核实日期；未知模型保持 `null`，调用次数护栏仍生效。
- 日志不得包含完整 request body、token、密钥或敏感健康数据。结构化日志使用归一化路径和必要字段。

## 7. 数据库迁移与回滚

<!-- migration-compatibility-rule -->

- 已应用 migration 不重写，也不靠事后补破坏性 `down()` 宣称可回滚。
- 每个新 migration 必须与上一个应用版本向后兼容：expand 阶段只增加旧镜像能够忽略的表、列、索引或兼容结构；不在同一 release rename/drop/收紧旧字段语义。
- contract 删除只能在所有线上应用都停止读取/写入旧结构后，于后续独立 release 执行。
- 发布前同时回答：新应用在迁移窗口是否可运行、schema 前进后旧镜像是否仍可运行。任一答案为否，必须写出分阶段前滚/回滚方案，不能依赖 image rollback 的名字。
- 迁移仍遵循 migration-first 的部署链路；expand/contract 是回滚兼容约束，不是跳过迁移的理由。

数据库身份、目标分支、破坏性变更和回滚检查以 `docs/production-smoke-checklist.md` 为准。

## 8. 安全与合规

- 认证使用 HttpOnly cookie，Bearer 只为受控脚本兼容；客户端不持久化 token。
- 用户输入、provider 输出、路径参数和游标均在边界校验；错误响应不泄露其他用户资源存在性。
- 健康数据写入受当前版本同意约束；分类删除和撤回路径不能被 pending-consent gate 阻断。
- 改隐私文案、同意版本、数据驻留或跨境行为时，同步 API/UI/政策契约和合规 E2E。
- 密钥、真实生产数据、部署目标和线上环境修改需要明确授权；本地代码授权不自动包含 push 或部署。

## 9. 验证与提交

默认离线门禁：

```text
pnpm verify
pnpm eval
```

按范围增加：

- 目标单测：`pnpm test:unit -- <files>`
- 合规浏览器门禁：`pnpm test:e2e:release`
- 构建：`pnpm --filter @fitmind/server build`、`pnpm --filter @fitmind/client build`
- 迁移/SQL/部署 smoke：仅在所需数据库、容器、密钥和授权真实存在时运行；未运行就明确写“未验证”。

提交只包含任务允许文件。提交前检查 staged diff 和负向用例；本地 commit、push、部署分别需要对应授权。不要把本地通过描述成 GitHub Actions 或生产已生效。

## 10. 文档同步

- API 路由/状态/DTO：更新 `docs/api-contract.md`。
- schema/migration：更新 `docs/db-schema.md` 和生产 smoke checklist。
- AI 边界、provider、成本或 fallback：更新 `docs/ai-decisions.md`。
- 用户交互与合规文案：更新 `docs/UI_SPEC.md`。
- 每个已验证批次：在 `docs/progress.md` 记录候选 SHA、证据和未验证项；历史条目不回写成“当时就已正确”。

文档中的绝对规则要么有机器门禁，要么改成带边界的指导。发现规则已经失效时，修规则和防漂移测试，不创建空目录迁就旧地图。
