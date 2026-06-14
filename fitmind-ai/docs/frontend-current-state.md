# FitMind AI 前端现状盘点

本文基于 2026-05-07 当前仓库中的前端实现整理，供后续 Claude Design 做中文 UI 设计输入，也供后续 Codex 做等价前端重构时校验逻辑边界。

## 1. 当前前端整体结构

当前前端是一个单页、单入口、无正式路由的 React + Vite 应用。

- 当前没有 `react-router` 一类的正式路由系统。
- `client/src/App.tsx` 是唯一的页面级编排入口，负责挂载认证态判断、决定登录前还是登录后渲染什么、初始化并持有多个跨模块共享状态，并把训练记录、确定性分析、AI Assistant 三大块直接堆叠在一个登录后的主页面里。
- 登录前页面就是 `AuthScreen`。
- 登录后页面不是多页应用，而是一个“大工作台式单页”，当前主要功能都集中在同一个主页面内。
- 当前登录后的主页面包含：assistant workspace、recommendation context、training summary、exercise progress、exercise dictionary、workout form、workout log/detail。
- `client/vite.config.ts` 当前 dev server 端口是 `5173`，本地访问地址默认是 `http://localhost:5173`。
- Vite proxy 规则是把 `/api` 代理到 `http://localhost:3000`。
- `client/src/services/http-client.ts` 里还支持 `VITE_API_BASE_URL`。如果该环境变量未设置，则前端使用相对路径请求，依赖 Vite proxy 转发；如果设置了，则直接请求对应 base URL。

## 2. 登录前页面

`client/src/features/auth/AuthScreen.tsx` 当前提供最小认证入口。

- 支持注册。
- 支持登录。
- 注册模式下额外支持可选 `display_name`。
- 表单提交时调用外部传入的 `onRegister` 或 `onLogin`。

token 保存逻辑在 `client/src/features/auth/use-auth.ts`。

- token 保存在模块级变量 `activeToken` 中。
- 当前是纯内存保存，不写入 `localStorage`。
- 不写入 `sessionStorage`。
- 不写入 cookie。
- 页面刷新后 session 会丢失，这是当前设计的一部分，不是 bug。

登录状态影响 `App.tsx` 的方式如下。

- `App.tsx` 调用 `useAuth()` 取得 `auth` 状态。
- 当 `auth.status === "authenticated"` 且 `auth.user` 存在时，渲染登录后的主页面。
- 其他状态下渲染 `AuthScreen`。
- 认证失败时 `use-auth.ts` 会把状态切到 `error`，同时保留错误文案，`AuthScreen` 会显示错误信息。

当前登录页 UI 问题比较明显。

- 只有最基础表单，没有正式产品级布局。
- 登录和注册切换只是两个普通按钮，层级弱。
- 文案是英文，且明显带阶段性开发说明。
- 没有品牌化视觉。
- 没有更完整的空态、错误态、提交态设计。
- 和登录后页面的视觉语言不统一。

## 3. 登录后主页面模块

### 3.1 WorkoutForm

- 用户看到什么：一个训练创建表单，包含 `performed_at`、`duration_minutes`、`notes`、多条 set 草稿、提交按钮、错误提示、成功提示、创建结果。
- 用户能做什么：填写训练时间、时长、备注，按 set 搜索动作、选择动作、填写 reps/weight/rpe/notes/warm-up，新增或删除 set，最后创建 workout。
- 依赖哪些 props/state：依赖 `token` 和 `onCreated`；内部状态由 `useWorkoutForm(token)` 管理。
- 调用哪些 hook/api：调用 `useWorkoutForm`；`useWorkoutForm` 内部调用 `searchExercises` 和 `createWorkout`。
- 和其他模块的联动：创建成功后，`App.tsx` 里的 `onCreated` 会刷新 workout list、training summary、recommendation context；若当前已经选中过 progress exercise，还会刷新 exercise progress。

### 3.2 ExercisePicker

- 用户看到什么：动作词典搜索表单和结果列表。
- 用户能做什么：按关键词和肌群搜索动作，查看动作英文名、中文名、equipment、primary muscles。
- 依赖哪些 props/state：依赖 `exercises`、`muscleGroups`、加载态、错误态、`onSearch`。
- 调用哪些 hook/api：组件自身不直接调 API；由 `App.tsx` 注入 `useExerciseSearch()` 的状态和 `searchExercises` 方法。
- 和其他模块的联动：当前基本独立，主要是词典浏览，不直接驱动 workout form 或 assistant。

