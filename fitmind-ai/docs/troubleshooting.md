# 踩坑日记（troubleshooting.md）

> 这份文档记录开发过程中的所有「卡了 30 分钟以上」的问题。 **核心价值**：这是你面试时最好的素材库——「你这个项目踩过什么坑」的回答全从这里出。 每次遇到坑，必须当天记。隔天就忘了细节。

------

## 记录模板

```markdown
## [TXX] 问题简短描述

- **日期**：YYYY-MM-DD
- **阶段**：阶段 X / 扩展 X
- **耗时**：花了多少时间排查

### 现象
具体看到了什么报错 / 异常行为。贴日志 / 截图描述。

### 排查过程
- 试了什么
- 排除了什么
- 最后发现是什么原因

### 根本原因
本质原因（不是表面错误）。

### 解决方案
具体怎么改的（贴关键代码）。

### 经验教训
下次怎么避免 / 类似问题怎么排查。

### 面试讲点
能否包装成 STAR 故事讲给面试官？
```

------

## 常见坑分类（建议每个分类至少记录 1-2 条）

记录时可以按分类打标签：`#sse` `#tool-calling` `#cors` `#sql` `#prompt` `#streaming` `#auth` 等。

------

## 待记录的坑（开发开始后填）

> 还没开始开发，这里是空的。开发过程中实时填入。

下面是预期会踩的坑（提前知道，遇到了好定位）：

### 阶段 1（CRUD）可能遇到

- `#sql` Neon 连接池配置（serverless 环境有特殊性）
- `#auth` JWT 过期时间设置（开发期太短反复重登）
- `#cors` 前后端跨域 + cookie 处理
- `#typing` Date 字段在 JSON 序列化时变字符串，前端要还原

### 阶段 2（计算层）可能遇到

- `#analytics` 时区导致按周聚合错位
- `#analytics` 用户没数据 / 数据极少时算法返回 NaN
- `#analytics` exercise_muscles 多对多 SQL JOIN 时容量被重复计算
- `#performance` 查 N 周数据时索引没用上，全表扫描

### 阶段 3（Tool Calling）可能遇到

- `#tool-calling` `tool_use` 的 ID 必须和 `tool_result` 的 `tool_use_id` 匹配
- `#tool-calling` Tool 抛错时要包成 `is_error: true` 的 tool_result，而不是 throw
- `#tool-calling` 模型连续调多个 tool 时，messages 数组拼装顺序必须对
- `#tool-calling` 模型循环调同一个 tool（设最大轮数限制）

### 阶段 4（SSE）可能遇到

- `#sse` Express 默认开 gzip，会破坏 SSE，需要禁用对该路由的压缩
- `#sse` Nginx / Render 反向代理默认有 buffer，需要 `X-Accel-Buffering: no` header
- `#sse` AbortController 中断后后端要清理 Anthropic stream
- `#streaming` ReadableStream 的 chunk 边界不一定对应 SSE event 边界，需要 buffer 拼接
- `#streaming` UTF-8 多字节字符在 chunk 边界被切（用 TextDecoder + stream:true 解决）
- `#streaming` 高频 setState 导致 React 卡顿（buffer + rAF 解决）

### 阶段 5（结构化输出）可能遇到

- `#prompt` 模型偶尔输出 JSON 之外的解释文本（强 schema 约束 + few-shot）
- `#prompt` 模型 `disclaimer` 字段经常忘记输出（system prompt 强化）

### 扩展 A（RAG）可能遇到

- `#rag` chunk size 选 200 还是 500，效果差异大
- `#rag` 检索不到相关内容（embedding 模型不适合中文 / query 改写）
- `#pgvector` IVFFlat 索引的 lists 参数怎么选

### 扩展 B（MCP）可能遇到

- `#mcp` SDK 版本不稳定（v2 pre-alpha）
- `#mcp` Tool 返回值序列化失败

### 扩展 C（Agent）可能遇到

- `#agent` ReAct 循环陷入死循环
- `#agent` Agent trace 太长，前端渲染慢

------

## 写好踩坑日记的 4 条原则

1. **当天写**：脑子里还热乎的时候记，第二天细节就模糊了
2. **写根因不写表面**：表面是「报错 X」，根因可能是「Express 默认压缩」
3. **写解决方案 + 代码片段**：贴关键 diff 比写「我改了一下」有用
4. **写面试讲点**：每个坑都问自己——「这个故事能不能 STAR 讲给面试官？」如果能就标记 `[面试素材]`

------

## 标记说明

记录时给坑打标签：

- `[面试素材]` — 适合面试讲的踩坑故事
- `[已修复]` — 问题已解决
- `[绕过]` — 暂时绕开，未来要修
- `[已知问题]` — 不打算修，记录为已知限制
- `[反复出现]` — 同类问题多次发生，需要写规则进 AGENTS.md 防止再发生

