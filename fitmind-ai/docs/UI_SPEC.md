# FitMind AI 前端 UI 规范（UI_SPEC.md）

> **本文档是前端视觉与交互的唯一真相来源。**
> 任何前端组件在编写前必须先读本文档（见 AGENTS.md 规则）。
> 本文档只管「长什么样、怎么交互」，不改后端 API、不改数据流、不改状态机语义。
> 逻辑约束详见 `docs/frontend-current-state.md` 第 10 节。

---

## 0. 设计定位

| 维度 | 决策 |
|------|------|
| 风格参考 | 训记 App（国内健身日志应用）—— 硬核、极简、数据驱动 |
| 信息密度 | 高密度，训练数据优先展示，减少装饰性元素 |
| 主题 | **深色优先**，同时支持浅色切换 |
| 布局基准 | **移动端优先**，最大宽度 `390px`，所有布局以竖屏手机为基准 |
| 语言 | 全中文 UI（技术标识如 `get_training_summary`、`RPE` 等保留英文） |
| 动效 | 克制——只在页面切换、卡片展开、状态变化时使用，不做纯装饰动画 |

---

## 1. Design Tokens

### 1.1 颜色

所有颜色通过 CSS 变量或 theme object 统一管理，组件内部**禁止硬编码色值**。

#### 深色主题（默认）

```
--fm-bg:      #0f0f0f       // 页面背景
--fm-surf:    #1a1a1a       // 卡片/弹窗背景
--fm-surf2:   #222222       // 次级表面（输入框、统计格子背景）
--fm-surf3:   #2c2c2c       // 三级表面（已完成组、tag 背景）
--fm-bdr:     rgba(255,255,255,0.08)   // 普通边框
--fm-bdr2:    rgba(255,255,255,0.15)   // 强调边框（输入框 focus 前）
--fm-tx:      #f0f0f0       // 主文字
--fm-tx2:     #999999       // 次级文字（标签、说明）
--fm-tx3:     #555555       // 三级文字（占位符、序号）
--fm-ac:      #c8f035       // 强调色（主按钮、激活态、图表线）
--fm-ac-txt:  #0f0f0f       // 强调色上的文字
--fm-blue:    #4a9eff
--fm-red:     #ff5c5c
--fm-orange:  #ff9b42
--fm-green:   #4ade80
--fm-purple:  #a78bfa
--fm-pink:    #f472b6
```

#### 浅色主题

```
--fm-bg:      #f0f0ee
--fm-surf:    #ffffff
--fm-surf2:   #e8e8e6
--fm-surf3:   #dededc
--fm-bdr:     rgba(0,0,0,0.08)
--fm-bdr2:    rgba(0,0,0,0.15)
--fm-tx:      #111111
--fm-tx2:     #666666
--fm-tx3:     #aaaaaa
--fm-ac:      #4a8c00        // 日间强调色改为深绿，确保可读性
--fm-ac-txt:  #ffffff        // 日间强调色上的文字必须是白色
--fm-blue:    #1a6fd4
--fm-red:     #c93030
--fm-orange:  #c06010
--fm-green:   #1a9a46
--fm-purple:  #6d28d9
--fm-pink:    #c0306a
```

#### 语义色使用规则

| 语义 | 颜色 | 使用场景 |
|------|------|----------|
| 强调/主操作 | `--fm-ac` | 主按钮、激活 tab、选中态边框、图表主线 |
| 信息/工具调用 | `--fm-blue` | Tool Call 标签、Evidence 引用块、链接 |
| 成功 | `--fm-green` | 创建成功提示、RPE ≤ 7 标签、"完成"状态 |
| 警告 | `--fm-orange` | RPE 8 标签、上下文提示 |
| 危险/错误 | `--fm-red` | RPE ≥ 9 标签、删除按钮、"错误"状态、停止按钮 |
| 分析/计算 | `--fm-purple` | 确定性计算标签（Evidence rules、Exercise Progress badge） |

#### 半透明背景规则

需要语义色做背景时，**不使用**固定 rgba，而是基于当前主题动态计算：
- 深色模式：语义色 + `18` alpha（如 `rgba(200,240,53,0.09)`）
- 浅色模式：语义色 + `12` alpha（如 `rgba(74,140,0,0.07)`）

实现方式：组件接收当前 `isDark` 布尔值，或使用 CSS `color-mix()` / 自定义工具函数。

### 1.2 字体

