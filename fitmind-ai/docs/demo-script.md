# FitMind AI Demo Script

## 1. Positioning

FitMind AI 当前最适合演示成一个 evidence-backed training analysis product，而不是一个自由聊天机器人。

本轮 demo 的重点不是“模型会不会自由发挥”，而是：

- 训练数据先进入真实 workout log
- 后端 deterministic calculation layer 先产出稳定 summary / recommendation / progress
- Assistant Insight Dashboard 先把价值直接展示出来
- 用户再通过 quick prompt 追问

## 2. Demo Prerequisites

本地默认端口：

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`

推荐 provider：

- 本地演示优先使用 `ASSISTANT_PROVIDER=mock`

本地 demo 账号：

- email: `assistant-demo@fitmind.local`
- password: `Passw0rd!`

说明：

- 这是本地 demo seed 生成的账号，不是生产账号。
- 如果数据库是共享 Neon 环境，不要把这组凭据当成可公开复用的共享账号去传播。

## 3. Verification Lanes

在讲 demo 之前，先明确项目当前验证分层：

- `pnpm test`
  - 只代表 unit-test lane
  - 不要求数据库外连
- `pnpm smoke:auth`
  - 真实 auth app path
  - 需要 `DATABASE_URL`
  - 当前 sandbox 下可能因为 DB egress denial 失败，提权环境已通过
- `pnpm smoke:assistant`
  - 真实 auth + assistant mock-turn path
  - 需要 `DATABASE_URL`
  - 提权环境已通过
- `pnpm smoke:training`
  - 真实 training summary / recommendation context / exercise progress path
  - 需要 `DATABASE_URL`
  - 提权环境已通过
- `pnpm seed:assistant-demo`
  - 写入本地 demo 用训练数据
  - 需要 `DATABASE_URL`

不要把这些 DB-backed smoke 说成 root unit tests，也不要把它们说成浏览器 E2E。

## 4. Start Services

在仓库根目录执行：

```bash
pnpm dev:server
```

```bash
pnpm dev:client
```

## 5. Seed Demo Data

先准备演示数据：

```bash
pnpm seed:assistant-demo
```

如果当前环境无法直接外连数据库，改用已批准的提权路径运行 package-local `tsx.cmd`。

预期结果：

- demo 用户存在
- 最近 30 天有 5 条演示用 workouts
- 胸推动作容量明显高于背部和腿部
- Bench 有足够记录展示重点动作进展

## 6. Demo Flow

### Step 1. Open frontend and log in

打开 `http://localhost:5173`，使用 demo 用户登录：

- `assistant-demo@fitmind.local`
- `Passw0rd!`

可以先说明：

“这里登录的是本地 demo seed 账号，不是生产账号。这个账号的训练分布是为了稳定展示 insight dashboard 而专门构造的。”

### Step 2. Go directly to `AI 助手`

进入 `AI 助手` Tab，不要先从泛化聊天角度切入。

先讲页面定位：

“这一页不是先给你一个空聊天框，而是先把可解释、可复现的训练洞察主动展示出来，再允许你继续追问。”

### Step 3. Explain the 5 insight cards

按顺序展示当前 5 张卡：

1. 今日建议
2. 训练偏科提醒
3. 恢复提醒
4. 重点动作进展
5. 判断依据

这里要明确讲两点：

- 这些内容不是 free chat 先编出来的
- 它们来自 deterministic training data + evidence-backed context

### Step 4. Click quick prompt: `我今天练什么？`

展示 Assistant 从 dashboard 进入追问模式。

强调：

- quick prompt 不是硬编码答案
- assistant 会走受控 tool path
- 结果建立在已有 recommendation context 之上

### Step 5. Click quick prompt: `我是不是偏科？`

这里要把 demo seed 的设计价值说出来：

- 胸推容量明显更高
- 背部有训练，但相对偏少
- 腿部几乎没有形成均衡分布

这条路径适合直接展示：

- 为什么这批 demo data 不是随机 seed
- 为什么 insight dashboard 可以稳定演示

### Step 6. Click quick prompt: `AI 根据什么判断？`

这是面试价值最高的一步。

建议说明：

“当前版本不是把原始 workouts 全塞进 prompt，而是先由后端 deterministic layer 做 summary / progress / recommendation context，再由 assistant 基于 evidence 做解释。”

### Step 7. Show unsupported prompt fallback

手动输入一个明显超出范围的问题，例如天气、笑话或泛化生活建议。

目标：

- 展示 unsupported intent 不会假装回答
- 展示当前 assistant 的支持边界是诚实的

推荐讲法：

“当前阶段我没有把它做成自由聊天机器人，因为现在的目标是训练记录解释，而不是泛化问答。”

### Step 8. Explain `分析` Tab vs `AI 助手` Tab

最后切回 `分析` Tab，讲清分工：

