# FitMind AI 项目说明书（PROJECT_BRIEF.md）

> 这是 FitMind AI 项目的源头文档。所有后续的架构、API、数据库、AI 决策文档都基于这一份。 每次开新的 AI 协作对话，让 AI 先读这份文档，再读相关的子文档。

> For latest demo and interview preparation, see:
>
> - `docs/demo-script.md`
> - `docs/project-study-guide.md`
> - `docs/local-run-guide.md`

------

## 1. 项目一句话定位

**FitMind AI 是一个 AI 驱动的个性化训练决策系统**：基于用户真实的力量训练日志，通过独立的计算层（疲劳追踪 / 训练容量分布 / 动作进展 / 停滞检测）产出结构化分析结果，再由 LLM 通过 Tool Calling 调用这些计算工具并生成可解释、可追溯的训练建议。

------

## 2. 核心问题与差异化

### 这个项目要解决的真实问题

健身爱好者在自主训练时常面临的判断难题：

- 「我今天该练胸还是休息？」（恢复状态判断）
- 「我卧推 3 周没进步了，是停滞还是正常波动？」（训练曲线分析）
- 「我最近一个月哪个肌群练得不够？」（训练分布盘点）

这些问题的判断需要**结合用户历史训练数据 + 训练学常识**。普通人没有时间手动统计；ChatGPT 不知道你的数据，只能给空话。

### 与普通 AI 聊天产品的本质区别

| 维度       | 套壳 ChatGPT            | FitMind AI                                               |
| ---------- | ----------------------- | -------------------------------------------------------- |
| 数据来源   | 凭空生成 / 用户当前消息 | 数据库真实训练记录                                       |
| 推理依据   | 模型常识 + 想象         | Tool Calling 返回的真实计算结果                          |
| 可追溯性   | 无                      | 每条建议附带 evidence 字段，标注引用了哪个工具的哪个数据 |
| 防幻觉机制 | 无                      | 计算逻辑从 LLM 中剥离，模型只负责解释，不负责算          |

**面试一句话定位**：

> 我没有让 LLM 直接对原始训练日志做推理，而是把疲劳分数、训练量、进展斜率这些指标的计算从模型中剥离出来，做成独立的工具层。模型通过 Tool Calling 拿到结构化的计算结论，再生成自然语言解释。这样模型回答始终绑定真实数据，规避了基于原始日志直接推理的幻觉风险。

------

## 3. 目标用户与使用场景

### 目标用户

- 有规律力量训练习惯的健身爱好者（每周 3-5 次）
- 已经在用纸笔或其他 App 记录训练，希望获得数据驱动的反馈
- **首要用户：你自己**——你已经在用「训记」App 记录训练，迁移数据后这个项目就是你的真实工具

### 核心使用场景

**场景 A：恢复状态查询**

> 用户问：「我今天能练深蹲吗？」 系统：调用 `get_recovery_status(muscle_group="legs")` → 返回腿部疲劳分数 + 最近训练时间 → LLM 综合解释

**场景 B：进展分析**

> 用户问：「我卧推最近怎么样？」 系统：调用 `get_progress_analysis(exercise="bench_press", weeks=8)` → 返回斜率 + 是否停滞 + 最近 1RM 估算 → LLM 解读

**场景 C：训练分布盘点**

> 用户问：「我最近一个月练得均衡吗？」 系统：调用 `get_weekly_volume_distribution(weeks=4)` → 返回各肌群相对容量 → LLM 指出薄弱点

**场景 D（扩展）：动作技术问答**

> 用户问：「深蹲膝盖内扣怎么办？」 系统：通过 RAG 从动作知识库检索相关段落 → LLM 基于检索结果回答 + 标注引用源

**场景 E（扩展）：训练计划生成**

> 用户问：「帮我规划下个月的增肌训练。」 系统：通过 ReAct Workflow 多步执行（查容量 → 找弱项 → 查进展 → 生成计划）

------

## 4. 技术栈

### 主线技术

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS
- **状态管理**：Zustand（轻量、好讲、面试加分）
- **后端**：Node.js + Express + TypeScript
- **数据库**：PostgreSQL（Neon 托管，含 pgvector 扩展）
- **AI**：Anthropic API（Claude）+ Tool Calling + SSE 流式输出
- **认证**：JWT MVP → HttpOnly Cookie（生产化时切换，详见第 10 节安全章）