### 3.3 SetEditor

- 当前仓库中不存在独立的 `client/src/features/training/SetEditor.tsx`。
- 现状是 set 编辑 UI 直接写在 `WorkoutForm.tsx` 中。
- set 的状态、校验、动作搜索、动作选中、`set_index` 计算逻辑集中在 `use-workout-form.ts`。
- 后续 UI 重构可以把它拆成独立组件，但当前并没有这个边界。

### 3.4 WorkoutsPanel

- 用户看到什么：workout 列表、刷新按钮、每条 workout 的查看和删除按钮，以及选中 workout 的 detail 区。
- 用户能做什么：刷新列表、查看 detail、删除 workout。
- 依赖哪些 props/state：依赖 `workouts`、`selectedWorkoutId`、`selectedWorkout`、list/detail/delete 的 loading 与 error，以及 `onRefresh`、`onSelectWorkout`、`onDeleteWorkout`。
- 调用哪些 hook/api：组件本身不直接调 workout API；外部由 `useWorkouts` 提供数据和动作。组件内部有一个 `useExerciseNames()`，会调用 `searchExercises({})` 加载动作 id 到英文名的映射，用于 detail 里显示 set 的动作名称。
- 和其他模块的联动：删除成功后会通过 `App.tsx` 的 `handleDeleteWorkout` 触发 training summary、recommendation context、exercise progress 的后续刷新。

### 3.5 TrainingSummaryPanel

- 用户看到什么：30 天训练统计卡片和 top exercises 列表。
- 用户能做什么：刷新 summary，点击某个 exercise 作为 progress 查看目标。
- 依赖哪些 props/state：依赖 `summary`、`isLoading`、`errorMessage`、`onRefresh`、`onExerciseSelect`、`selectedExerciseId`。
- 调用哪些 hook/api：组件本身不直接请求；由 `App.tsx` 注入 `useTrainingSummary(auth.token)` 的结果。
- 和其他模块的联动：点击 exercise 会调用 `App.tsx` 的 `handleExerciseSelect`，更新 `selectedProgressExerciseId` 和 `selectedProgressExerciseName`，进而影响 `ExerciseProgressPanel` 和 assistant 的 quick prompt。

### 3.6 ExerciseProgressPanel

- 用户看到什么：当未选动作时显示提示；选中动作后显示该动作 30 天内的 workouts、sets、reps、volume、max weight、estimated 1RM，以及 recent sessions。
- 用户能做什么：当前只读查看。
- 依赖哪些 props/state：依赖 `token`、`selectedExerciseId`、`selectedExerciseName`、`refreshSignal`。
- 调用哪些 hook/api：组件内部直接调用 `getExerciseProgress`。
- 和其他模块的联动：依赖 summary 面板的动作选择；也依赖 `App.tsx` 在 create/delete workout 后推送的 `progressRefreshSignal`。

### 3.7 RecommendationContextPanel

- 用户看到什么：deterministic recommendation context preview，包括 summary、focus exercises、recent workouts、evidence snapshot。
- 用户能做什么：刷新 context、查看规则和证据，不做 AI 对话。
- 依赖哪些 props/state：依赖 `token` 和 `refreshSignal`。
- 调用哪些 hook/api：组件内部直接调用 `getRecommendationContext`。
- 和其他模块的联动：当 create/delete workout 后，`App.tsx` 会增加 `recommendationContextRefreshSignal`，驱动它重新拉取。

### 3.8 AssistantWorkspace

- 用户看到什么：一个 demo/workspace 式 assistant 外层容器，展示当前 assistant 架构流程、三种 deterministic tools、状态机 chips、session continuity 信息。
- 用户能做什么：主要是理解 assistant 当前链路，不直接发消息；真正的交互在 `AssistantChatPanel`。
- 依赖哪些 props/state：依赖 `token`、`selectedExerciseId`、`selectedExerciseName`。
- 调用哪些 hook/api：内部调用 `useAssistantChat(token)`。
- 和其他模块的联动：复用当前页面中已选中的 exercise 作为 assistant exercise progress quick prompt 的上下文。

### 3.9 AssistantChatPanel