## [TXX] [已修复] Windows PowerShell 中文 JSON 请求体未显式 UTF-8 导致 assistant intent 误判

- **日期**：2026-06-07
- **阶段**：Phase 4.8B.1 - Production Assistant Smoke Closeout
- **耗时**：约 20 分钟

### 现象
生产 smoke 中，`卧推没进步是不是训练量不够？` 第一次被 assistant 判成 `unsupported`，而不是预期的 `mixed_tool_rag`。

### 排查过程
- 先确认 production `/api/health` 正常，DB-backed RAG source 对 `RPE 是什么？` 能返回。
- 再对比 mixed prompt 请求体，发现问题集中在 Windows PowerShell 构造中文 JSON body 的方式。
- 使用显式 UTF-8 bytes / `Content-Type: application/json; charset=utf-8` 重新发送后，intent 正确变成 `mixed_tool_rag`，并返回 Sources + workout Evidence。

### 根本原因
这不是业务逻辑或 intent router 问题，而是 smoke 请求构造问题：Windows PowerShell 对中文 JSON 请求体编码不显式时，生产 API 收到的 prompt 可能不是预期文本。

### 解决方案
后续 Windows PowerShell 中文 API smoke 统一使用 UTF-8 bytes，或显式设置 `Content-Type: application/json; charset=utf-8`。

### 经验教训
凡是验证中文 prompt、assistant intent classification、JSON request body、PowerShell `Invoke-RestMethod` / `curl` 差异或生产 AI API 时，都要先排除请求编码问题。

### 面试讲点
这是一个适合讲“AI 行为误判不一定是模型或业务逻辑问题”的案例。先确认输入字节和请求边界，再谈 prompt / router / RAG 质量，否则很容易在错误层面调参。

## [T01] [已修复] Auth 阶段 `NodeNext` + JS repository 导致类型解析断裂

- **日期**：2026-04-28
- **阶段**：阶段 1.1 - Auth MVP
- **耗时**：约 35 分钟

### 现象
- `pnpm --filter @fitmind/server type-check` 在引入 Auth service 后失败。
- 报错包括：
  - `Could not find a declaration file for module '../../db/repositories/index.js'`
  - `Cannot find module 'bcryptjs' or its corresponding type declarations`
  - 直接从 `server` import `shared/src` 时触发 `rootDir` 越界错误

### 排查过程
- 先确认 `bcryptjs` 和 `jose` 真实包都已安装，发现 `jose` 自带类型，`bcryptjs` 包内也有类型文件。
- 进一步定位到问题不只是第三方依赖，而是 `server` 当前是 `NodeNext`，同时 db repository 仍走 `.js` 路线，TS 无法直接拿到稳定声明。
- 还确认了 `server` 不能直接吃 `shared/src/*` 源文件，否则会把 `shared` 拉进 `server` 的 `rootDir` 约束里。

### 根本原因
- 当前工程是“TS service 层 + JS repository 层”的混合状态，`NodeNext` 下对模块边界比之前更严格。
- `server` 直接 import `shared/src` 会跨出 `rootDir`。
- `db/repositories/index.js` 没有同名声明文件，TS 只能把它视为隐式 `any`。

### 解决方案
- 新增 `server/src/db/repositories/index.d.ts`，给 `findUserByEmail`、`findUserById`、`createUser` 提供稳定声明。
- 新增 `server/src/types/bcryptjs.ts`，用本地声明兜住 `bcryptjs` 在当前工程里的类型解析。
- 停止在 `server` 里直接 import `shared/src`，改为在 `server` 内部维护本地响应/错误类型，避免 `rootDir` 越界。

### 经验教训
- 只要项目还处在 JS repository 向 TS service 过渡阶段，就要优先补“模块边界声明”，不要假设 TS 会自动推断 JS 文件。
- `shared` 想被 `server` / `client` 同时消费，最好后续单独把包入口和导出策略做完整，而不是直接跨目录吃源文件。

### 面试讲点
- 这是一个典型的“工程演进期类型边界问题”：不是业务逻辑写错，而是模块系统、包边界和类型系统没完全对齐。我通过补声明文件和收紧跨包 import，把问题控制在最小修改范围内，没有顺手把整层重构掉。

## [T02] [已修复] `pnpm install --force` 后 lint / package test 脚本同时漂移

- **日期**：2026-04-28
- **阶段**：阶段 1.1 - Auth MVP
- **耗时**：约 30 分钟

