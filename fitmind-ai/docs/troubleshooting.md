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