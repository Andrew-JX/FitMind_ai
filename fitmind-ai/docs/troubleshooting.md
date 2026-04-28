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
