# FitMind AI 周计划 V2 验收契约

baseline SHA：`2c00a38508ea968d9dbbc12ec5b8d3199bac6c73`

candidate SHA：`643daaa`（实现提交；本文件在收尾证据提交中补记）。

允许改动文件：

- `docs/contracts/fitmind-ai-weekly-plan-v2.md`
- `server/src/services/training/dictionary-service.ts`
- `server/src/services/agent/react-planner-types.ts`
- `server/src/services/agent/next-week-plan-generator.ts`
- `server/src/services/agent/next-week-plan-generator.test.ts`
- `server/src/services/agent/next-week-plan-agent.ts`
- `server/src/services/agent/next-week-plan-agent.test.ts`
- `server/src/services/assistant/assistant-orchestrator-service.ts`
- `server/src/services/planned-workout-service.ts`
- `server/src/services/planned-workout-service.test.ts`
- `client/src/features/assistant/assistant-types.ts`
- `client/src/features/assistant/assistant-request-payload.ts`
- `client/src/features/assistant/assistant-request-payload.test.ts`
- `client/src/features/assistant/assistant-structured-output.ts`
- `client/src/features/assistant/assistant-structured-output.test.ts`
- `client/src/features/assistant/planned-workout-api.ts`
- `client/src/features/assistant/planned-workout-api.test.ts`
- `client/src/features/assistant/AssistantChatPanel.tsx`
- `client/src/features/assistant/AssistantMessageList.tsx`
- `client/src/features/assistant/AssistantMessageBubble.tsx`
- `client/src/features/assistant/AssistantPlanCard.tsx`
- `client/src/features/assistant/AssistantCurrentPlanCard.tsx`
- `client/src/features/assistant/AssistantQuickPrompts.tsx`
- `client/src/features/assistant/WeeklyPlanSetup.tsx`
- `client/src/features/assistant/assistant-plan-editor.ts`
- `client/src/features/assistant/assistant-plan-editor.test.ts`

## 冻结判据

判据 1：机器 · `next_week_plan` 请求可携带临时的本周训练天数、单次时长、器械、状态和重点部位；非法天数、时长、器械或部位由服务端输入 schema 拒绝，普通助手请求保持兼容。

- 度量：运行相关 request-payload 单测与 server unit suite，断言合法字段逐项转发，非法字段触发 zod 校验。
- 已知假绿灯：前端把偏好拼进自然语言，但服务端结构化请求没有收到；负向断言必须检查 wire payload 的 `plan_preferences`。

判据 2：机器 · 生成器把器械和已记录伤病作为候选动作硬约束；输出中不得出现不在本周器械集合内的动作，也不得出现命中已知风险映射的动作。

- 度量：生成器单测传入混合器械目录和 knee/shoulder/back 约束，逐项检查输出动作 metadata。
- 已知假绿灯：只在 notes 写“注意膝盖”，动作列表仍包含深蹲；负向断言直接检查 `plan.exercises` 和 `plan.sessions[*].exercises`。

判据 3：机器 · 有训练历史时优先保留有真实基线的熟悉动作；没有训练历史时仍能从合规动作目录生成 starter 计划；目标重量无真实基线时必须为 null。

- 度量：生成器和 agent 单测分别覆盖有历史、空历史、空目录；空历史+非空目录必须返回非空计划，空目录保持无计划。
- 已知假绿灯：用任意固定动作伪造“starter”，绕过器械约束；空历史用例必须只允许输入目录里的合规动作。

判据 4：机器 · 计划包含 `训练日 1..N` 的灵活训练日结构，N 来自本次请求偏好，否则来自运动员档案；每个训练日有时长预算、动作列表、组次、休息，并保留扁平 exercises 供旧依从度算法使用。

- 度量：生成器单测断言 session 数、连续 index、每条动作归属、rest_seconds 与扁平集合一致；planned-workout service 单测断言新旧 JSON 结构都可接受。
- 已知假绿灯：UI 把同一扁平列表重复画成 N 天；断言各 session 的动作分配与扁平聚合来自结构化输出。

判据 5：机器 · 草案支持删除、替换为生成器给出的合规替代动作、调整组数/次数/休息；编辑后的草案才是接受 API 的请求体。

- 度量：纯函数 editor 单测 + planned-workout-api 单测，检查编辑后的 session 和扁平 exercises 同步且 wire body 使用编辑值。
- 已知假绿灯：页面显示编辑值，接受时仍提交原 message.plan；API 单测必须以编辑结果作为入参并逐字段断言。

判据 6：人工 · 用户在助手页选择“下周训练草案”后，可见一页式“本周计划设置”；已有档案自动展示，用户只改临时训练天数、时长、器械、状态、重点部位，生成后按训练日查看和编辑，再设为本周计划。

- 验收者：用户。
- 操作：登录本地页面 → 助手 → 下周训练草案 → 修改至少一项本周条件 → 发送 → 展开训练日 → 删除或替换一个动作 → 修改一个组数或休息 → 设为本周计划 → 查看顶部当前计划。
- 观察点：条件摘要、生成 loading、训练日结构、修改立即可见、当前计划显示修改后的训练日与动作。
- 已知假绿灯：只验证静态截图，没有真实发送和接受请求；人工验收必须走完整客户端路径。

判据 7：机器 · 旧计划快照和没有 `plan_preferences` 的旧客户端请求不报错，现有计划依从度仍按扁平动作及组数计算。

- 度量：现有 planned-workout、assistant agent、structured-output 回归测试全通过，再运行 `pnpm verify`。
- 已知假绿灯：只跑新增测试；最终必须运行仓库级 verify。

## 边界与限定词

- “本周”训练条件来自当前 assistant turn 的 `plan_preferences`，只用于这次生成，不写回 athlete profile。
- “已有档案”来自运行时 `GET /api/athlete-profile` 与服务端 `getAthleteProfile(userId)`。
- “训练历史”来自本次 assistant date resolver 解析出的 `start_date/end_date` 范围及周报工具结果。
- “当前计划”来自运行时 `GET /api/planned-workouts/current`。
- 训练日是灵活序号，不绑定具体星期。

冲突检查：已通读，无冲突。实现完成后的本地验收已通过，候选提交为 `643daaa`；远端推送与最终 SHA 核对在收尾记录中另行证明。

## 用户验收追加范围（2026-08-15）

用户在本地验收中追加了以下直接相关的收口项：

- 计划数据缺少依从度时不得让页面黑屏：新增应用错误边界，并让本周计划卡片安全处理旧快照。
- 登录后补齐的境外数据存储同意，保留明确同意行为和完整告知，但移除原生勾选框；点击主按钮即提交同意，按钮沿用登录页的加载动效。
- 训练页的本周计划可在原卡片内展开，显示训练日、动作、组次和休息，不要求跳转助手页。
- `DATABASE_URL` 指向 `.neon.tech` 时，进程级数据库池改用 Neon 官方的 pg-compatible WebSocket Pool；其余 PostgreSQL 地址仍走既有 `pg` Pool。此项只恢复本地真实数据连接，不改变 API 或数据模型。

这些追加项对应本轮实际新增或修改的 `client/src/components/AppErrorBoundary.tsx`、`client/src/main.tsx`、`client/src/features/auth/ConsentCatchupScreen.tsx`、`client/src/features/training/TrainingPlanCard.tsx`、`server/src/db/pool.ts`、`server/src/db/pool.test.ts`、`server/package.json` 与根 `pnpm-lock.yaml`；相关测试和文档收尾在后续 candidate/evidence commit 中记录。