### 扩展技术

- RAG

  ：pgvector + embedding provider（优先 Voyage AI；做扩展阶段前重新核对当时官方文档，最终选型记录在 

  ```
  docs/ai-decisions.md
  ```

  ）

  - 注：Anthropic 官方不提供自有 embedding 模型，推荐使用 Voyage AI

- **MCP**：`@modelcontextprotocol/sdk`（做 MCP 那一步时核实当时稳定版本，避免追 v2 pre-alpha）

- **Agent**：自实现轻量 ReAct 循环（不引入 LangGraph）

### 部署

- 前端：Vercel
- 后端：Render
- 数据库：Neon

------

## 5. 三层架构

```
┌─────────────────────────────────────────────────────────┐
│  扩展层（验证 AI 工程化边界）                              │
│  RAG（动作知识库）│ MCP Server │ ReAct Workflow         │
└─────────────────────────────────────────────────────────┘
                          ↑ 主线门控通过后才开启
┌─────────────────────────────────────────────────────────┐
│  主线层（项目核心，简历主写）                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ React 前端    │  │ Express 后端  │  │ PostgreSQL   │ │
│  │ - 训练日志 UI │  │ - REST API   │  │ - 训练数据    │ │
│  │ - SSE 状态机  │  │ - Tool Loop  │  │ - 会话历史    │ │
│  │ - 卡片渲染    │  │ - 计算层     │  │ - 工具日志    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────┐
│  数据基础层                                               │
│  workouts / sets / exercises / muscle_groups            │
│  exercise_muscles（含 contribution_weight）             │
└─────────────────────────────────────────────────────────┘
```

------

## 6. 数据流（用户问问题的完整链路）

```
1. 用户在前端聊天框输入「我今天能练腿吗」
       ↓
2. 前端 fetch POST /api/chat (with SSE)
       ↓
3. 后端拼装 messages + system prompt + tool definitions
       ↓
4. 调用 Anthropic API (stream=true)
       ↓
5. 模型返回 tool_use 块：调用 get_recovery_status("legs")
       ↓
6. 后端执行计算层 fatigueScore() + 查 sets 表 + 应用 contribution_weight
       ↓
7. 把 tool_result 拼回 messages，再次调用 Anthropic API
       ↓
8. 模型返回最终 JSON 结构化建议
       ↓
9. 后端通过 SSE 把 chunks 推给前端
       ↓
10. 前端状态机：thinking → tool_calling → answering → done
       ↓
11. 前端把 JSON 渲染成卡片（含 evidence 引用）
```

**这条链路要能默写**。面试问到「Tool Calling 怎么工作的」就讲这 11 步。

------

## 7. 五个开发阶段

| 阶段           | 内容                                      | 预估时间 | 完成标准（门控）                 |
| -------------- | ----------------------------------------- | -------- | -------------------------------- |
| 阶段 0         | 项目骨架 + 文档 + AI 规则                 | 5 天     | 8 份文档完成、Lint/CI 配好       |
| 阶段 1         | 训练日志 CRUD + 数据库 + 简化登录         | 1 周     | 能录入训练，能查周/月视图        |
| 阶段 2         | 计算层（fatigue/volume/progress/plateau） | 10 天    | 4 个函数有单元测试               |
| 阶段 3         | Tool Calling 循环 + 4 个 tool             | 1 周     | 端到端：问问题能拿到 AI 回答     |
| 阶段 4         | SSE + 前端状态机 + 中断重试               | 8 天     | 流式输出顺畅，状态切换正确       |
| 阶段 5         | JSON Schema 输出 + evidence 卡片          | 5 天     | 前端能渲染结构化卡片             |
| **🚪 主线门控** | —                                         | —        | **以上全部通过才能开扩展**       |
| 扩展 A         | RAG 动作知识库                            | 1 周     | 能问动作技术问题，回答带引用     |
| 扩展 B         | MCP Server 封装                           | 3-4 天   | 工具能被 Claude Desktop 调用     |
| 扩展 C         | ReAct 训练计划生成                        | 1 周     | 能生成下月训练计划，trace 可视化 |
| 打磨           | 测试 + 性能数据 + 面试稿                  | 1-2 周   | README + 面试问答稿就绪          |

------

## 8. 关键技术决策（开始前就锁定）

### 8.1 为什么用 Tool Calling 而不是把数据塞 prompt