- 用户看到什么：quick prompts、消息输入框、send/stop/retry/clear conversation 按钮、当前状态、active tool call、消息列表。
- 用户能做什么：发送 assistant 请求、停止流式回答、重试上一轮、清空对话、选择 quick prompt。
- 依赖哪些 props/state：依赖 `chat`、`token`、`selectedExerciseId`、`selectedExerciseName`。
- 调用哪些 hook/api：不直接调 API；调用 `chat.sendMessage`、`chat.abort`、`chat.retryLast`、`chat.clearConversation`。
- 和其他模块的联动：exercise progress quick prompt 必须复用当前 selected exercise；未选动作时该 quick prompt 按钮禁用。

### 3.10 AssistantToolCallCard

- 用户看到什么：当前活动中的 deterministic tool call 卡片；如果没有活动中的 tool call，则显示等待提示。
- 用户能做什么：只读查看 tool name、status、duration。
- 依赖哪些 props/state：依赖 `toolCall`。
- 调用哪些 hook/api：不直接调 hook/api。
- 和其他模块的联动：它展示的数据完全来自 `useAssistantChat` 根据 SSE `tool_call_started` / `tool_call_finished` 事件组装出来的 `activeToolCall`。

## 4. App.tsx 当前管理的核心状态

`client/src/App.tsx` 是当前前端真正的页面编排中枢。

它直接管理或组合了以下核心状态。

- `auth`：来自 `useAuth()`，决定页面是否进入登录后主页面。
- `exerciseSearch`：来自 `useExerciseSearch()`，给 `ExercisePicker` 使用。
- `trainingSummary`：来自 `useTrainingSummary(auth.token)`，给 `TrainingSummaryPanel` 使用。
- `workouts`：来自 `useWorkouts(auth.token)`，给 `WorkoutsPanel` 使用。
- `selectedProgressExerciseId`：当前被选中用于查看 exercise progress，也会给 assistant quick prompt 复用。
- `selectedProgressExerciseName`：和上面的 id 配套，用于 progress panel 标题和 assistant quick prompt 文案。
- `progressRefreshSignal`：一个数字信号量，用来强制 `ExerciseProgressPanel` 重新拉取数据。
- `recommendationContextRefreshSignal`：一个数字信号量，用来强制 `RecommendationContextPanel` 重新拉取数据。

这些状态之间的关系如下。

- `auth.token` 是训练记录、确定性分析、assistant 三大块的共同前置条件。
- `selectedProgressExerciseId` 由 `TrainingSummaryPanel` 的点击行为驱动。
- `ExerciseProgressPanel` 直接消费 `selectedExerciseId`。
- `AssistantWorkspace` 也消费 `selectedProgressExerciseId` 和 `selectedProgressExerciseName`。
- `progressRefreshSignal` 不决定看哪个动作，只决定“对当前已选动作重新拉取一次”。
- `recommendationContextRefreshSignal` 用于让 recommendation context 重新计算一次。

创建 workout 后的刷新链路。

- `WorkoutForm` 创建成功后会触发 `App.tsx` 传入的 `onCreated`。
- `onCreated` 里先并行执行 `workouts.refreshWorkouts()` 和 `trainingSummary.refresh()`。
- 然后 `recommendationContextRefreshSignal + 1`，驱动 `RecommendationContextPanel` 刷新。
- 如果此时 `selectedProgressExerciseId !== null`，再执行 `progressRefreshSignal + 1`，驱动 `ExerciseProgressPanel` 刷新。

删除 workout 后的刷新链路。

- `WorkoutsPanel` 调用 `App.tsx` 的 `handleDeleteWorkout`。
- `handleDeleteWorkout` 先执行 `workouts.deleteWorkoutById(workoutId)`。
- 删除成功后执行 `trainingSummary.refresh()`。
- 然后 `recommendationContextRefreshSignal + 1`。
- 如果当前已选动作不为空，再执行 `progressRefreshSignal + 1`。

summary 点击动作后的联动。

- `TrainingSummaryPanel` 点击某个 exercise。
- `App.tsx` 的 `handleExerciseSelect(exerciseId, exerciseName)` 被调用。
- `selectedProgressExerciseId` 和 `selectedProgressExerciseName` 同步更新。
- `ExerciseProgressPanel` 因依赖 `selectedExerciseId` 变化而自动重新请求。
- assistant 的 Exercise progress quick prompt 也同步获得新的 exercise 上下文。

assistant 的 exercise progress quick prompt 复用逻辑。

