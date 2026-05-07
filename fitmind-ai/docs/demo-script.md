# FitMind AI Demo Script

## 1. Demo Positioning

FitMind AI 是一个 AI-assisted training analysis system，不是普通聊天框，也不是单纯的 workout CRUD 页面。  
它把真实训练日志、deterministic calculation layer、内部 Tool Calling、SSE assistant stream 和 evidence-backed assistant UI 串成了一条完整链路。  
用户先记录 workout，系统再基于后端确定性计算生成 summary / progress / recommendation context，最后 AI 助手通过工具读取这些结构化结果来组织解释。  
因此这个项目要展示的重点不是“模型会聊天”，而是“模型如何在受控边界内使用真实训练数据和可追溯 evidence”。  

## 2. Demo Prerequisites

本地启动细节以 [local-run-guide.md](/E:/studyspace/webroad/FitMind/fitmind-ai/docs/local-run-guide.md) 为准。

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`
- 前端通过 Vite proxy 将 `/api` 转发到后端
- 本地演示建议先使用 `ASSISTANT_PROVIDER=mock`
- 如需真实 provider 路径，才切换到 `ASSISTANT_PROVIDER=anthropic`

## 3. Start Services

只使用仓库当前真实脚本：

```bash
pnpm dev:server
```

```bash
pnpm dev:client
```

等价写法：

```bash
pnpm --filter @fitmind/server dev
```

```bash
pnpm --filter @fitmind/client dev
```

如果数据库还没准备好，先按本地指南完成 migration / seed。

## 4. Demo Flow

### Step 1. Open frontend

打开 `http://localhost:5173`。

预期结果：
- 进入中文登录/注册页
- 页面说明 token 只保存在内存，刷新后需要重新登录

### Step 2. Register or log in

注册一个新账号，或直接登录已有账号。

预期结果：
- 登录成功后进入工作台
- 看到底部三 Tab：`训练`、`分析`、`AI 助手`

### Step 3. Go to `训练` Tab

确认当前在训练页，页面包含训练统计、记录训练入口、训练日志和动作词典。

可以说：
“这里先不是 AI，而是真实训练数据入口。后面的分析和助手都建立在这里录入的 workout 之上。”

### Step 4. Create one workout

点击“记录训练”，填写一条 workout。

建议：
- 选择今天时间
- 填一个简短备注
- 选 1 到 2 个常见动作，例如卧推、深蹲、硬拉

### Step 5. Add several sets

给每个动作加几组 set，填写 `reps`、`weight`、可选 `RPE`。

预期结果：
- 可以搜索并选择动作
- 至少保留一组
- 提交后 workout 创建成功

### Step 6. Confirm training stats and workout list update

创建完成后，观察训练页顶部统计和训练日志。

预期结果：
- workout list 立即刷新
- 顶部训练统计刷新
- 新建 workout 出现在训练日志中

可以说：
“这里可以看到 training CRUD 不是孤立的。创建 workout 之后，训练列表和 summary 会一起刷新，后面的分析上下文也会跟着更新。”

### Step 7. Go to `分析` Tab

切到分析页。

预期结果：
- 看到 30 天总览
- 看到重点动作列表
- 看到动作进展面板
- 看到 AI 可用上下文预览

### Step 8. Explain deterministic analysis

重点说明这页是后端 deterministic calculation layer，不是 AI 生成。

依次指出：
- `training summary`：30 天训练次数、总组数、总次数、总容量
- `exercise ranking`：哪些动作在当前范围内贡献了更多 volume
- `exercise progress`：单动作的 max weight、estimated 1RM、最近 session
- `AI usable context preview`：后续助手会读到的 deterministic context package

可以说：
“这页展示的是后端先算好的结构化结果。也就是说，AI 不是直接读原始 workout 表，更不是先编一段话，再回头找理由。”

### Step 9. Select an exercise if needed

在重点动作列表中点击一个动作。

预期结果：
- 该动作被选中
- 动作进展面板显示这个动作的进展
- 后续 AI 助手里的“动作进展” quick prompt 可用

### Step 10. Go to `AI 助手` Tab

切到 AI 助手页。

预期结果：
- 看到状态栏
- 看到 quick prompts
- 看到消息区、工具调用卡、输入框

### Step 11. Use quick prompts

依次演示：
- `训练总览`
- `动作进展`
- `推荐上下文`

其中“动作进展”需要前一步已经选中动作。

预期结果：
- 用户消息先进入消息流
- 助手开始 streaming
- 如果走工具路径，会出现 tool call card