### 现象
- 安装 Auth 依赖后，`pnpm lint` 一度报 `hermes-parser` 相关模块解析错误。
- `pnpm --filter @fitmind/server test` 在提权环境下不再是 `spawn EPERM`，而是 `No test files found`。
- 根级 `pnpm test` 反而可以正常通过。

### 排查过程
- 先确认 `pnpm test` 在仓库根目录可以跑通，说明新增 Auth 测试文件本身没有问题。
- 再对比依赖版本，发现 `eslint-plugin-react-hooks` 因 caret 升到了 `7.1.1`，安装后触发了本地 `hermes-parser` 解析异常。
- 继续看 `server/package.json` 的 `test` 脚本，发现它在 `server/` 目录下执行时，与根级 `vitest.config.ts` 的 include 路径假设不一致。

### 根本原因
- `pnpm install --force` 会刷新锁文件并重新解析浮动版本，导致 lint 依赖从原来的可用状态漂移。
- `server` 子包测试脚本和 workspace 根目录的 Vitest 配置耦合，但脚本执行目录不同。

### 解决方案
- 将根级 `eslint-plugin-react-hooks` 从 `^7.0.1` 固定为 `7.0.1`，恢复 lint 稳定性。
- 将 `server` 包的 `test` 脚本改为 `cd .. && vitest run`，直接复用已经验证通过的根级执行路径。
- 测试仍需在提权环境下执行，因为沙箱内 `vitest/esbuild` 会触发已知的 `spawn EPERM`。

### 经验教训
- 对工具链依赖，能不放宽到 caret 的地方尽量别放宽，尤其是 lint / parser 这一类基础设施。
- 子包脚本如果依赖 workspace 根配置，最稳的是显式回到根目录再执行，不要假设所有工具都会正确重算相对路径。

### 面试讲点
- 这是很适合讲“工具链稳定性”的案例：业务代码没问题，真正卡人的是版本漂移和 monorepo 脚本路径假设。我没有盲目重装到能跑为止，而是把问题拆成“依赖版本”和“执行目录”两个根因分别处理。
## [T03] [已修复] Runtime JS repository import 指向 `env.js` 导致真实 HTTP + DB 路径 500

- **日期**：2026-04-29
- **阶段**：阶段 1.2 - Workout HTTP APIs / Batch 6 Verification
- **耗时**：约 30+ 分钟

### 现象
- 单元测试和 service 层调用都正常，但用真实 HTTP 请求走 `/api/auth/register` 时会返回 `500 INTERNAL_ERROR`。
- 直接用 `tsx` 调用 `register()` 服务又能正常插入用户，表面看起来像是"有时好、有时坏"的隐性运行时问题。

### 排查过程
- 先用真实 `.env.local` + 临时 `JWT_SECRET` 做 service 直接调用，确认 DB 连接、User repository 和 JWT 签发本身都可用。
- 再用 `tsx` 执行真实 HTTP smoke，发现一旦走到 repository 层，`pool.js` 会在运行时报 `Cannot find module '../env.js'`。
- 追查 `server/src/db/pool.js` 发现它是 JS 过渡文件，但按照 TS 路径去 import `../env.js`，仓库里实际只有 `env.ts`。

### 根本原因
- 项目当前是 TS app/service + JS repository/db 的过渡形态，TS 入口在 `tsx` 下能把 `.js` 解析回对应的 `.ts`，但 JS repository 文件并不自动受到同样的模块重写规则。
- 结果就是，db 入口在真实请求里才会触发的时候，去了一个不存在的 `env.js`，导致路由层看到统一 `500`。

### 解决方案
- 将 `server/src/db/pool.js` 的导入从：

```js
import { loadServerEnv } from "../env.js";
```

- 改为：

```js
import { loadServerEnv } from "../env.ts";
```

- 修复后，`pnpm --filter @fitmind/server test` 和 `pnpm --filter @fitmind/server type-check` 继续通过，而且 `tsx` 直接调用 `register()` 已经能够在真实数据库上成功插入用户。

### 经验教训
- JS 过渡层和 TS 入口层混用时，不能假设 `.js` 后缀在所有运行时路径上都会被自动重写到 `.ts`。
- 真实 HTTP smoke 和 service 直接调用各自能抓到不同的问题：前者更容易打到"路由 -> controller -> service -> db"的终端关闭缺口。

### 面试讲点
- 这是一个很好的"过渡架构隐性运行时 bug"故事：静态类型和单元测试都过了，但真实请求还是会在 JS repository 边界爆掉。关键不是乱改，而是用 service 直接调用和 HTTP smoke 把问题切分开，最后定位到一行导入后缀。
## [T04] [已修复] Workout service 直接按 string DTO 校验真实 DB 行，导致 `Date` / `numeric` 运行时映射误报 `400`