```
--fm-font:  -apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif
--fm-mono:  'SF Mono', 'Menlo', 'Consolas', monospace
```

**用途分工**：
- `--fm-font`：所有 UI 文字
- `--fm-mono`：技术标识（tool name、session id、API path、代码片段）

**字重规则**：
| 字重 | 用途 |
|------|------|
| 800 | 数据大数字（统计卡片主值） |
| 700 | 页面标题、卡片标题、按钮文字 |
| 600 | 次级标题、列表项名称、状态标签 |
| 500 | 表单 label |
| 400 | 正文、说明文字 |

**字号规则**（以 px 为单位，实际开发中可等比换算 rem）：
| 字号 | 用途 |
|------|------|
| 22 | 统计大数字 |
| 16 | 页面区域标题（如"训练日志"） |
| 15 | 卡片标题 |
| 14 | 正文、输入框文字、列表主文本 |
| 13 | 次级正文、按钮文字 |
| 12 | 辅助说明、表单 label、表格内容 |
| 11 | 次级辅助、时间戳、数据注解 |
| 10 | badge、tag、monospace 标识 |

### 1.3 间距

采用 4px 基准网格。常用间距：

| Token | 值 | 用途 |
|-------|-----|------|
| `xs` | 4px | 行内元素间距、图标与文字间距 |
| `sm` | 6-8px | 紧凑列表项间距、标签间距 |
| `md` | 10-12px | 卡片内元素间距、表单行间距 |
| `lg` | 14-16px | 卡片内 padding、区域间距 |
| `xl` | 20-24px | 页面级 padding |

### 1.4 圆角

| 元素 | 圆角 |
|------|------|
| 卡片 | 14px |
| 按钮（大） | 14px |
| 按钮（中） | 12px |
| 输入框 | 10-12px |
| 胶囊标签 / pill | 20px |
| 头像 / 小图标容器 | 8px |
| 进度条 | 3px |
| RPE 标签 | 20px |

### 1.5 阴影

深色模式下**不使用阴影**——依靠边框 (`--fm-bdr`) 区分层级。
浅色模式下可加轻量阴影：`0 1px 3px rgba(0,0,0,0.04)`。

### 1.6 动效

```css
@keyframes slideUp {
  from { transform: translateY(12px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.3; }
}

@keyframes dotBounce {
  0%, 80%, 100% { transform: translateY(0); }
  40%           { transform: translateY(-5px); }
}
```

| 动效 | 场景 | 时长 |
|------|------|------|
| `slideUp` | 卡片展开、新消息出现、表单弹出 | 200-250ms ease-out |
| `pulse` | 活跃状态点（thinking/tool_calling/answering） | 800ms infinite |
| `dotBounce` | AI 思考中的三点动画 | 600ms infinite，每点延迟 120ms |
| `rotate(180deg)` | 展开/收起箭头 | 200ms |
| CSS `transition` | 按钮 hover/active、输入框 focus、tab 切换 | 150ms |

---

## 2. 全局布局

### 2.1 页面容器

```
最大宽度：390px
水平居中：margin: 0 auto
最小高度：100vh
背景色：--fm-bg
```

### 2.2 结构分层（从上到下）

```
┌─────────────────────────┐
│  Header（sticky top）   │  56px 高度
├─────────────────────────┤
│                         │
│  Content Area           │  flex: 1, 可滚动
│  （当前 tab 内容）       │  padding: 12px 16px
│                         │
├─────────────────────────┤
│  Tab Bar（fixed bottom）│  约 56px + safe-area
└─────────────────────────┘
```

### 2.3 Header

| 元素 | 规格 |
|------|------|
| 高度 | 56px（含 padding） |
| 定位 | `sticky top: 0`，`z-index: 50` |
| 背景 | `--fm-bg`，底部 1px `--fm-bdr` 分割线 |
| 左侧 | Logo 图标（28×28，圆角 8px，`--fm-ac` 背景 + 闪电图标）+ "FitMind" 文字（16px/700）+ "AI" badge（10px/600，`--fm-ac` 文字 + 半透明 `--fm-ac` 背景） |
| 右侧 | 深浅切换按钮 + 用户头像按钮（均为 32×32 icon button） |

### 2.4 底部 Tab Bar