- `App.tsx` 把 `selectedProgressExerciseId` 和 `selectedProgressExerciseName` 传给 `AssistantWorkspace`。
- `AssistantChatPanel` 在 quick prompt 里直接用这两个值。
- 若没有 selected exercise，则 Exercise progress quick prompt 按钮禁用。
- 若有 selected exercise，则发送 assistant 请求时带上 `exercise_id`。

## 5. Training CRUD 数据流

### 5.1 ExercisePicker 如何搜索动作

- `App.tsx` 调用 `useExerciseSearch()`。
- `useExerciseSearch()` 初始化时先调用 `listMuscleGroups()` 拉肌群字典。
- 用户在 `ExercisePicker` 填关键词和肌群后提交。
- `ExercisePicker` 调用外部 `onSearch({ muscle, q })`。
- `useExerciseSearch()` 内部调用 `searchExercises({ muscle, q })`。
- `dictionary-api.ts` 最终请求 `/api/exercises`，通过 query string 传 `q` 和 `muscle`。

### 5.2 WorkoutForm 如何组织 performed_at、notes、sets

- `WorkoutForm` 本身主要负责渲染。
- 真正的表单状态在 `use-workout-form.ts`。
- `performedAt` 用浏览器 `datetime-local` 输入，内部是本地时间格式字符串。
- 提交时 `buildCreateWorkoutRequest` 会把它转成 `Date`，再转成 `toISOString()`，作为 `performed_at`。
- `notes` 最终以 `notes` 字段提交，空字符串会 trim 后转成 `undefined`。
- 每条 set 草稿包含：`exerciseId`、`exerciseName`、`exerciseQuery`、`exerciseResults`、`isSearchingExercises`、`reps`、`weightKg`、`rpe`、`notes`、`isWarmup`。

### 5.3 SetEditor 如何编辑动作组

- 当前没有独立 `SetEditor` 组件。
- 每条 set 的编辑 UI 直接在 `WorkoutForm.tsx` 中循环 `form.setDrafts` 渲染。
- 每条 set 可以搜索动作、选择动作、编辑 reps / weight / rpe / notes / warm-up、删除当前 set。
- 整体可以新增 set。

### 5.4 set_index 逻辑是否在前端处理

- 是，当前在前端处理。
- `use-workout-form.ts` 中的 `assignSetIndexes()` 会在提交前按 `exercise_id` 分组递增。
- 规则是同一个 `exercise_id` 的第 1、2、3 组分别得到 `set_index = 1, 2, 3`。
- 这说明当前前端承担了 `set_index` 的提交约定，不是后端补全。

### 5.5 提交后调用哪个 API

- `use-workout-form.ts` 的 `submitWorkout()` 调用 `createWorkout(token, payload)`。
- `workout-api.ts` 通过 `requestJson` 发送 `POST /api/workouts`。

### 5.6 创建成功后哪些 UI 会更新

- `WorkoutForm` 自己会显示 success message 和 created workout id。
- 表单会 reset 回默认值。
- `App.tsx` 会刷新 workout list。
- `App.tsx` 会刷新 training summary。
- `App.tsx` 会刷新 recommendation context。
- 如果当前已经选中过 progress exercise，则也会刷新 exercise progress。

### 5.7 WorkoutsPanel 如何展示列表和详情

- 列表数据来自 `useWorkouts(token)` 的 `workouts`。
- `useWorkouts.refreshWorkouts()` 调用 `listWorkouts(token)`，即 `GET /api/workouts`。
- 点击某个 workout 的 `View` 按钮会调用 `selectWorkout(workoutId)`。
- `selectWorkout` 内部调用 `getWorkoutDetail(token, workoutId)`，即 `GET /api/workouts/:id`。
- detail 里展示：performed at、duration、notes，以及每条 set 的动作名、`set_index`、reps、weight、rpe、warm-up、set notes。

### 5.8 删除 workout 后如何刷新相关面板

- `WorkoutsPanel` 上点击删除会先经过浏览器 `window.confirm`。
- 确认后调用 `onDeleteWorkout(workoutId)`。
- `App.tsx` 的 `handleDeleteWorkout` 删除成功后，会刷新 summary、recommendation context，以及当前选中动作的 progress。
- `useWorkouts.deleteWorkoutById` 还会立刻把该项从本地 `workouts` 列表中过滤掉。
- 如果删掉的是当前 detail 选中的 workout，还会清空 `selectedWorkoutId` 和 `selectedWorkout`。

