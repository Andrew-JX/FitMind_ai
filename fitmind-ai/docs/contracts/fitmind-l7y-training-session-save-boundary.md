# fitmind-l7y — training session 保存边界合同

contract SHA：本文档首次提交所在的 commit；candidate 不得修改。

baseline SHA：`84d8330900f1be80fe1dc5071f3b6762644ec0ef`

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/docs/contracts/fitmind-l7y-training-session-save-boundary.md`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/client/src/features/training/TrainingSessionComposer.tsx`
- `fitmind-ai/client/src/features/training/training-session-save.ts`
- `fitmind-ai/client/src/features/training/training-session-save.test.ts`

明确排除开工前已有的 `.github/workflows/deploy-tencent.yml`、`fitmind-ai/deploy/README.md`、`fitmind-ai/deploy/compose.yaml`、`fitmind-ai/deploy/scripts/deploy.sh`、`fitmind-ai/deploy/scripts/deploy-release-identity.test.mjs`、`fitmind-ai/server/src/app.test.ts`、`fitmind-ai/server/src/deploy-workflow.test.ts`、`fitmind-ai/server/src/routes/health.ts` 与 `fitmind-ai/docs/progress.md` 中并行的 `fitmind-a0k` 工作树改动。

## 冻结事实与边界

1. baseline 的 `TrainingSessionComposer.tsx` 为 1648 个物理行，取值命令是 `(Get-Content fitmind-ai/client/src/features/training/TrainingSessionComposer.tsx).Count`。本批不以候选行数作为完成条件；完成条件是保存语义与 mutation 顺序的单一所有权、冻结行为和依赖方向。
2. baseline 的 create 与 edit 保存逻辑都在组件内部：create 调用 `buildWorkoutRequestFromDraft` 后 `createWorkout`；edit 组装 `TrainingSessionInitialDraft`、调用 `buildWorkoutEditPlan`，再严格按 workout patch、set deletes、set patches、set adds 的顺序逐项 await。
3. 新模块稳定 facade 精确导出 `prepareTrainingSessionSave` 和 `executeTrainingSessionSave` 两个 runtime 函数。测试提交可以先提供只抛 `Not implemented` 的 facade；它不接入 production 组件，不算候选实现。
4. `prepareTrainingSessionSave` 是纯函数。它接收组件当次点击读取到的 mode、draft、elapsed seconds、initial draft 与显式 `now: Date`，返回 create/edit 判别联合或 null；它不读取系统时间、token、React state、网络或浏览器全局。
5. `executeTrainingSessionSave` 是保存 HTTP 边界。production 默认依赖现有 `workout-api.ts` 五个 mutation；测试可以注入同形 fake API。它不捕获或改写异常，失败按原组件边界向上抛，由组件现有 `getReadableErrorMessage` 处理。

## 判据

判据 1：机器 · `training-session-save.test.ts` 在 implementation 前作为独立 commit 冻结；候选中其 Git blob 不变。测试必须从稳定 facade 导入两个函数，不复制候选算法构造 expected。

- 度量：`git hash-object fitmind-ai/client/src/features/training/training-session-save.test.ts`；candidate 与测试提交逐字比较。
- 已知假绿灯：实现后再补一组与实现同构的测试，无法证明迁移前行为被固定。

判据 2：机器 · prepare 对 create-active 精确保留 baseline 时间语义：`now` 来自点击保存时组件显式传入；有 `draftStartedAt` 时 `performed_at` 为该开始时间、`ended_at` 为 `now.toISOString()`，否则两者使用原 baseline 的 save-time/draft-ended-at 分支；elapsed seconds、notes 与有效 sets 逐字段进入既有 request builder。

- 度量：冻结表驱动测试深比较完整 create request，并用两个不同时区语义的 ISO 输入证明不在模块内重新读取 `Date.now/new Date()`。
- 已知假绿灯：只断言返回 kind 为 create，会放过 performed/end time、duration、notes 或 sets 漂移。

判据 3：机器 · prepare 对 create-from-intake 使用 `draftDurationMin`、`draftPerformedAt`、`draftStartedAt`、`draftEndedAt`；对 edit-existing 使用 `initialDraft.originalWorkout` 与当前 draft 字段生成原 `buildWorkoutEditPlan` 结果。无有效 create sets 或缺少 edit original workout 时返回 null。