| 元素 | 规格 |
|------|------|
| 定位 | `fixed bottom: 0`，`z-index: 50` |
| 宽度 | `100%`，`max-width: 390px`，水平居中 |
| 背景 | `--fm-surf`，顶部 1px `--fm-bdr` 分割线 |
| 内边距 | `6px 0` + `env(safe-area-inset-bottom, 8px)` |
| Tab 项 | 3 个等宽 flex item：图标（20px）+ 文字（10px） |
| 颜色 | 激活：`--fm-ac`，未激活：`--fm-tx3` |
| Tab 顺序 | ① 训练（dumbbell）② 分析（chart）③ AI 助手（bot） |

**Content Area 底部需预留 72px padding-bottom 避免被 Tab Bar 遮挡。**

---

## 3. 组件规范

### 3.1 卡片（Card）

最基础的容器组件。

```
背景：--fm-surf
圆角：14px
边框：1px solid --fm-bdr
内边距：16px（可按场景调整为 14px）
```

卡片 Header（可选）：
```
区域底部 1px --fm-bdr 分割线
左侧：标题（15px/700）+ 技术 badge（见 3.2）
右侧：操作按钮（icon button）
```

### 3.2 技术 Badge

用于标注技术概念，如 `Training Summary`、`Exercise Progress`、`Deterministic`、`SSE`。

```
字号：10px
字体：--fm-mono
字重：600
内边距：2px 8px
圆角：20px（胶囊形）
颜色 + 背景：按语义色选择（见第 1.1 节语义色表），文字用语义色，背景用对应半透明
```

### 3.3 统计格子（StatCell）

用于展示数字统计（训练次数、总容量等）。

```
背景：--fm-surf（独立卡片时）或 --fm-surf2（嵌套在卡片内时）
圆角：14px
内边距：14px 14px
```

内容布局（从上到下）：
1. 颜色点：4×4px 圆形，使用对应语义色，`margin-bottom: 8px`
2. 数值：22px/800，紧贴数字后跟单位（11px/400/`--fm-tx3`，`margin-left: 2px`）
3. 标签：11px/400/`--fm-tx3`，`margin-top: 2px`

布局：
- 3 列场景（如训练 Tab 顶部）：`grid-template-columns: repeat(3, 1fr); gap: 8px`
- 4 列场景（如分析 Tab 总览）：`grid-template-columns: repeat(2, 1fr); gap: 8px`（移动端 2 列）
- 3 列紧凑（如动作进展内部）：`grid-template-columns: repeat(3, 1fr); gap: 6px`，数值 16px/800

### 3.4 按钮

#### 主按钮（Primary）

```
背景：--fm-ac
文字：--fm-ac-txt
字号：13-15px / 700
圆角：12-14px
内边距：12-14px 纵向
全宽：width: 100%（行动入口场景）
```

#### 次级按钮（Secondary）

```
背景：--fm-surf2
文字：--fm-tx2
字号：13px / 600
圆角：12px
边框：无（深色）/ 1px --fm-bdr（浅色可选）
```

#### Icon 按钮

```
尺寸：32×32px
圆角：10px
背景：--fm-surf2
边框：1px solid --fm-bdr
图标颜色：--fm-tx3（默认）/ 语义色（如删除用 --fm-red）
```

#### 小操作按钮（如"添加组"）

```
字号：11px / 600
颜色：--fm-ac
背景：半透明 --fm-ac
圆角：8px
内边距：4px 10px
内含小图标 + 文字
```

### 3.5 输入框

```
背景：--fm-surf2
文字：--fm-tx
边框：1px solid --fm-bdr（默认）→ --fm-bdr2（focus）→ --fm-ac（可选高亮 focus）
圆角：10-12px
内边距：10px 12px
字号：13-14px
占位符色：--fm-tx3
```

Focus 状态：边框变为 `--fm-bdr2`。不使用 outline，使用 border 变化。

### 3.6 列表项 / 可点击行

```
背景：--fm-surf（默认）
选中态背景：半透明 --fm-ac
选中态边框：1px solid，半透明 --fm-ac（alpha 约 0.3）
圆角：12px
内边距：12px 14px
字号：主文本 13px/600，副文本 11px/--fm-tx3
间距：margin-bottom: 4px
```

### 3.7 胶囊标签（Pill / Tag）

用于 RPE 标签、计算规则标签、状态标签等。

```
字号：10px / 600-700
圆角：20px
内边距：3-4px 8-10px
颜色 + 背景：语义色 + 对应半透明背景
```

RPE 颜色映射：
| RPE | 颜色 |
|-----|------|
| ≤ 7 | `--fm-green` |
| 8 | `--fm-orange` |
| ≥ 9 | `--fm-red` |