## 6. Deterministic Analysis 数据流

### 6.1 TrainingSummaryPanel

- 默认日期范围是最近 30 天。
- 具体实现是 `use-training-summary.ts` 初始化时 `today - 29 days` 到 `today`，都是日期粒度 `YYYY-MM-DD`。
- 调用的 API 是 `getTrainingSummary(token, { startDate, endDate })`。
- 对应请求路径是 `GET /api/training/summary?start_date=...&end_date=...`。
- 显示的 totals 有：`workout_count`、`set_count`、`total_reps`、`total_volume`。
- 显示的 exercise summary 来自 `summary.by_exercise`，当前 UI 只取前 5 个 `topExercises`。
- 每个 exercise item 显示：`exercise_name`、`set_count`、`total_reps`、`total_volume`。
- 点击 exercise 后，会调用 `onExerciseSelect(exercise.exercise_id, exercise.exercise_name)`，从而驱动 `App.tsx` 更新当前 selected exercise。

### 6.2 ExerciseProgressPanel

- 它强依赖 `selectedProgressExerciseId`。
- 在组件 props 里对应 `selectedExerciseId`。
- 没选动作时，不发请求，只显示“请先从 summary 里选一个动作”的说明。
- 选中动作后，组件内部调用 `getExerciseProgress(token, { startDate, endDate, exerciseId })`。
- 对应请求路径是 `GET /api/training/exercise-progress?start_date=...&end_date=...&exercise_id=...`。
- 显示的 progress 信息包括：
- totals：`workout_count`、`set_count`、`total_reps`、`total_volume`、`max_weight_kg`、`estimated_1rm_kg`
- sessions：每次训练的 `performed_at`、`set_count`、`total_reps`、`total_volume`、`max_weight_kg`、`estimated_1rm_kg`
- create workout 后，如果当前已有 selected exercise，`App.tsx` 会递增 `progressRefreshSignal`，该面板因依赖此 signal 而重新拉取。
- delete workout 后，如果当前已有 selected exercise，也会走同样的 refresh signal 逻辑。

### 6.3 RecommendationContextPanel

- 调用的 API 是 `getRecommendationContext(token, { startDate, endDate })`。
- 对应请求路径是 `GET /api/training/recommendation-context?start_date=...&end_date=...`。
- 当前展示的数据包括：`summary`、`focus_exercises`、`recent_workouts`、`evidence`。
- `summary` 里有 workout/set/reps/volume 总量和 `by_exercise`。
- `focus_exercises` 展示重点动作的 workout/set/reps/volume/max weight/estimated 1RM。
- `recent_workouts` 展示近期训练记录的时间、set_count、volume、notes。
- `evidence` 展示：`source`、`workout_ids`、`set_ids`、`calculation_rules`。
- 它之所以只是 deterministic context preview，而不是 AI 生成建议，是因为当前前端只是把后端“确定性计算层输出的上下文包”可视化出来，便于后续 tool calling 或 LLM 解释复用；它本身不承担生成式推荐，不做模型推理。

## 7. Assistant SSE 数据流

### 7.1 AssistantWorkspace 的作用

- 它是 assistant 区的外层工作台容器。
- 内部调用 `useAssistantChat(token)`，拿到当前会话状态。
- 把当前 assistant 流程拆成可见的 demo 卡片：Training logs、Deterministic tools、Provider adapter、SSE stream、Assistant answer。
- 还负责展示当前 provider、状态机、sessionId。
- 最后把 `chat` 和当前 selected exercise 上下文传给 `AssistantChatPanel`。

### 7.2 AssistantChatPanel 的作用

- 它是实际交互面板。
- 负责 quick prompts、输入框、发送、停止、重试、清空会话。
- 负责根据 mode 组织 assistant payload。
- 负责把 `selectedExerciseId` 复用进 exercise progress quick prompt。
- 负责展示 `AssistantToolCallCard` 和 `AssistantMessageList`。

### 7.3 use-assistant-chat 的作用