- **上下文成本**：用户日志可能有几百条，全塞 prompt token 爆炸
- **按需查询**：模型自己判断需要什么数据，调对应工具
- **可观测性**：每次工具调用有日志，能看到模型怎么推理的

### 8.2 为什么 Tool 返回结论而不是原始数据

- **防幻觉**：模型看到原始数据会瞎算，看到「疲劳分数 8.2」就只能解释
- **职责分离**：算数交给 TS（确定），解释交给 LLM（擅长）

### 8.3 为什么用 SSE 而不是 WebSocket

- 单向推送（服务器 → 客户端）足够
- HTTP 协议，部署简单
- Anthropic API 原生 SSE，前端直接转发即可

### 8.4 为什么用 Fetch + ReadableStream 而不是 EventSource

- EventSource 只支持 GET，不支持 POST body
- EventSource 不支持自定义 Header（鉴权）
- 聊天接口必须 POST + 鉴权，所以只能 fetch + ReadableStream 自己解析

### 8.5 为什么用 Zustand 而不是 Redux

- 项目规模小，Redux 样板代码太多
- Zustand 更接近 hooks 心智模型
- TypeScript 推断好

### 8.6 为什么不一开始就上 LangChain / LangGraph

- 主线场景是单轮 Tool Calling，原生 SDK 已经够
- 引入框架会增加学习成本和黑盒
- 扩展阶段做 ReAct 也是手写循环，更好讲

### 8.7 为什么要做 exercise_muscles 多对多关联表（含 contribution_weight）

- 现实建模：卧推不是只练胸，也练三头（约 50%）和肩前束（约 30%）
- 如果只用 exercise.primary_muscle 单字段，疲劳分数会失真
- contribution_weight 字段让 fatigue 计算能正确分摊到各肌群
- 这是「业务建模 → 算法层」的一致性保证，面试拷问「多对多怎么用」时能答上

------

## 9. 防幻觉机制（项目核心卖点之一）

```
普通 AI 应用：
  用户问 → LLM 直接基于训练数据生成回答
  风险：模型可能编造「你这周练得不够」这种没数据支撑的话

FitMind AI:
  用户问 → LLM 决定调用哪个工具
        → TS 计算层执行确定性计算（指数衰减、回归斜率等）
        → 工具返回结构化结论 + 原始数据点
        → LLM 基于结论生成解释
        → 输出 JSON 含 evidence 字段，引用具体数据
```

### 训练负荷计算公式（计算层核心）

```
单组负荷：
  volume = reps × weight

RPE 调整因子（主观疲劳：RPE 7 为基准，每偏离 1 等级 ±10%）：
  rpeFactor = 1 + (rpe - 7) × 0.1

肌群贡献度（来自 exercise_muscles 关联表）：
  muscleContribution = exercise_muscles.contribution_weight  // 卧推-胸=1.0, 卧推-三头=0.5

时间衰减（指数衰减，越久远权重越低）：
  decay(daysAgo) = exp(-daysAgo / τ)  // τ 默认 3.5 天，可在 ai-decisions.md 调整

最终该肌群的疲劳负荷：
  fatigueLoad(muscle) = Σ over all sets in last N days:
    volume × rpeFactor × muscleContribution × decay(daysAgo)
```

**为什么这样设计**：

- 不是医学疲劳模型，是简化的训练负荷追踪模型
- 让 AI 建议绑定真实数据，而不是模型凭感觉判断
- 所有阈值（τ、N、归一化系数）写在常量配置里，可调可讲

### evidence 字段设计

```json
{
  "summary": "你的腿部今天恢复程度中等",
  "recommendation": "建议今天练腿，但保持 RPE 7 以下",
  "evidence": [
    {
      "tool": "get_recovery_status",
      "data": {
        "muscle_group": "legs",
        "fatigue_score": 5.2,
        "days_since_last": 2,
        "contributing_exercises": ["squat", "leg_press"]
      }
    }
  ],
  "risk_level": "low",
  "disclaimer": "本系统提供的建议基于个人训练数据分析，不构成医疗或专业训练指导。如有伤痛请咨询专业人士。"
}
```

------

## 10. 安全与合规（必须从第一天就考虑）

### 10.1 数据隐私

- 训练日志属于用户个人健康数据，存储 + 传输都要加密（HTTPS）
- 不在 AI 工具调用日志里记录用户的真实身高体重等个人指标
- 用户可以删除自己的所有数据（GDPR-style 删除权）