### 3.8 进度条

```
轨道：flex: 1, height: 6px, background: --fm-surf2, border-radius: 3px
填充：height: 100%, background: --fm-ac, border-radius: 3px
宽度：按比例计算（如 e1rm / maxE1rm * 100%）
动效：transition: width 0.3s
```

### 3.9 状态胶囊（StatusPill）

用于 AI 助手的状态机可视化。

```
字号：11px / 700
圆角：20px
内边距：4px 10px
颜色：对应状态色
背景：状态色 + alpha 18（深色）/ 12（浅色）
```

活跃状态（thinking / tool_calling / answering）前面加一个 5×5px 脉冲圆点（`pulse` 动画）。

| 状态 | 颜色 | 标签文字 |
|------|------|----------|
| idle | `--fm-tx3` | 空闲 |
| thinking | `--fm-ac` | 思考中 |
| tool_calling | `--fm-blue` | 工具调用 |
| answering | `--fm-purple` | 回答中 |
| done | `--fm-green` | 完成 |
| error | `--fm-red` | 错误 |

---

## 4. 页面规范

### 4.0 登录页（AuthScreen）

全屏居中布局，不显示底部 Tab Bar。

**结构**（从上到下居中）：
1. Logo 图标：56×56，圆角 16px，`--fm-ac` 背景 + 闪电图标
2. 标题："FitMind AI"，28px/800
3. 副标题："AI 驱动的个性化训练决策系统"，13px/`--fm-tx2`
4. 登录/注册切换：双格 toggle（背景 `--fm-surf2`，圆角 14px，内部按钮圆角 12px，激活态有阴影）
5. 表单字段：注册模式多一个"昵称"字段
6. 提交按钮：全宽主按钮
7. 底部提示："Token 仅保存在内存 · 刷新后需重新登录"（11px/`--fm-tx3`，前面带橙色小圆点）

右上角放深浅切换按钮。

**交互逻辑约束**：
- 不改 token 内存保存机制
- 不写入 localStorage / sessionStorage / cookie
- 调用外部传入的 `onRegister` 或 `onLogin`
- 错误态显示在表单区域内

### 4.1 Tab ① 训练记录

**页面结构**（从上到下滚动）：

#### 4.1.1 快速统计栏

3 列 StatCell 网格，数据来自 training summary。

| 格子 | 颜色 |
|------|------|
| 本月训练 XX 次 | `--fm-ac` |
| 总容量 XX kg | `--fm-blue` |
| 连续 XX 天 | `--fm-green` |

#### 4.1.2 "记录训练"按钮

全宽主按钮，含 `+` 图标 + "记录训练"文字。
点击后展开 WorkoutForm（替换此按钮位置）。

#### 4.1.3 WorkoutForm（展开态）

从 `--fm-surf` 卡片中展开（`slideUp` 动效）。

**表单内容**：
- 第一行：训练时间（datetime-local）+ 时长（number，分钟）—— 2 列 grid
- 第二行：备注（text input）
- 分割："训练组"标题 + "添加"按钮
- Set 行列表：每行包含序号圆点 + 动作搜索框 + 次数 + 重量(kg) + RPE + 删除按钮
  - Set 行背景：`--fm-surf2`，圆角 10px
  - 序号圆点：20×20，圆形，`--fm-surf3` 背景，`--fm-tx3` 文字
- 底部按钮行：取消（次级）+ 创建训练（主按钮，flex: 2）

**Set 行中的动作搜索**：
- 输入时调用 `searchExercises`
- 下拉结果列表：每条显示中文名 + 英文名 + 肌群标签
- 选中后输入框显示动作名，锁定 `exerciseId`

**提交后刷新联动**（逻辑约束，不可更改）：
1. WorkoutForm reset
2. 刷新 workout list
3. 刷新 training summary
4. 刷新 recommendation context
5. 如果已有 selected exercise → 刷新 exercise progress

#### 4.1.4 训练日志列表

列表标题行："训练日志"（15px/700）+ 条数标签（11px/`--fm-tx3`）。

**WorkoutCard**（每条训练记录）：

折叠态：
```
┌──────────────────────────────────────┐
│  5/7 09:30  [周三]                   │
│  65分钟 · 5组 · 状态不错 深蹲PR       │  ▽
└──────────────────────────────────────┘
```