- 它是当前 assistant 前端状态机核心。
- 维护消息数组 `messages`。
- 维护状态 `status`：`idle`、`thinking`、`tool_calling`、`answering`、`done`、`error`。
- 维护当前活动 tool call：`activeToolCall`。
- 维护错误：`errorMessage`。
- 维护是否正在流式：`isStreaming`。
- 维护 provider：`provider`。
- 维护跨多轮复用的 `sessionId`。
- 维护 `lastSubmittedPayload`，供 retry 使用。
- 维护 `AbortController`。

### 7.4 assistant-stream-api 如何请求后端 SSE

- `streamAssistantChat(payload, { token, signal, onEvent })` 通过 `fetch` 发送 `POST /api/assistant/stream-turn`。
- 请求头是 `Accept: text/event-stream`、`Content-Type: application/json`、`Authorization: Bearer <token>`。
- 如果响应不是 `text/event-stream`，则按普通错误 JSON 解析并走 `HttpClientError` 约定。
- 如果响应是 SSE，则读取 `response.body` 的 stream，手动按 `\n\n` 切 frame。
- 每个 frame 都要求同时有 `event: xxx` 和 `data: {...}`。
- 前端还会校验：SSE 的 `event` 名称必须和 payload 里的 `type` 一致，否则判定为 `INVALID_RESPONSE`。

### 7.5 发送消息后前端状态如何变化

- `sendMessage(payload)` 首先校验 token 和 message。
- 若已有上一轮流请求，会先 abort。
- 然后创建新的 `AbortController`、user message id、assistant message id。
- 把真正发送的 payload 标准化，其中 `session_id` 优先取当前 hook 内已有的 `sessionId`。
- 立刻把用户消息加入 `messages`。
- 同时加入一条空文本的 assistant 占位消息，`isStreaming: true`。
- 然后把状态切到 `isStreaming = true`、`status = "thinking"`、`activeToolCall = null`、`provider = null`。
- 最后开始消费 SSE 事件。

### 7.6 如何解析 SSE events

当前前端支持的项目内事件类型在 `assistant-types.ts` 中定义。

- `state`
- `session`
- `provider_selected`
- `tool_call_started`
- `tool_call_finished`
- `answer_delta`
- `done`
- `error`

`useAssistantChat.handleStreamEvent()` 的处理方式如下。

- `state`：直接更新 `status`
- `provider_selected`：更新 `provider`
- `session`：更新 `sessionId`
- `tool_call_started`：把状态切到 `tool_calling`，并创建 `activeToolCall = { toolName, status: "running" }`
- `tool_call_finished`：更新 `activeToolCall = { toolName, status, durationMs }`
- `answer_delta`：把状态切到 `answering`，并把文本追加到当前 assistant 消息
- `done`：结束流式、状态置为 `done`、必要时更新 `sessionId`、保留非 running 的 tool call、把 assistant 消息 `isStreaming` 置为 false
- `error`：结束流式、状态置为 `error`、写入错误文案、把 assistant 消息 `isStreaming` 置为 false

### 7.7 answer_delta 如何拼接成最终回答

- 每次收到 `answer_delta`，都会遍历 `messages`。
- 找到当前这轮对应的 assistant 占位消息。
- 执行 `text = currentText + event.text`。
- 因此最终回答是由多个 `answer_delta` 顺序拼接出来的 plain text。

### 7.8 stop / retry / clear conversation 的逻辑

- `stop`：调用 `abort()`，内部会 `controller.abort()`，立即把 `isStreaming` 设为 false，状态切回 `idle`，清空 `activeToolCall`；随后 abort 会被 catch 到，hook 会把当前 assistant 消息结束掉，但保留已流出的部分文本。
- `retry`：调用 `retryLast()`；前提是已有 `lastSubmittedPayload` 且当前不在 streaming；会重新调用 `sendMessage()`，并继续带当前 sessionId。
- `clear conversation`：调用 `clearConversation()`；会 abort 当前流，并清空 `messages`、`status`、`activeToolCall`、`errorMessage`、`provider`、`sessionId`、`lastSubmittedPayload`。

### 7.9 sessionId 如何从后端保存

- 后端如果先发 `session` 事件，前端会立刻执行 `setSessionId(event.session_id)`。
- 后端如果在 `done` 事件里也带了 `session_id`，前端会再次兜底保存。
- 因此前端支持两种来源：`session` event 是主来源，`done.session_id` 是 fallback。

### 7.10 下一轮 sendMessage 如何带回 sessionId

- `sendMessage()` 组装 `requestPayload` 时，会写入 `session_id: sessionId ?? payload.session_id`。
- 也就是说一旦 hook 内已经保存了 sessionId，后续每一轮都会自动复用，不需要面板层自己管理。