- **日期**：2026-04-29
- **阶段**：Phase 1.2 - Closeout Verification Fix & Smoke Stabilization
- **耗时**：约 20 分钟

### 现象
- 新增真实 `workout-api-smoke.ts` 后，`POST /api/workouts` 在 repository 已写入成功的情况下仍返回 `400 VALIDATION_ERROR`。
- 错误详情是：
  - `performed_at: Invalid input: expected string, received Date`
- 这说明问题不在请求 body，而在 controller -> service -> db -> service DTO 回填这一段真实运行链路。

### 排查过程
- 先确认 smoke 发出的 JSON payload 是标准字符串时间，不存在请求序列化错误。
- 再根据 `ZodError` 返回的 path 反查到 `server/src/services/training/workout-service.ts`，发现 DTO schema 直接把 `performed_at`、`created_at` 写成了 `z.string()`。
- 继续顺着 PostgreSQL 驱动返回值检查，确认：
  - `timestamptz` 在真实运行时会回到 JS `Date`
  - `numeric` 列在部分查询路径下会回到 string
- 单测之所以没暴露，是因为 mock row 使用的是理想化字符串/数字，而不是真实 pg driver 返回形态。

### 根本原因
- service 层把 repository row 当成“已经是 API DTO 形状”的数据使用了。
- 但真实数据库驱动返回的是“数据库友好形状”，并不天然等于“HTTP DTO 形状”。
- 于是 workout service 在真实运行时把正常数据误判成校验失败，并通过全局 `ZodError -> 400` 映射暴露成假性的请求错误。

### 解决方案
- 在 `server/src/services/training/workout-service.ts` 增加最小归一化：
  - `Date -> ISO string`
  - numeric string -> `number`
- 归一化范围只收口到 workout DTO 映射层，没有改 schema、controller、repository 或数据库结构。
- 修复后重新跑 `pnpm --filter @fitmind/server exec tsx scripts/workout-api-smoke.ts`，workout / set 全链路通过。

### 经验教训
- “单测全绿 + service mock 正常”并不能替代真实 HTTP smoke，尤其是 DB driver 会把时间和数值列转成运行时特定对象时。
- repository row 和 API DTO 之间最好显式做一次边界归一化，不要默认它们天然同形。
- 把 `ZodError` 统一映射为 `400` 很方便，但也会掩盖“服务端回填数据形状不符”这类非请求侧问题，所以真实 smoke 很有必要。
## [T05] [已修复] Client proxy 固定 `3000`，但 server 默认端口仍是 `3001`

- **日期**：2026-04-30
- **阶段**：Phase 1.3 - Batch 6 Closeout
- **耗时**：约 20 分钟

### 现象
- 前端在 Batch 1 已经固定把 Vite `/api` proxy 指向 `http://localhost:3000`。
- 但服务端 `server/src/env.ts` 的默认端口仍然是 `3001`，`.env.example` 也仍然写着 `PORT=3001` 和旧的 `VITE_API_URL`。
- 结果是：按示例配置直接启动本地前后端，浏览器请求会默认打到没有后端监听的 `3000`。

### 排查过程
- 先按 Batch 6 要求启动真实 dev server，发现前端和后端本身都能起，但要靠运行时注入 `PORT=3000` 才能和 client proxy 对齐。
- 随后核对了：
  - `client/vite.config.ts`：proxy 目标是 `3000`
  - `server/src/env.ts`：默认端口还是 `3001`
  - `.env.example`：仍是 `PORT=3001`，并且保留了前端不再使用的 `VITE_API_URL`
- 这确认问题不是代码运行错误，而是 repo 内部的本地开发合同已经漂移。

### 根本原因
- Batch 1 锁定了前端 proxy 到 `3000`，但没有同步收口服务端默认端口和示例环境变量。
- 于是“客户端默认假设”和“服务端默认假设”不再一致。

### 解决方案
- 将 `server/src/env.ts` 的默认端口改为 `3000`。
- 将 `.env.example` 更新为：
  - `PORT=3000`
  - `VITE_API_BASE_URL=`（允许空字符串，默认走相对路径 + Vite proxy）
- 保持现有 client HTTP 层设计不变，不回退到直接写绝对 API URL。

### 经验教训
- 只要改了本地 proxy、默认端口或 env 变量命名，就必须同步检查服务端默认值、示例 env 和启动文档。
- 这类问题静态检查抓不住，必须靠真实 dev 启动和 HTTP 联调才能暴露。

### 面试讲点
- 这是很典型的“前后端本地开发合同漂移”问题：功能代码没坏，但默认配置已经对不上了。定位时不要只盯接口实现，要把 proxy、默认端口、示例 env 当成同一个契约面一起核对。