- 度量：冻结测试分别深比较 intake request、含 workout patch/delete/patch/add 的 edit plan，以及两类 null；测试数据中的 mode 直接来自组件同名联合类型。
- 已知假绿灯：只覆盖 active create 会让导入训练时间或编辑训练静默漂移；edit 缺 original 时返回 no-op plan 会把无效状态伪装成保存成功。

判据 4：机器 · execute 对 create 精确调用一次 `createWorkout(token, request)`；对 edit 严格按 workout patch（若有）→ 所有 deletes → 所有 patches → 所有 adds 的顺序串行执行，并逐次透传 token、workout/set id 与 payload。完全空 edit plan 不发请求且正常返回。

- 度量：fake API 把每次调用参数写入单一 ordered log，冻结测试对完整 log 深比较。
- 已知假绿灯：分别断言每个 mock 被调用会放过并行化或顺序变化，而服务器当前没有跨这些请求的总事务；顺序漂移会改变部分失败时留下的数据形状。

判据 5：机器 · 任一 edit mutation 抛错时 execute 原样 reject，且 ordered log 中不存在失败点之后的调用；不得捕获后继续、重试或包装成成功。候选必须做一次隔离回退演示：临时让实现吞掉该错误，冻结测试必须非零退出并命中后续调用断言，随后恢复并核对文件 blob/工作树。

- 度量：冻结测试注入在首个 set delete 抛出的同一 Error 实例，使用 `rejects.toBe(error)` 并断言 log 精确止于失败调用；回退演示有 30 秒命令上限。
- 已知假绿灯：只断言 Promise reject 会放过错误包装；只断言失败 API 被调用会放过后续 mutation 继续执行。

判据 6：机器 · `TrainingSessionComposer.tsx` 只消费新模块两个 facade，不再直接 import `workout-api.ts` 的五个 mutation，也不再 import/call `buildWorkoutEditPlan`；上述生产 mutation 的保存编排归属新模块。组件仍在无 token、prepare 返回 null、pending/success/error/finally 分支执行原有文案、reset、`onCreated` 与 `isSubmitting` 状态动作。

- 度量：冻结测试读取两个 production 源文件，枚举 import/调用所有权；TypeScript、ESLint、Prettier 与人工 staged diff 共同核对组件 wiring。组件交互没有现成 DOM 单测环境，故 UI 状态动作只报告“源码保持/人工核对”，不能冒充浏览器验证。
- 已知假绿灯：只新增模块但组件仍保留旧逻辑会形成双重所有权；删掉 finally 或把 reset/onCreated 移到失败路径仍能让纯模块测试全绿。

判据 7：机器 · 定向冻结测试、相关既有 `training-session-draft.test.ts` 与 `workout-to-session-draft.test.ts`、根 `pnpm verify`、根 `pnpm eval`、client production build 均 exit 0，并报告本次运行数量。candidate 范围是 baseline 到 candidate 的 tracked/untracked 文件并集，逐字等于允许清单；合同与冻结测试不变，排除文件未暂存。

- 已知假绿灯：只跑新测试不会覆盖既有 request/edit plan；只跑 type-check 不能证明 mutation 顺序；本地构建不等于浏览器交互或线上生效。

## 冲突与限定词检查

冲突检查：已通读，无冲突。本地 commits 已授权；push、部署、真实数据库、真实 API 与外部网络未授权。测试只用纯数据、fake API 和源码读取。

限定词：

- “当前时间”运行时来源是组件处理完成点击时创建并传给 prepare 的 `now: Date`，测试使用固定 Date。
- “当前 draft”来源是同一次 render/handler 闭包读取的 draft state；测试显式构造对应字段。
- “edit original workout”来源是 `props.initialDraft.originalWorkout`；不存在时 prepare 返回 null。
- “严格顺序”指 ordered fake log 中逐项完全相等，不以各 mock 最终 call count 冒充。
- “失败点之后”指 injected fake API 抛出同一 Error 的 log 索引之后，不以耗时或未处理 rejection 猜测。