### Step 12. Point out SSE status changes

演示时指出前端状态机会经历：
- `thinking`
- `tool_calling`
- `answering`
- `done`

如果失败，则会进入 `error`。

可以说：
“这里不是等一个阻塞式 HTTP 一次性返回，而是把 assistant turn 拆成了可见阶段，所以用户能知道系统是在思考、在调工具，还是已经开始输出答案。”

### Step 13. Point out tool call card

当 quick prompt 触发工具时，指出工具调用卡上显示的工具名和状态。

当前核心工具：
- `get_training_summary`
- `get_exercise_progress`
- `get_recommendation_context`

预期结果：
- 卡片显示 tool name
- 显示 `running / success / error`
- 成功后可看到 duration

### Step 14. Explain evidence-backed answer

最后强调答案不是“凭空聊出来”的，而是建立在确定性工具结果上。

可以说：
“这里我想展示的不是普通聊天框，而是一个有确定性计算层的 AI 应用。用户提问后，助手不会直接凭空生成回答，而是先通过后端工具读取训练摘要、动作进展或 recommendation context，然后再基于 evidence 组织解释。”  

补充说明：
- 当前可以展示 evidence-backed explanation
- 当前不是 RAG
- 当前不是 MCP
- 当前不是 multi-tool loop
- 当前也没有 tool 执行后的第二次 provider call

## 5. What to Say During Demo

下面是一组可以直接复用的中文讲稿。

### Opening

“FitMind AI 不是一个普通聊天壳，也不是一个单纯记录训练的 CRUD 页面。它的核心价值是把真实训练日志、确定性计算、内部 Tool Calling 和 SSE 流式助手串成一条可解释的 AI 应用链路。”

### On Training Tab

“第一步一定先从训练日志开始，因为真实 workout 是整个系统的事实来源。没有这层真实数据，后面的 summary、progress 和 AI explanation 都没有可信基础。”

### On Analysis Tab

“分析页展示的是 deterministic calculation layer。这里的数字不是模型推断出来的，而是后端根据训练记录和计算规则直接算出来的，所以可以稳定复现，也能回溯到 evidence。”

### On Assistant Tab

“AI 助手这一步也不是直接把原始日志塞进 prompt。它先走受控工具边界，读取训练总览、动作进展或者 recommendation context，再组织成用户看得懂的解释。这能明显降低幻觉风险，也更方便审计。”

### On SSE

“这里使用 SSE 的原因是，用户不需要盲等一个黑盒响应。前端可以明确显示 thinking、tool_calling、answering、done 这些阶段，知道系统现在到底在做什么。”

### On Boundaries

“这个项目当前刻意保留边界：没有 RAG，没有 MCP，没有多工具 agent loop，也没有 tool 执行后的第二次 provider call。重点是先把 deterministic data、tool execution、provider boundary 和 streaming UX 做扎实。”

## 6. Expected Results

### After login

- 成功进入工作台
- 三个主 Tab 可切换

### After creating workout

- 训练日志出现新 workout
- 训练统计更新
- 后续分析页会读取到新的训练数据

### On analysis page

- 30 天 summary 可见
- 可点击重点动作
- 选中动作后能看到 progress
- recommendation context panel 展示 deterministic preview

### On assistant page

- quick prompt 可直接发起请求
- 状态栏出现 `thinking -> tool_calling -> answering -> done`
- tool card 展示实际工具名
- 消息区增量显示回答

## 7. Known Local Issues

- Windows 环境下可能遇到 `vite/esbuild spawn EPERM`
- 当前已有 `client` 目录下 package-local `vite.cmd build` workaround
- 某些目录映射下 Git 可能提示 `dubious ownership`
- 手动 browser smoke 可能需要单独执行，当前不应宣称浏览器 E2E 已完成

## 8. Demo Recovery

### If login fails

- 检查 backend 是否已启动
- 检查 `.env` 中 `JWT_SECRET` 等配置
- 确认当前请求是否打到 `http://localhost:3000`

### If training data does not load

- 检查 `DATABASE_URL`
- 检查 migration / seed 是否已执行
- 检查后端是否成功连接数据库

### If assistant fails

- 先切回 `ASSISTANT_PROVIDER=mock`
- 再确认后端 assistant stream 接口可用
- 如果使用 `anthropic`，确认 `ANTHROPIC_API_KEY` 已正确配置

### If build fails with EPERM

- 使用已记录的 Windows workaround
- 在 `client` 目录执行 `.\node_modules\.bin\vite.cmd build`