### 7.11 providerSelected 如何显示

- 来源完全是 SSE `provider_selected` 事件。
- `useAssistantChat` 收到后写入 `provider`。
- `AssistantWorkspace` 用 `chat.provider` 展示当前 provider adapter。

### 7.12 activeToolCall 如何显示

- 来源完全是 SSE `tool_call_started` / `tool_call_finished` 事件。
- `AssistantToolCallCard` 只读展示 `toolName`、`status`、`durationMs`。
- 当前不会自行推断 tool call，也不会从消息文本中反推。

### 7.13 AssistantToolCallCard 展示什么

- 无活动 tool call 时：显示等待 deterministic tool call 的说明。
- 有活动 tool call 时：显示 tool 名称、当前状态 `running/success/error`、可选耗时 `durationMs`。

## 8. Assistant 当前支持的 quick prompts

当前 quick prompts 在 `AssistantChatPanel.tsx` 中硬编码为三种。

- `Training overview`
- 对应 `mode: "training_overview"`
- 默认 message 是 `show me my training overview`
- 意图是走训练总览类 deterministic tool，当前可视层面对应 `get_training_summary`

- `Exercise progress`
- 对应 `mode: "exercise_progress"`
- 默认 message 是 `show me <selected exercise> progress`
- 意图是走动作进展类 deterministic tool，当前可视层面对应 `get_exercise_progress`
- 它依赖当前 `selectedExerciseId`
- 若没有 selected exercise，按钮会直接 disabled

- `Recommendation context`
- 对应 `mode: "recommendation_context"`
- 默认 message 是 `build deterministic recommendation context`
- 意图是走 recommendation context 类 deterministic tool，当前可视层面对应 `get_recommendation_context`

关于 Exercise progress quick prompt 的当前提示方式。

- 现在的页面已经做了基础提示。
- 没有 selected exercise 时，按钮禁用。
- 同时 helper text 明确写着：需要先在 training summary panel 里选一个 exercise。
- 后续中文 UI 设计阶段应保留这种依赖关系，但可把提示做得更产品化、更中文化。

## 9. 当前前端 UI 问题

当前页面已经能演示主要能力，但明显还是开发态拼装界面。

- 页面信息密度过高。
- 组件堆叠明显，登录后内容按顺序一块块直排。
- 英文技术词较多，不适合中文演示。
- assistant workspace 更像架构调试面板，不像正式产品。
- training 数据区、确定性分析区、AI assistant 区之间层级不够清楚。
- 用户不容易一眼理解“真实训练日志 -> 确定性分析 -> tool calling -> AI 回答”的关系。
- 空状态、错误状态、加载状态大多是工程提示语，还不够产品化。
- 当前多个模块的视觉风格不统一。
- `WorkoutForm`、`AuthScreen`、`WorkoutsPanel` 仍是非常原始的 HTML 表单风格。
- 三个 deterministic panels 使用了深色卡片内联样式。
- `AssistantWorkspace` 又是浅色卡片工作台风格。
- 页面存在“开发阶段说明文案”与“业务功能文案”混杂的问题。
- 本地运行说明和页面访问路径虽然能从代码推断，但还缺少面向设计/演示使用者的明确文档化说明。

## 10. 后续 UI 重构不能破坏的逻辑

这是后续重构最重要的约束清单。可以重做视觉和组件拆分，但以下逻辑必须保留，或在重构时做等价迁移。

- 不改后端 API 路径。
- 不改 SSE event contract。
- 不改 auth token 的内存保存逻辑。
- 不把 token 写入 `localStorage` / `sessionStorage` / cookie。
- 不改 `http-client` 的错误处理约定。
- 不改 workout create/list/detail/delete 数据流。
- 不改 `set_index` 的前端提交约定。
- 不改 `TrainingSummaryPanel` 当前对应的数据语义：30 天日期范围、totals 语义、by-exercise summary 语义。
- 不改 `ExerciseProgressPanel` 的 selected exercise 联动逻辑。
- 不改 `RecommendationContextPanel` 的 deterministic preview 定位；它不是 AI 生成建议面板。
- 不改 `use-assistant-chat` 的状态机语义：`idle`、`thinking`、`tool_calling`、`answering`、`done`、`error`。
- 不改 `sessionId` 的跨多轮复用逻辑。
- 不改 `activeToolCall` 的数据来源；它必须继续来自 SSE tool lifecycle events。
- 不改 `providerSelected` 的数据来源；它必须继续来自 SSE `provider_selected` event。
- 不改 quick prompt 对应的 `mode` / payload 语义。
- 不改 `App.tsx` 里 create/delete 之后的 refresh 联动，除非新架构里做等价迁移。