- 日期：14px/700 + 周几 pill（10px，`--fm-surf2` 背景，圆角 20px）
- 摘要：12px/`--fm-tx3`
- 右侧：展开/收起箭头（chevron down，180deg 旋转切换）

展开态（`slideUp` 动效）：
- 按动作分组显示
- 动作名：12px/700/`--fm-ac`，前面带 dumbbell 图标
- 每组 set 一行：`--fm-surf2` 背景，圆角 8px
  - 序号（`--fm-tx3`）| 次数 × 重量kg | RPE 胶囊标签
- 底部右对齐：删除按钮（icon button，`--fm-red` 图标）

**删除交互**：
1. 点击删除 → `window.confirm` 确认
2. 确认后：调用 `deleteWorkoutById`
3. 刷新联动：同创建后的联动逻辑

### 4.2 Tab ② 确定性分析

**页面结构**（从上到下滚动）：

#### 4.2.1 30 天总览

标题行："30 天总览"（15px/700）+ `Training Summary` 技术 badge（`--fm-ac` 色系）。

4 格 StatCell（2×2 grid）：

| 格子 | 颜色 |
|------|------|
| 训练次数 | `--fm-ac` |
| 总组数 | `--fm-blue` |
| 总次数 | `--fm-purple` |
| 总容量 | `--fm-orange` |

数据语义：30 天日期范围（today - 29 天 到 today），与 `useTrainingSummary` 一致。

#### 4.2.2 重点动作列表

标题："重点动作（点击查看进展）"（13px/700/`--fm-tx2`）。

每条为可点击行：
- 选中态：半透明 `--fm-ac` 背景 + 半透明 `--fm-ac` 边框
- 左侧：动作名（13px/600）
- 右侧：组数 · 容量（11px/`--fm-tx3`）
- 点击后：更新 `selectedProgressExerciseId` 和 `selectedProgressExerciseName`
- 再次点击：取消选中

**TOP 5 限制**：只取 `summary.by_exercise` 前 5 条。

#### 4.2.3 动作进展面板

卡片标题：选中动作时为 `{动作名} 进展`，未选中时为 `动作进展`。
技术 badge：`Exercise Progress`（`--fm-purple` 色系）。

**空态**（未选中动作）：
- 居中 target 图标 + "在上方选择一个动作查看进展"（13px/`--fm-tx3`）

**有数据态**：
- 3 格统计（1×3 grid）：最大重量、预估 1RM（高亮背景）、总容量
- 1RM 趋势条形图：每行 = 日期（monospace 10px）+ 进度条 + 数值（11px/700）
- 数据来源：`getExerciseProgress` API

#### 4.2.4 推荐上下文

卡片标题："推荐上下文"。
技术 badge：`Deterministic`（`--fm-blue` 色系）。

**内容**：
- 说明文字："此面板展示确定性计算层的输出，不涉及 AI 推理。AI 助手通过 Tool Calling 调用这些结构化结果。"（12px/`--fm-tx2`）
- 计算规则标签列表：胶囊标签，`--fm-purple` 色系

**关键约束**：此面板是 deterministic preview，**不是** AI 生成建议面板。

### 4.3 Tab ③ AI 助手

此 Tab 不使用常规滚动布局，而是**全屏聊天布局**，高度为 `calc(100vh - header - tabbar)`。

**结构**（从上到下）：
```
┌─────────────────────────┐
│  Status Bar             │  ~40px
├─────────────────────────┤
│  Quick Prompts          │  ~44px
├─────────────────────────┤
│                         │
│  Message List           │  flex: 1, overflow-y: auto
│                         │
├─────────────────────────┤
│  Context Note（可选）   │  条件显示
├─────────────────────────┤
│  Input Bar              │  ~64px
└─────────────────────────┘
```

#### 4.3.1 Status Bar

左侧：StatusPill（状态胶囊）+ 活跃 Tool Call 信息。
右侧：清空对话按钮（icon button）。

**Tool Call 信息**（仅在 `activeTool` 非 null 时显示）：
```
[tool icon] get_training_summary ● （running 时脉冲点）
[tool icon] get_training_summary ✓ 234ms （success 时）
```
- monospace 字体，`--fm-blue` 色系胶囊

#### 4.3.2 Quick Prompts

水平滚动区域，3 个胶囊按钮：

| 按钮 | mode | 默认消息 | 是否可用 |
|------|------|----------|----------|
| 训练总览 | `training_overview` | "展示我的训练总览" | 始终可用 |
| 动作进展 | `exercise_progress` | "展示{selected exercise}的进展" | 仅当 `selectedExerciseId` 存在 |
| 推荐上下文 | `recommendation_context` | "构建推荐上下文" | 始终可用 |

