# fitmind-8n2 — 导入训练结束时间不被保存时刻覆盖合同

contract SHA：本文档首次提交所在的 commit；candidate 不得修改。

baseline SHA：`4010f2721bb951acd38b46fc6d2bf7dbfab144d6`

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/docs/contracts/fitmind-8n2-intake-end-time.md`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/client/src/features/training/training-session-save.ts`
- `fitmind-ai/client/src/features/training/training-session-save.test.ts`
- `fitmind-ai/client/e2e/training-intake-time.spec.ts`

明确排除开工前已有的 `.github/workflows/deploy-tencent.yml`、`fitmind-ai/deploy/README.md`、`fitmind-ai/deploy/compose.yaml`、`fitmind-ai/deploy/scripts/deploy.sh`、`fitmind-ai/deploy/scripts/deploy-release-identity.test.mjs`、`fitmind-ai/server/src/app.test.ts`、`fitmind-ai/server/src/deploy-workflow.test.ts`、`fitmind-ai/server/src/routes/health.ts` 与 `fitmind-ai/docs/progress.md` 中并行的 `fitmind-a0k` 工作树改动。

## 冻结事实与策略

1. baseline `prepareTrainingSessionSave` 把任意 mode 的非空 `draftStartedAt` 都叫作 `activeStartedAt`，并据此把 `ended_at` 设为 `now.toISOString()`。create-from-intake 用户在时间编辑器明确填写 start/end 后，`draftStartedAt` 非空，因而保存点击时刻覆盖用户确认的 `draftEndedAt`。
2. create-active 与 create-from-intake 的时间来源不同：active 的结束时间运行时来自用户点击完成时组件传入的 `now: Date`；intake 的显式 start/end 来自 `TrainingTimeEditor` 的两个 `datetime-local` 输入，经 `parseDateTimeLocalValue` 转成 ISO 后写回 draft state。
3. 修复只改变 ended-at 分支条件：只有 `mode === "create_active"` 且 `draftStartedAt` 非空时使用 `now.toISOString()`；create-from-intake 始终把 `draftEndedAt` 传给既有 request builder。performed-at、started-at、duration、notes、sets、edit-existing、API 顺序和组件状态逻辑不改。
4. Playwright 后端全部由 route interception 模拟，不需要 API、数据库、密钥或外网；测试必须从正式 App 页面交互进入 composer，并检查真实 HTTP request body，不能直接调用 prepare 冒充客户端路径。

## 判据

判据 1：机器 · implementation 前先提交两层失败回归且 candidate 不修改：纯函数测试把同一 create-from-intake 显式 start/end 的 `ended_at` 从 baseline save-time 改为 draft end；Playwright 测试走 `App → 文本录入训练 → WorkoutIntakePanel parse → TrainingView onDraftParsed → TrainingSessionComposer time editor → 完成 → POST /api/workouts`，断言 request 的 started/end 精确等于用户输入转换后的 ISO。

- 度量：分别运行 `git hash-object fitmind-ai/client/src/features/training/training-session-save.test.ts fitmind-ai/client/e2e/training-intake-time.spec.ts`，candidate 与测试提交 blobs 逐字比较。
- 已知假绿灯：只测 prepare 无法证明组件把 time editor state 传到 HTTP；直接 mount composer 或伪造 request body 会跳过真实用户路径。

判据 2：机器 · create-from-intake 有显式 start/end 时，`request.started_at` 与 `request.ended_at` 分别逐字等于 draft start/end；改变显式 `now` 为任意更晚日期不改变二者。duration、performed-at、notes 与 sets 仍逐字段等于 baseline 输入。

- 度量：纯函数深比较完整 request；Playwright 对捕获的 POST body 深比较时间字段并断言 `ended_at !== save-click` 的固定未来时刻。
- 已知假绿灯：只断言 end 不等于 now 会放过 null、start 或另一个错误时间；只断言 duration 42 会放过本缺陷。

判据 3：机器 · create-active 有非空 `draftStartedAt` 时仍以注入的 `now.toISOString()` 结束；create-from-intake 无显式 start 时仍传 baseline `draftEndedAt`（通常 null），performed-at/duration 行为不变；edit-existing characterization 全绿。

- 度量：现有修订后的 `training-session-save.test.ts` 表驱动三条时间分支并运行 `workout-to-session-draft.test.ts`。
- 已知假绿灯：无条件改成 draft end 会让活动训练不在点击完成时结束；只修有 start intake 而改变无 start performed/duration 也不算通过。

判据 4：机器 · E2E request 必须来自浏览器实际发出的 `POST /api/workouts`：测试记录 method、URL 和 `postDataJSON()`，完整交互后精确收到一次；动作字典、intake parse 与 create response 由 spec route 模拟，未匹配 API 仍由共享 catch-all 返回 500，避免宽松 mock 假绿。

- 度量：Playwright 单 spec exit 0，报告测试数；request count 精确为 1，body 至少深比较 `performed_at/started_at/ended_at/duration_minutes/notes/sets`。
- 已知假绿灯：只等待按钮消失或 toast 成功不能证明 payload；宽松 catch-all 对所有 API 返回 200 会掩盖路径或 endpoint 写错。

判据 5：机器 · 对修复条件做隔离回退演示：临时恢复 baseline 的“任意 startedAt → now end”，纯函数测试与 Playwright spec 都必须在 60 秒上限内非零退出并显示期望 draft end、实际 future save time；随后恢复，核对两个冻结测试 blobs、实现 diff 与进程/端口由现有 global teardown 清理。

- 已知假绿灯：只改测试夹具时间导致失败，不证明 production 分支被命中；只跑纯函数回退不能证明浏览器路径。

判据 6：机器 + 人工 · 定向纯函数/既有 edit 测试、单 E2E spec、根 `pnpm verify`、根 `pnpm eval` 和 client production build 均 exit 0并报告本次数量。人工 staged diff 确认产品实现只改变 ended-at mode 条件；candidate 范围逐字等于允许清单，合同与冻结测试不变，排除文件未暂存。

- 已知假绿灯：单测、E2E、build 任一单独通过都不覆盖全部判据；本地 E2E 不等于生产已部署。

## 冲突与限定词检查

冲突检查：已通读，无冲突。本批是 `fitmind-l7y` 明确拆出的行为修复；本地 commits 已授权，push、部署、真实 API/数据库与外网未授权。

限定词：

- “显式 start/end”运行时来源是 TrainingTimeEditor 两个非空输入解析后写入的 `draftStartedAt/draftEndedAt`。
- “保存点击时刻”运行时来源是组件调用 prepare 时显式创建的 `new Date()`，纯测试用固定 future Date。
- “真实客户端路径”指正式 App 组件树和浏览器 HTTP request，不指真实后端。
- “一次”取自 spec 内捕获 `POST /api/workouts` 的数组长度，不用 UI 状态推断。