从当前代码看，尤其需要保留的具体联动有：

- 创建 workout 后刷新 workouts list。
- 创建 workout 后刷新 training summary。
- 创建 workout 后刷新 recommendation context。
- 创建 workout 后，如果已有 selected exercise，则刷新 exercise progress。
- 删除 workout 后刷新 training summary。
- 删除 workout 后刷新 recommendation context。
- 删除 workout 后，如果已有 selected exercise，则刷新 exercise progress。
- 点击 training summary 中的 exercise 后，必须继续驱动 exercise progress 和 assistant quick prompt。

## 11. 建议给 UI 设计阶段的输入

给 Claude Design 的建议摘要如下。

- 当前产品应被设计成“FitMind AI 训练分析工作台”。
- 页面应全中文。
- 页面结构应突出三块：训练记录、确定性分析、AI 助手。
- AI 助手需要把 tool calling 过程可视化。
- 技术标签可以保留，例如 `get_training_summary`，但主要文案应中文化。
- 建议整体风格：简洁、SaaS 工作台、卡片布局、浅色背景、少动画、强信息层级、适合面试演示。
- 设计上应帮助用户理解完整链路：训练记录是原始事实输入，确定性分析是结构化中间层，AI 助手通过 tool calling 消费这些结构化结果，SSE 只是前端展示流式回答的交互层。

## 12. 本次任务限制

本次盘点按 docs-only 约束执行。

- 新增了 `docs/frontend-current-state.md`。
- 不修改 `client/src/**`。
- 不修改 `server/src/**`。
- 不修改 `package.json`。
- 不修改 `vite.config.ts`。
- 不修改 `env.ts`。
- 不修改任何业务代码。

补充说明。

- 你要求重点阅读的 `client/src/features/training/SetEditor.tsx`，当前仓库中并不存在。
- 当前 set 编辑能力已被内联进 `WorkoutForm.tsx` 与 `use-workout-form.ts`。

## 计划草案卡片（AssistantPlanCard，2026-06-14，roadmap §8 FE-1）

助手消息带结构化 `plan`（`next_week_plan` 草案）时，在消息气泡里（agent trace 之下、Evidence 之上）渲染 `AssistantPlanCard`：策略 chip + 动作行（名称 / 目标重量 / "N 组 × a~b 次" / basis）+ notes。`plan` 由 `mergeStructuredOutputIntoMessage` 的 `normalizePlan` 从 `structured_output.plan` 归一化到 `message.plan`。目标重量为 null 时显示"沿用上次重量"（不编造）。详见 `UI_SPEC.md §4.3.3`。

## 本周计划 + 接受计划（2026-06-14，roadmap §8 FE-2）

心智模型=本周「目标动作集」：接受一次设为本周目标，常驻卡片哪天打开都在，真实训练按周自动匹配依从度（不强排到具体某天）。

- `planned-workout-api.ts`：`getCurrentPlannedWorkout` / `acceptPlannedWorkout`（周期=今天起 7 天，client 端 `denormalizePlanDraft` 转回 snake_case）/ `abandonPlannedWorkout`。
- `use-current-plan.ts`：hook，token 变化时拉 `GET /current`，暴露 `accept`/`abandon`/`refresh` + status/isMutating/actionError。
- `AssistantCurrentPlanCard.tsx`：常驻在助手页顶部（`AssistantWorkspace` 内，IntroCard 之下）。计划 + 逐动作 done/partial/missed 状态 chip + 依从比例进度条 + 放弃按钮；空/加载/错误态齐全。
- 接受按钮：`AssistantPlanCard` 底部「设为本周计划」，handler 在 `AssistantChatPanel`（accepting/accepted by message.id），drill 路径同 `onSaveInsight`（panel→list→bubble→plan card）；接受成功后 hook.accept 内部 refresh 顶部卡片。

约束补充：accept 的周期窗口固定为接受当天起 7 天；目标重量为 null 的动作不编造数字。