禁用态：`opacity: 0.4`，`cursor: not-allowed`。

#### 4.3.3 Message List

空态：
- 居中显示 bot 图标（48×48，`--fm-surf2` 背景，圆角 14px）
- "FitMind AI 助手"（14px/600）
- "通过 Tool Calling 调用确定性计算工具 / 生成可追溯的个性化训练建议"（12px/`--fm-tx3`）

每条消息结构：

```
┌─ 头像 (22×22, 圆角 7px) ─ 角色名 (11px/600/--fm-tx3) ─────┐
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 消息气泡                                                │ │
│  │ 圆角 14px, padding 12px 14px                           │ │
│  │ 字号 13px, 行高 1.7                                    │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Evidence 引用块（可选）────────────────────────────────┐ │
│  │  [tool] Evidence · get_recovery_status                  │ │
│  │  疲劳评分 5.2/10 · 距上次训练 2 天                      │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**用户消息**：
- 头像：`--fm-surf2` 背景，user 图标，`--fm-tx3` 色
- 角色名："你"
- 气泡背景：`--fm-surf2`

**AI 消息**：
- 头像：半透明 `--fm-ac` 背景，闪电图标，`--fm-ac` 色
- 角色名："FitMind AI"
- 气泡背景：`--fm-surf`，1px `--fm-bdr` 边框

**Evidence 引用块**：
```
margin-top: 6px
padding: 8px 12px
background: 半透明 --fm-blue
border: 1px solid 半透明 --fm-blue（alpha 更高）
border-radius: 10px
标题: monospace, 10px/700, --fm-blue, 含 tool 图标
内容: 12px/--fm-tx2
```

**思考中动画**：3 个 5×5px 圆点，`--fm-tx3` 色，`dotBounce` 动画，每个延迟 120ms。

**计划草案卡片（AssistantPlanCard，roadmap §8 Slice 3）**：当助手消息带结构化 `plan`（`next_week_plan`）时，在 agent trace 之下、Evidence 之上渲染。

```
背景: --fm-surf2, 边框 1px --fm-bdr, 圆角 control（同 agent trace 容器）
<details open> 头部: zap 图标 + "下周训练草案 · N 个动作" + 策略 chip（巩固/控制疲劳 · 可小幅加量 · 维持基线）
动作行（--fm-surf 卡片, 圆角 10px）:
  - 第一行: 动作名（13px/700）+ 目标重量（右侧，有基线时 --fm-ac "目标 X kg"，无则 --fm-tx3 "沿用上次重量"）
  - 第二行: "N 组 × a~b 次" pill（--fm-surf2）
  - basis 说明（11px/--fm-tx3）
底部 notes: 项目符号列表（11px/--fm-tx2）
```

约束：目标重量为 null 时显示"沿用上次重量"，**不编造数字**（与后端 D23 一致）。卡片纯展示，不内联进答案文本，不参与 faithfulness 数字扫描。

卡片底部「设为本周计划」按钮（roadmap §8 FE-2）：全宽主按钮（--fm-ac / --fm-ac-txt）。接受中→"接受中…"禁用；接受成功→"已设为本周计划"（--fm-surf3 灰底 + --fm-tx2，禁用）。点击 POST `/api/planned-workouts`（周期=今天起 7 天），成功后页面顶部「本周计划」卡片刷新。

**本周计划卡片（AssistantCurrentPlanCard，roadmap §8 FE-2）**：常驻在 AI 助手页顶部（IntroCard 之下），`GET /api/planned-workouts/current`，**哪天打开都在**。

```
Card（--fm-surf）。头部: zap 图标 + "本周计划"（15px/700）+「放弃计划」次级按钮
空态: "还没有本周计划。让助手生成下周训练草案后，点草案上的「设为本周计划」…"
有计划:
  - 周期行: "起 ~ 止 · 动作 trained/planned 已练 · 组数依从 XX%"（12px/--fm-tx2）
  - 进度条（动作依从比例，--fm-ac 填充）
  - 逐动作行（--fm-surf2, 圆角 soft）: 动作名 + 状态 chip（已完成=success / 部分=warning / 未练=neutral）+ "performed/planned 组"
  - 计划外动作数提示 + 错误提示（如有）
