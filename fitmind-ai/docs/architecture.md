# 架构文档（architecture.md）

> 这份文档说明 FitMind AI 的前后端分层、数据流、模块划分。 改动任何分层结构前，先更新这份文档。

------

## 1. 总体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                       Client（React + TS）                   │
│                                                             │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│   │ features │ →  │  hooks   │ →  │ services │             │
│   │ (业务模块)│    │ (复用逻辑)│    │ (API 客户端)│           │
│   └──────────┘    └──────────┘    └──────────┘             │
│         ↓               ↓                ↓                 │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│   │components│    │  store   │    │  utils   │             │
│   │ (纯 UI)  │    │ (Zustand)│    │ (纯函数)  │             │
│   └──────────┘    └──────────┘    └──────────┘             │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTPS / SSE
┌─────────────────────────────────────────────────────────────┐
│                    Server（Express + TS）                    │
│                                                              │
│   routes → controllers → services → db                      │
│              (薄)        (业务逻辑)   (查询)                  │
│                                                              │
│   services 内部分层（合法调用方向）：                           │
│                                                              │
│   AI 编排层 (services/ai)                                     │
│       │  调用                                                │
│       ▼                                                      │
│   计算层 (services/analytics)                                │
│       │  读取                                                │
│       ▼                                                      │
│   仓库层 (db/repositories)                                   │
│  禁止反向：❌ analytics → ai ❌ db → services                │ 
│  ❌ controllers → db（必须经 services）                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL（Neon + pgvector）               │
│                                                              │
│  users / muscle_groups / exercises / exercise_muscles       │
│  workouts / sets / chat_sessions / messages                 │
│  tool_call_logs / knowledge_chunks (扩展阶段)                │
└─────────────────────────────────────────────────────────────┘
```

------

## 2. 前端分层详解

### 2.1 各层职责

| 层           | 职责                | 不能做什么                      |
| ------------ | ------------------- | ------------------------------- |
| `features/`  | 业务功能模块        | 不能直接被 components import    |
| `hooks/`     | 复用逻辑            | 不能渲染 UI                     |
| `services/`  | API 客户端          | 不能 import 任何 React 代码     |
| `store/`     | 全局状态（Zustand） | 不直接发请求（请求走 services） |
| `types/`     | TS 类型             | 纯类型，无运行时代码            |
| `utils/`     | 纯函数工具          | 不能依赖任何业务概念            |
| `constants/` | 常量                | 同上                            |

其中`components/`分为共享展示组件和业务组件。
共享展示组件路径是`components/shared/`或 `components/ui/`，不可以 fetch，不可以读 store，数据来源是props。
业务组件路径是 `features/<domain>/components/`，不可以 fetch，可以读 store（通过 hook），数据来源是hooks + props 。业务组件可以通过 feature 内的 hook 间接使用 store（例如 `useChatSession()` 内部读 `useChatStore`），但**不允许**业务组件直接 `import { useChatStore }` 然后从 store 取业务字段。这样将来 store 实现换掉时，只改 hook 不改组件。

### 2.2 一个典型业务流：用户提交聊天

```
ChatBox 组件（features/chat/ChatBox.tsx）
       ↓ 调用
useStreamChat hook（hooks/useStreamChat.ts）
       ↓ 调用
chatService.streamMessage（services/chat-service.ts）
       ↓ fetch SSE
后端 /api/chat
       ↓ 返回 chunks
useStreamChat 内部维护状态机：thinking → tool_calling → answering → done
       ↓ 通过 setState 更新
ChatBox 渲染对应 UI
       ↓
useChatStore（store/chat-store.ts）持久化会话历史
```

### 2.3 features 模块划分

```
features/
├── auth/          # 登录注册
├── training/      # 训练日志（CRUD、日历视图、动作选择器）
├── chat/          # AI 对话界面
├── dashboard/     # 训练数据可视化（容量分布图、进展曲线）
└── knowledge/     # 动作知识查询（RAG 扩展阶段）
```

### 2.4 SSE 状态机（核心模块）

`hooks/useStreamChat.ts` 内部的状态机：

```
State = 'idle' | 'thinking' | 'tool_calling' | 'answering' | 'done' | 'error' | 'aborted'

分层职责：
  - 后端：消费 Anthropic 原始 stream 事件（content_block_start / content_block_delta / message_stop 等）
          转换成项目自定义 SSE 事件后再推给前端
  - 前端：只消费项目自定义事件，不感知任何 Anthropic 协议细节

项目自定义 SSE 事件类型（详见 docs/api-contract.md 第 6 节）：
  state            后端通知前端切状态：thinking / tool_calling / answering / done
  tool_result      工具调用结果
  text_delta       文本流增量
  structured_output 最终结构化输出
  error            错误事件

前端状态机事件流（消费的是后端转译后的事件）：
  user submits → 'thinking'
  receive event:state {state:'tool_calling'} → 'tool_calling'
  receive event:state {state:'answering'} → 'answering'
  receive event:state {state:'done'} → 'done'
  receive event:error → 'error'
  user clicks abort → 'aborted'