- `分析`
  - deterministic data surface
  - 直接展示 summary / progress / context
- `AI 助手`
  - 基于这些稳定结果做产品化解释和追问交互

一句话总结可以用：

“分析页负责把结果算清楚，AI 助手页负责把结果讲清楚。”

## 7. Suggested Speaking Track

### Opening

“FitMind AI 不是一个普通聊天壳，也不是一个纯 CRUD 项目。它的核心是把真实训练日志、deterministic calculation layer、受控 Tool Calling 和 SSE assistant UI 串成一条可解释的 AI application chain。”

### On the dashboard

“我先不给用户一个空聊天框，而是先把最有价值的训练洞察主动展示出来。这样即使没有追问，页面本身也已经能表达产品价值。”

### On the assistant boundary

“当前 assistant 不是自由聊天机器人。它优先回答训练相关问题，unsupported intent 会明确兜底，而不是假装什么都能答。”

### On verification

“root `pnpm test` 现在只代表 unit-test lane。真实的 auth、assistant 和 training app path 是通过独立 smoke scripts 验证的；这些需要数据库外连，在当前 sandbox 环境下要区分环境限制和产品 bug。”

## 8. What Not to Claim

本次 demo 不要 overclaim：

- 不要说 root `pnpm test` 覆盖了真实数据库链路
- 不要说已经完成 browser E2E
- 不要说 assistant 已支持多工具 agent loop
- 不要说已经有第二次 provider call 或真正的自由聊天 orchestration

## 9. Recovery Notes

### If login fails

- 检查 backend 是否已启动
- 检查 `DATABASE_URL` 和 `JWT_SECRET`
- 必要时先跑 `pnpm smoke:auth`

### If assistant page looks empty

- 先确认已经跑过 `pnpm seed:assistant-demo`
- 再确认当前登录的就是 demo 用户

### If DB-backed commands fail in sandbox

- 先说明这是当前环境的 sandbox DB egress denial
- 不要把它描述成 app 逻辑 bug
- 改用已验证的 elevated run 路径

## 10. Phase 4.8A.1 Assistant RAG Demo Flow

Use this flow for the current production-ready assistant demo. The point is to show that FitMind separates user training evidence from general training knowledge sources.

Prerequisite:

- Log in with a test/demo account that has recent bench press workouts.
- In the Assistant page, select bench press as the focused exercise when demonstrating exercise progress or mixed Tool + RAG questions.
- Keep `ASSISTANT_PROVIDER=mock` for a stable demo unless intentionally testing the Anthropic adapter.

Stable question sequence:

1. Ask: `我最近卧推是不是没进步？`
2. Show: the answer is routed as `progress` and displays Evidence from deterministic training data.
3. Ask: `RPE 是什么？`
4. Show: the answer is routed as `knowledge` and displays Sources from the training knowledge retriever.
5. Ask: `卧推没进步是不是训练量不够？`
6. Show: the answer is routed as `mixed_tool_rag` and displays Evidence + Sources together.
7. Ask: `你根据什么判断？`
8. Show: the assistant explains what training data / deterministic evidence it used.
9. Ask an unsupported question such as `给我讲个笑话`.
10. Show: the assistant returns a scoped boundary instead of pretending to be a general chatbot.

Speaking track:

> FitMind AI does not put every fact into the prompt. User-specific training records go through deterministic tools and appear as Evidence. General training concepts go through the RAG knowledge retriever and appear as Sources. The model's job is to organize and explain the result, not invent training facts.

Production smoke reference from 2026-06-06 / Phase 4.8B closeout:

- `/api/health`: 200.
- `/api/exercises`: DB-backed 200.
- Bench progress with selected exercise: `progress`, Evidence present.
- RPE question: `knowledge`, Sources present.
- Bench volume / plateau question with selected exercise: `mixed_tool_rag`, Evidence and Sources present.
- Evidence question: `evidence`.
- Unsupported joke request: `unsupported`, scoped limitation present.

What not to overclaim:

- Phase 4.8B uses DB-backed keyword retrieval.
- Phase 4.8C upgrades the retriever to Voyage `voyage-4-lite` embeddings plus pgvector exact cosine search.
- Phase 4.9 upgrades the retriever to hybrid scoring and adds knowledge ingestion/eval operations.
- This is still not reranking, LangChain, LangGraph, MCP, or multi-agent orchestration.

RAG progression:

- Phase 4.8A: Assistant RAG skeleton and static source shape.
- Phase 4.8B: DB-backed keyword RAG from `knowledge_documents` / `knowledge_chunks`.
- Phase 4.8C: Voyage `voyage-4-lite` embeddings plus pgvector `vector(1024)` exact cosine search.
- Phase 4.9: Hybrid vector + keyword scoring, local fixture ingestion, safe retrieval logs, and deterministic RAG eval.