```

交互约束：放弃操作必须等待 `PATCH` 落地后再提示结果；成功只提示一次「已放弃本周计划」，失败必须展示服务端返回的 HTTP 状态与 message，绝不能同时出现成功提示。变更请求进行中时，「放弃计划」与「展开/收起」均禁用，避免刷新和折叠状态竞态。

模型：本周「目标动作集」——接受一次设为本周目标，真实训练按周自动匹配出依从度（不强排到具体某天）。详见 `ai-decisions.md` D26 / 闭环设计。

#### 4.3.4 Context Note

仅当未选中动作时显示：
```
背景: 半透明 --fm-orange
边框: 顶部 1px --fm-bdr
内容: "前往「分析」选择动作后可使用「动作进展」快捷指令"
字号: 11px, 颜色: --fm-orange
前置 target 图标
```

#### 4.3.5 Input Bar

```
背景: --fm-surf
顶部: 1px --fm-bdr 分割线
内边距: 10px 16px 12px
布局: flex row, gap 8px
```

- 输入框：`flex: 1`，14px，`--fm-surf2` 背景，`--fm-bdr2` 边框，圆角 12px
- 发送按钮：44×44px，圆角 12px
  - 有输入时：`--fm-ac` 背景，`--fm-ac-txt` 图标色
  - 无输入时：`--fm-surf3` 背景，`--fm-tx3` 图标色
- 流式进行中时，发送按钮变为停止按钮：`--fm-red` 背景，白色 stop 图标

---

## 5. 状态规范

### 5.1 加载态

- 骨架屏（优选）：使用 `--fm-surf2` 背景色块 + shimmer 动画
- 简单场景：使用 `pulse` 动画的状态文字

### 5.2 空态

居中布局，包含：
- 图标：对应功能图标，24px，`--fm-tx3` 色
- 说明文字：13px/`--fm-tx3`，`margin-top: 8px`，最多 2 行

### 5.3 错误态

在对应区域内显示：
- 背景：半透明 `--fm-red`
- 文字：12px/`--fm-red`
- 可选重试按钮

### 5.4 成功态

短暂显示（3 秒后自动消失或手动关闭）：
- 背景：半透明 `--fm-green`
- 文字：12px/`--fm-green`

---

## 6. 主题切换

### 6.1 实现方式

推荐使用 React Context 或 Zustand store 管理 `isDark: boolean`。

所有组件通过 theme object（`t` 变量）获取当前色值，**不直接读 CSS 变量**（因为移动端 390px 容器不一定是根元素）。

切换按钮位于 Header 右侧。图标：深色模式显示太阳（切换到浅色），浅色模式显示月亮（切换到深色）。

### 6.2 切换范围

整个应用所有组件同步切换，无逐组件覆盖。

---

## 7. 图标规范

全部使用内联 SVG，不引入图标库。

统一参数：
```
viewBox="0 0 24 24"
fill="none"
stroke="currentColor"
strokeWidth="2"
strokeLinecap="round"
strokeLinejoin="round"
```

大小按场景：
| 场景 | 尺寸 |
|------|------|
| Tab Bar | 20px |
| Header Logo 内 | 14px |
| Icon Button 内 | 13-14px |
| 列表项/标签内 | 12px |
| 气泡头像内 | 11px |
| 内联小图标 | 10px |

需要的图标列表：
`zap` `dumbbell` `chart` `bot` `send` `plus` `x` `chevron-down` `chevron-right`
`tool` `target` `user` `clock` `eye` `trash` `refresh` `check` `search`
`sun` `moon` `stop`

---

## 8. 不可更改的逻辑约束

以下逻辑在 UI 重构中**必须保留**，完整列表见 `docs/frontend-current-state.md` 第 10 节。
此处列出与 UI 直接相关的关键项：

1. **Token 内存保存**：不写入 localStorage / sessionStorage / cookie
2. **SSE 状态机语义**：idle → thinking → tool_calling → answering → done / error
3. **activeToolCall 数据来源**：必须来自 SSE `tool_call_started` / `tool_call_finished` 事件，不能从消息文本推断
4. **sessionId 跨多轮复用**：前端不重新生成，必须使用后端返回的
5. **Quick Prompt mode/payload**：三种 mode（training_overview / exercise_progress / recommendation_context）不可更改
6. **Exercise Progress 按钮禁用逻辑**：未选中动作时必须禁用
7. **创建/删除 workout 后的刷新链路**：必须完整触发 workouts list + training summary + recommendation context + exercise progress（如果已选中）
8. **set_index 前端计算**：提交前按 exercise_id 分组递增
9. **RecommendationContextPanel 定位**：确定性 preview，不是 AI 建议面板

---

## 9. 文件结构建议

以下结构仅为建议，可根据实际重构情况调整，但主题管理和组件分层的思路应保留。

```
client/src/
├── theme/
│   ├── tokens.ts          // dark + light 色值 export
│   └── ThemeContext.tsx    // isDark state + Provider
├── components/
│   ├── Card.tsx
│   ├── StatCell.tsx
│   ├── Badge.tsx
│   ├── StatusPill.tsx
│   ├── Pill.tsx           // RPE tag, evidence tag 等
│   ├── ProgressBar.tsx
│   ├── IconButton.tsx
│   ├── Input.tsx
│   └── Icon.tsx           // 统一 SVG 图标组件
├── features/
│   ├── auth/
│   │   └── AuthScreen.tsx
│   ├── training/
│   │   ├── TrainingView.tsx
│   │   ├── WorkoutForm.tsx
│   │   ├── WorkoutCard.tsx
│   │   └── ExerciseDictionary.tsx  // 可选独立
│   ├── analysis/
│   │   ├── AnalysisView.tsx
│   │   ├── SummarySection.tsx
│   │   ├── ExerciseProgressPanel.tsx
│   │   └── RecommendationContextPanel.tsx
│   └── assistant/
│       ├── AssistantView.tsx
│       ├── ChatMessageList.tsx
│       ├── ChatInputBar.tsx
│       ├── QuickPromptBar.tsx
│       ├── StatusBar.tsx
│       └── EvidenceBlock.tsx
└── App.tsx                // Tab 路由 + 状态编排
```

---

## 10. Checklist：新组件上线前自查

- [ ] 是否使用了 theme object 获取色值（不硬编码）？
- [ ] 圆角是否符合第 1.4 节规范？
- [ ] 字号/字重是否符合第 1.2 节规范？
- [ ] 空态、加载态、错误态是否都有处理？
- [ ] 深色/浅色两种主题下是否都可读？
- [ ] 半透明背景是否区分了深色/浅色模式的 alpha？
- [ ] 是否遵守了第 8 节的逻辑约束？
- [ ] 新增的交互是否需要在 `frontend-current-state.md` 中补充文档？
## 11. 训练档案表单（AthleteProfileSheet，roadmap §8 FE-3）

Header 右侧操作区加「训练档案」user IconButton（在「反馈」左侧），点开 ActionSheet 表单（Slice 4 运动员档案）：

```
描述: "档案会注入下周计划：目标决定次数/强度，伤病/每周天数加保守提示。"
字段（label 12px/500/--fm-tx2）:
  - 训练目标: select（力量/增肌/耐力/综合健身）
  - 每周训练天数: select（1~7 天）
  - 可用器械: chip 多选（杠铃/哑铃/器械/绳索/自重/壶铃），选中=半透明 --fm-ac 底 + --fm-ac 边/字
  - 伤病约束（可选）: Input，placeholder "用逗号分隔，如：膝盖, 肩"