未来换模型时，只需改后端的事件转译层，前端代码无需改动。
```

详细实现在 `docs/ai-decisions.md` 的 SSE 章节。

------

## 3. 后端分层详解

### 3.1 各层职责

| 层             | 职责                         | 不能做什么                              |
| -------------- | ---------------------------- | --------------------------------------- |
| `routes/`      | 路由定义、绑定 controller    | 不能写业务逻辑                          |
| `controllers/` | 解析参数、调 service、返响应 | 不能写 SQL、不能 import 其他 controller |
| `services/`    | 业务逻辑核心                 | 不能直接读 req/res                      |
| `db/`          | 数据库查询封装               | 不能 import services                    |
| `middleware/`  | 鉴权、限流、错误兜底         | 不能 import services（避免循环依赖）    |

### 3.2 services 内部分层

```
services/
├── analytics/                   # 计算层（不依赖 AI）
│   ├── fatigue.ts               # 疲劳分数
│   ├── volume.ts                # 训练容量分布
│   ├── progress.ts              # 进展斜率
│   ├── plateau.ts               # 停滞检测
│   └── __tests__/               # 单元测试
├── ai/                          # AI 编排层
│   ├── anthropicClient.ts       # API 调用封装
│   ├── toolLoop.ts              # Tool Calling 循环（核心）
│   ├── structuredOutput.ts      # JSON Schema 校验输出
│   ├── tools/                   # 工具实现（每个 tool 一个文件）
│   │   ├── getRecoveryStatus.ts
│   │   ├── getProgressAnalysis.ts
│   │   ├── getWeeklyVolumeDistribution.ts
│   │   └── getRecentTrainingSignals.ts
│   └── prompts/
│       ├── system.ts            # 系统提示词
│       └── outputSchema.ts      # JSON 输出 schema
├── rag/                         # RAG（扩展）
├── mcp/                         # MCP（扩展）
└── agent/                       # ReAct Workflow（扩展）
```

### 3.3 数据流：用户问问题

```
POST /api/chat (SSE)
   │
   ▼
[middleware] auth → rateLimit
   │
   ▼
chatController.streamChat(req, res)
   │
   ├─ 拼装 messages（取出会话历史）
   │
   ▼
aiService.streamWithTools(messages)
   │
   ├─ 调用 Anthropic API（stream + tools）
   │
   ├─ 收到 tool_use 事件 ───▶ ai/toolLoop.ts 执行工具
   │                            │
   │                            ▼
   │                      ai/tools/getRecoveryStatus
   │                            │
   │                            ▼
   │                      analytics/fatigue.ts 算分
   │                            │
   │                            ▼
   │                      db/sets-repo.ts 查 sets 表
   │                            │
   │                            ▼
   │                      返回 tool_result
   │
   ├─ 把 tool_result 拼回 messages，再次调 API
   │
   ├─ 收到最终 JSON 输出
   │
   ▼
通过 SSE 把 chunks 推给前端 (res.write)
   │
   ▼
记录 tool_call_logs 到数据库
```

------

## 4. 关键模块设计

### 4.1 Tool Calling 循环（伪代码）

```typescript
async function* streamWithTools(messages, tools) {
  let currentMessages = messages;
  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    const response = anthropic.messages.stream({
      messages: currentMessages,
      tools,
      system: SYSTEM_PROMPT,
    });

    let toolUses = [];
    for await (const chunk of response) {
      yield chunk; // 转发给前端
      if (chunk.type === 'tool_use') toolUses.push(chunk);
    }

    if (toolUses.length === 0) return; // 模型不再调工具，结束

    // 执行所有工具
    const toolResults = await Promise.all(
      toolUses.map(tu => executeTool(tu.name, tu.input))
    );

    // 拼回 messages
    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: toolUses },
      { role: 'user', content: toolResults },
    ];

    iterations++;
  }

  throw new Error('Tool loop exceeded max iterations');
}
```

### 4.2 计算层模块独立性

`analytics/fatigue.ts` **必须**满足：

- 输入：原始训练数据 + 配置参数
- 输出：纯数值结论
- **不依赖** AI、不依赖 HTTP、不依赖具体数据库（通过仓库注入）

这样保证：

- 单元测试好写
- 算法可被任何上层调用（API / MCP / CLI）
- 算法可独立讲清楚（面试加分）

------

## 5. 数据流向规则（防止意大利面架构）

```
合法的依赖方向（→ 表示可以 import）：

  components → hooks → services → 后端
  components → store
  features → components
  features → hooks
  features → services
  features → store

  routes → controllers → services → db
  services/ai → services/analytics → db
  controllers → middleware（间接，通过 app.use）

非法的依赖（CI 必须拦截）：

  ❌ services → components
  ❌ analytics → ai
  ❌ db → services
  ❌ controllers → controllers
```

`AGENTS.md` 第 2 节的分层硬规则就是这一节的简版。AI 写代码时如果违反，立刻打回。

------

## 6. 部署架构

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│  Vercel  │───▶│  Render  │───▶│   Neon   │
│ (Client) │    │ (Server) │    │   (DB)   │
└──────────┘    └──────────┘    └──────────┘
     │              │
     │              ├── 环境变量：
     │              │   ANTHROPIC_API_KEY
     │              │   DATABASE_URL
     │              │   JWT_SECRET
     │              │   VOYAGE_API_KEY (扩展阶段)
     │
     └── 环境变量：
         VITE_API_URL
```

### 环境分离

- 本地：`.env.local` + 本地 PostgreSQL（或 Neon dev branch）
- 生产：Vercel / Render 各自的环境变量

------

## 7. 演进路径

```
现在 ──▶ 阶段 1-5（主线） ──▶ 主线门控 ──▶ 扩展 A/B/C ──▶ 打磨

主线完成时项目大小约：
  - 前端：30-40 个文件
  - 后端：25-35 个文件
  - 文档：8-10 份

主线 + 扩展完成约：
  - 前端：50-60 个文件
  - 后端：50-70 个文件
  - 文档：12-15 份

如果某阶段文件数超出 50% 预期，说明要么过度设计，要么在挖坑——回头审视。
```