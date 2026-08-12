# fitmind-wsf — 训练草稿组状态边界合同

contract SHA：本文件首次提交所在的 commit；提交后记录到 Beads，characterization 与 candidate 均不得修改本文件。

baseline SHA：`b6789914f1e4d36acf38e54224899d4d3633c117`

characterization SHA：开工前为空；必须早于 candidate。

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/docs/contracts/fitmind-wsf-training-draft-set-state.md`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/client/src/features/training/TrainingSessionComposer.tsx`
- `fitmind-ai/client/src/features/training/training-session-set-state.ts`
- `fitmind-ai/client/src/features/training/training-session-set-state.test.ts`

明确排除开工前已有的部署、健康检查与 `fitmind-ai/docs/progress.md` 中并行 `fitmind-a0k` 改动；本批不改保存、计时器、动作选择、HTTP、数据库、样式或文案。

## 冻结事实与接口

1. baseline 的 `TrainingSessionComposer.tsx` 为 1573 个物理行，取值命令是 `(Get-Content fitmind-ai/client/src/features/training/TrainingSessionComposer.tsx).Count`。行数不是完成判据，完成判据是下列五类状态变换的单一所有权与冻结行为。
2. 新模块稳定导出五个 runtime 函数：新增组、复制组、删除组、编辑组、切换完成状态。新增与复制允许注入组工厂；production 使用现有 `createDraftSet`，冻结测试使用确定性工厂。
3. 新模块只接收并返回 `DraftExercise[]`；不读写 React state、时间、随机数、网络、浏览器全局或持久化层。组件仍拥有 notice、计时器与事件 handler，只把数组状态变换委托给新模块。
4. characterization 测试先连到只抛出 `Not implemented` 的稳定 facade，作为独立红测提交；candidate 只能改 production 实现和 wiring，不得改合同或测试 blob。

## 判据

判据 1：机器｜`training-session-set-state.test.ts` 在 implementation 前独立提交，candidate 中其 Git blob 逐字节不变；测试只从新模块导入公开函数，不复制候选算法生成期望值。

- 度量：`git hash-object fitmind-ai/client/src/features/training/training-session-set-state.test.ts` 在 characterization 与 candidate 比较相等。
- 已知假绿：拆完后再补测试，或 candidate 同时改 fixture/断言，可以让错误迁移看似全绿。

判据 2：机器｜新增组对目标动作调用工厂一次，并把目标动作设为展开、把返回组追加到末尾；传给工厂的是目标动作最后一组，空列表时是 `undefined`。非目标动作内容不变。

- 度量：冻结测试用记录参数的确定性工厂，深比较完整返回数组与调用记录。
- 已知假绿：只断言组数加一，会放过复制了第一组、插入错误位置、未展开或修改错误动作。

判据 3：机器｜复制组只在目标动作内按 `setId` 找源组，调用工厂一次并将结果追加；源组或目标动作不存在时不调用工厂且数据内容不变。

- 度量：冻结测试深比较源组存在、源组缺失和目标缺失三条完整输出，并比较工厂调用记录。
- 已知假绿：只断言工厂被调用，会放过跨动作查找、覆盖源组或源缺失仍追加空组。

判据 4：机器｜删除组在目标动作只有一组时拒绝删除；多组时只过滤同 `setId` 的组。编辑组只更新目标字段；编辑 `weightKg` 或 `reps` 时强制 `completed=false`、`restSeconds=null`，编辑其他字段保留二者和 `persistedSetId`。

- 度量：冻结表驱动测试深比较单组删除、多组删除、重量/次数编辑、其他字段编辑及缺失 id 的完整数组。
- 已知假绿：只测多组删除会放过最后一组被删；只测字段值会放过已完成的无效组仍保持完成、休息时间未清空或持久化 id 丢失。

判据 5：机器｜切换完成状态继续使用 `isDraftSetValid(set, exercise)`：无效组结果固定为 `completed=false/restSeconds=null`；有效未完成组变为完成并保留休息秒数；有效已完成组变为未完成并清空休息秒数；其他字段不变。

- 度量：冻结测试分别覆盖 weighted 有效/无效与 bodyweight 零重量有效输入，深比较完整组对象。
- 已知假绿：只测 weighted 正例会放过 bodyweight；只断言布尔值会放过无效组残留休息秒数或取消完成仍保留计时。

判据 6：机器｜`TrainingSessionComposer.tsx` 只消费新模块五个 facade，不再内联这五类数组算法，也不再为这些 handler 直接调用 `createDraftSet` 或本地 `canCompleteSet`。新模块拥有自己的测试文件且不存在反向 import Composer。

- 度量：冻结测试读取 production 源文件并枚举 import/调用所有权；TypeScript、ESLint、Prettier 与 staged diff 共同核对 wiring。
- 已知假绿：只新增模块但组件保留旧算法会形成双重所有权；只删 helper 名称而把相同 map/filter 逻辑留在 handler 仍是假拆分。

判据 7：机器｜定向冻结测试、相关 `training-session-draft.test.ts`、根 `pnpm verify`、根 `pnpm eval` 与 client production build 均 exit 0，并报告本次运行数量。candidate 的 baseline..candidate tracked/untracked 文件并集逐字等于允许清单；合同与测试不变；排除文件不暂存。

- 已知假绿：只跑新测试不覆盖原 draft 校验；只跑 type-check 不证明状态行为；本地 build 不等于浏览器交互、真实 API、数据库或线上生效。

## 冲突与限定词检查

冲突检查：已通读，无冲突。本地 contract、characterization、candidate commits 已获授权；push、部署、真实 API、真实数据库、生产浏览器与外部网络未授权或未验证。

限定词：

- “目标动作”来自函数参数 `exerciseId` 与输入数组中 `DraftExercise.id` 的严格相等匹配。
- “源组”来自同一目标动作 `sets` 中 `DraftSet.id === setId` 的第一项。
- “最后一组”来自目标动作当次输入的 `sets.at(-1)`；空列表产生 `undefined`。
- “有效”来自 production 同一路径的 `isDraftSetValid(set, exercise)`，不是测试自写的替代判断。
- “其他字段不变”由冻结测试对完整对象深比较，不从 TypeScript 属性推断运行时行为。