footer: 取消（次级）+ 保存档案（主按钮 flex:2）
```

行为：开表单 `GET /api/athlete-profile` 预填（无则默认增肌/3 天/空）；保存 `PUT`，伤病文本经 `parseInjuryTags`（逗号/空格分隔、去重、小写、≤10 个/≤40 字）。保存成功关闭表单 + Header 显示"训练档案已保存"。

## 12. faithfulness 徽章 + 限流提示（roadmap §8 FE-4）

**faithfulness 徽章（Slice 1）**：助手消息头部（角色名旁、非流式时）渲染 Badge——verified→`✓ 数据已核对`（success 绿）/ flagged→`⚠ N 处待核`（warning 橙，N=未核对数字个数）。来源 `structured_output.faithfulness`；unchecked/未知状态不渲染。

**限流友好提示（Slice 6）**：助手 turn 触发 429 时，`use-assistant-chat` 把错误码映射成中文——`RATE_LIMITED`→"AI 请求太频繁了，请约 N 秒后再试。"（N 取 `error.details.retry_after_seconds`，无则"稍等片刻"）；`AI_QUOTA_EXCEEDED`→"今天的 AI 使用次数已用完，明天再来吧。"。`AssistantChatPanel` 的错误 StateNotice 改为展示真实 errorMessage（标题"助手暂时无法回应"）。