### 10.2 认证方案

- **MVP 阶段**：JWT Bearer Token（开发简单，便于调试）
- **生产演示阶段**：切换为 HttpOnly + Secure + SameSite=Lax Cookie，避免 XSS 窃取 token
- 这一升级的具体步骤在 `docs/ai-decisions.md` 有记录
- **简历表达上**：直接讲生产化方案（HttpOnly Cookie + CSRF token），与 SunSafe 项目的安全水准对齐，不能倒退

### 10.3 健康建议风险

- 涉及伤痛、麻木、关节问题的提问 → 触发风险提示，不给具体建议
- 所有 AI 输出强制包含 disclaimer 字段
- RAG 知识库不放医学诊断类内容

### 10.4 AI 安全

- **Prompt Injection 防御**：用户输入不直接拼接到 system prompt，而是放在 user message 里
- **Tool 调用白名单**：模型只能调用预定义的 4 个工具
- **工具参数校验**：用 Zod 做参数 schema 校验
- **速率限制**：单用户每分钟最多 20 次 AI 调用
- **成本上限**：每用户每天最多 50 次 AI 调用（防滥用 + 控成本）

------

## 11. 性能与体验目标

| 指标                     | 目标    |
| ------------------------ | ------- |
| 首屏加载                 | < 2s    |
| AI 首 token 时间（TTFT） | < 1.5s  |
| Tool Calling 端到端响应  | < 5s    |
| SSE 流式渲染不卡顿       | 60fps   |
| 训练日志列表（100 条）   | < 500ms |

**这些数字要在打磨阶段实测，不能凭空写到简历里**。

------

## 12. 面试时如何讲这个项目（标准 STAR 模板）

### Situation（背景）

我在准备求职过程中，希望把 AI 应用工程化的核心知识——Tool Calling、RAG、MCP、Agent、SSE 流式输出——通过一个真实可用的项目串起来。我自己有规律的力量训练习惯，长期用纸笔记录训练数据，所以选了「个性化训练决策」这个真实需求作为载体。

### Task（任务）

设计并实现一个能基于用户历史训练数据回答个性化问题的 AI 系统。核心挑战是：怎么让 AI 的回答绑定真实数据，而不是凭空生成。

### Action（动作）

我把项目分成三层：

1. **数据层**：PostgreSQL 设计 workouts/sets/exercises/muscle_groups 多对多关联模型，关联表包含 contribution_weight 字段以支持「一个动作训练多个肌群」的真实业务建模
2. **计算层**：用 TypeScript 实现疲劳评分（指数衰减 + RPE 调整 + 肌群贡献度）、容量分布、进展斜率、停滞检测四个独立分析模块
3. **AI 层**：通过 Tool Calling 让 LLM 按需调用计算工具，再生成自然语言解释

工程上我重点投入了几个点：

- SSE 流式传输用 Fetch + ReadableStream 自己解析（EventSource 不支持 POST body 和鉴权头）
- 前端 thinking/tool_calling/answering/done 四态状态机管理多轮工具调用 UI
- buffer + requestAnimationFrame 批量刷新避免高频 chunk 重复渲染
- AI 输出强制 JSON schema，每条建议带 evidence 字段标注引用了哪个工具的哪个数据

### Result（结果）

项目做完后我每天用它分析自己的训练数据，目前已经记录了 X 天 / X 条训练日志。AI 建议的 evidence 字段让每条回答都有据可查，这是我和市面上「健身版 ChatGPT」的本质区别。

------

## 13. 项目命名与品牌

**项目名**：FitMind AI **仓库名**：fitmind-ai **域名**（如果买）：fitmind-ai.app 或类似

**Logo / 视觉**：暂不投入精力，用文字 logo 即可。打磨阶段做一个简洁 favicon。

------

## 14. 这份文档的使用方式

- **每次开 AI 协作对话**：让 AI 先读这份文档（在 AGENTS.md 里硬性规定）
- **每次新增功能前**：回来检查是否符合定位、技术决策、安全要求
- **每周复盘**：检查门控完成情况，决定是否进入下一阶段
- **简历准备时**：第 12 节直接是面试讲稿基础

**这份文档不是写完就放在那的**。每次有重大决策变化（比如换技术栈、调整范围），更新这份文档，再让 AI 重新读。文档不更新，AI 越用越偏。
