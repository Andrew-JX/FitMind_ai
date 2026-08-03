# 中国境内上线计划（china-launch-plan）

> 状态：**规格，未执行**。写于 2026-07-31，主线（ER/PL 弧线）处于暂停状态，本文件不代表任何已完成的改动。
>
> 这份文档**不镜像代码**（见 [`INDEX.md`](./INDEX.md) 末节）。里面的 `file:line` 是 2026-07-31 的定位锚点，动手前请重新 grep 确认；真正有价值的是**决策理由和口径**，不是行号。

## 0. 前提：这次上线的形态（用户 2026-07-31 拍板）

| 维度 | 决定 |
| --- | --- |
| 备案主体 | **个人** |
| 开放范围 | **邀请制**：自己和朋友几个人用，不开放公开注册 |
| 服务器 | 腾讯云上海（自建 nginx + Node + Postgres/pgvector），域名 `jimmyuuu.com` 系 |
| 模型 | DeepSeek（OpenAI 兼容），境外 provider 全部不配 key |

**这两个决定是整份文档的地基。** 「个人主体 + 不面向公众」把合规部分从「若干个批次」压到「一个 footer + 两页文案 + 一个注册开关」。如果哪天改成公开注册，第 3 节被砍掉的那些**全部回来**，且届时最贵的是算法备案而不是写码——不要顺手翻这个开关。

---

## 1. 必须改才能跑起来

### 1.1 语音录入的 provider 也要切（最容易漏）

仓库里有**两个**模型开关，不是一个：

- `ASSISTANT_PROVIDER` → 对话助手
- `WORKOUT_INTAKE_LLM_PROVIDER` → 自然语言训练录入

第二个默认 `mock`，可选值里 `anthropic`（打 `api.anthropic.com`）和 `gemini`（打 `generativelanguage.googleapis.com`）在境内都不可达，见 `server/src/services/training/workout-intake-llm-parser.ts`。

改法：`WORKOUT_INTAKE_LLM_PROVIDER=openai_compatible`，纯配置。

**为什么单列一条**：只切 `ASSISTANT_PROVIDER` 的话，录入会静默退回规则解析器——不报错、不告警，用户说一长串只解析出第一个动作，而你从日志上看不出异常。这是一个**沉默的**降级。

### 1.2 RAG embedding：已知缺口，本次接受降级

`server/src/services/rag/voyage-embedding-client.ts` 硬编码 `api.voyageai.com`，模型常量写死 `voyage-4-lite`。DeepSeek 没有 embedding API，`OPENAI_COMPAT_*` 补不上这个洞。

**不阻塞上线**：`knowledge-retriever.ts` 的 `createDefaultEmbeddingProvider()` 在缺 key 时返回 `null`，检索退回词法模式。功能可用，知识类回答质量掉一档。

**为什么本次不修**：换国内 embedding（硅基流动 BGE-M3 / 阿里 DashScope text-embedding-v3）会改变向量维度 → pgvector 列定义要迁移 → 已入库的 chunk 必须全量重新 embed。这是一个独立批次（migration + 重跑 `embed:knowledge` + rag-eval 重新基线），不该塞进上线。

**记账**：这是本次上线**唯一一处主动接受的功能降级**，写在这里防止下次当新 bug 重挖。

### 1.3 部署出口还钉在 Vercel

`cloudflare-worker/index.js` 和 `functions/api/[[path]].js` 顶部都硬编码 `DEFAULT_API_ORIGIN = "https://fitmind-ai-psi.vercel.app"`。

自建部署下这两个文件根本不参与请求链路（nginx 直接反代到本机 Node），所以**不必改代码，但必须确认它们没被打包进新链路**。需要改的是 `README.md` 里那批指向 vercel 的生产 URL 和 PWA 安装指引。

### 1.4 nginx 必须关 SSE 缓冲

助手是 SSE 流式的。nginx 默认 `proxy_buffering on` 会把整条流缓冲成一次性输出，用户看到的是「转圈很久 → 全文突然出现」，流式体验归零。微信内置浏览器会让这个更明显。

反代块里需要：

```
proxy_http_version 1.1;
proxy_set_header Connection '';
proxy_buffering off;
proxy_cache off;
```

服务端对 SSE 响应加 `X-Accel-Buffering: no`（双保险，防其他中间层缓冲）。

**排查特征**：如果上线后有人说「AI 回答不是一个字一个字出来的」，先查这条，不要去动 orchestrator。

---

## 2. 时区：两处按 UTC 算，都不致命

助手这条线**是对的**：客户端在 `client/src/features/assistant/assistant-request-payload.ts` 里读设备时区随请求发出，ER-2 那批工作在境内有效。

有问题的是另外两处：

| 位置 | 现状 | 影响 | 处置 |
| --- | --- | --- | --- |
| `server/src/services/training/weekly-report-digest-service.ts` | 全程按 UTC 算「上周」边界；`wrangler.toml` cron `0 9 * * MON` = 北京时间周一 17:00 | 周日晚上的训练会落到错误的那一周 | **保持 `WEEKLY_REPORT_DELIVERY_ENABLED=off`**，别在修之前打开 |
| `server/src/services/assistant/assistant-budget-policy.ts` | 配额按 UTC 日切 | 北京时间早 8 点重置，体感怪 | 不修，无害 |

---

## 3. 合规：在「个人主体 + 邀请制」下的最小集

> 以下是工程视角的风险梳理，不是法律意见；具体判定以管局口径为准。

### 3.1 因为不面向公众而**不触发**的（记下来，防止下次重新恐慌）

- **生成式 AI 服务备案 / 算法备案**。《生成式人工智能服务管理暂行办法》管的是「面向境内公众提供」。注意一个常见误解：**用 DeepSeek 的 API 不等于免责**——DeepSeek 备案的是它自己的服务，服务提供者对外开放 AI 交互仍在监管范围内。是「不开放公众」让这条不触发，不是「用了已备案的模型」。
- **手机号实名**。同上，非公众服务。
- **内容安全审核（机审/人审）**。同上。

### 3.2 仍然必做

**(a) 服务端关闭公开注册 —— 本次上线唯一的功能性改动**

`server/src/controllers/auth-controller.ts` 的 `registerController` 目前无条件放行。接口裸在公网上，任何人 POST 就能建号——**那在监管口径上就是「面向公众开放」**，而这恰好是 3.1 整节成立的前提。

前端藏掉注册按钮**不算数**。必须在服务端拦：环境开关（如 `REGISTRATION_MODE=invite`）或邀请码校验，二选一，加测试钉。

> 这条不做，3.1 的三条豁免全部失效。它是整份文档承重的一块。

**(b) footer 挂备案号**

- ICP 备案号，展示在首页底部并链接 `https://beian.miit.gov.cn`
- 公安联网备案：上线 30 日内办理，号同样挂 footer

当前全项目 grep 不到任何「备案」字样，两处都要新加。

**(c) 隐私政策 + 用户协议（各一页简版）**

邀请制小范围也要有。需要说清三件事：数据存在哪、AI 对话内容如何处理（发往 DeepSeek、不用于训练、不出境）、**健身建议非医疗建议**。

**(d) 生产环境不配境外 key**

`VOYAGE_API_KEY` / `GROQ_API_KEY` / `ANTHROPIC_API_KEY` 一律留空。代码保留不影响（都有 fail-safe 分支）。不给 key 就没有对应的出站调用，这比在文档里声明「我们不调用」硬得多。

**但不要把它读成「不给 key = 没有个人信息出境」**——那句话原本写在这里，是错的。出境
还有另外两层不经过这几个 key：**浏览器内置的语音识别服务**（音频可能上传厂商云端，
本服务无法控制），以及**托管与数据库所在地**（境外实例的数据本身就存在境外）。境内
实例这三层同时在境内才成立，缺一层都不成立。

**(e) 账号注销：本次降级为人工**

PIPL 要求提供注销途径，但没规定必须是自助按钮。当前只有删训练记录（`server/src/controllers/workout-controller.ts`），没有删账号接口。邀请制下写明「联系 <邮箱> 删除」是站得住的。

**要开放注册时，这条必须先升级成接口**——和 (a) 是同一个开关的两面。

### 3.3 已经做对的（加分项，别改坏）

`server/src/services/assistant/assistant-safety.ts` 的中文医疗边界文案（「不能诊断」「不是治疗方案、用药建议」「请寻求医生帮助」）在健康类应用里是刚需，写得很规范。`ASSISTANT_SAFETY_GATE` 默认 on 且只认显式关闭 token——**上线时不要碰这个开关**。

---

## 4. 用户体验：境内特有

| 项 | 说明 | 本次处置 |
| --- | --- | --- |
| 微信内置浏览器 | 分享进微信是主要入口。X5 内核对 PWA 支持差，「添加到主屏幕」走不通 | `README.md` 那套 Safari/Chrome 安装指引对境内用户基本无效，需改写；微信内引导页押后 |
| SSE 在微信里 | 见 1.4，微信侧缓冲更激进 | 靠 nginx 配置解决 |
| 邮箱注册 | 境内用户习惯是手机号；邮件送达率也差 | 邀请制下不是问题（号是你手动建的），**开放注册时才需要重估** |

---

## 5. 执行清单

**⚠️ 合并前置：海外 demo 的 Vercel 配置必须先改。**

隐私政策现在写着模型调用只经 DeepSeek、知识检索不调第三方。这在 Vercel 改完之前
**不是真的**：`WORKOUT_INTAKE_LLM_PROVIDER` 仍是 `groq`，`VOYAGE_API_KEY` 仍有值。
环境变量只对**之后的部署**生效，而合并本身就会触发部署，所以正确顺序是：

1. 在 Vercel Production 保存 `WORKOUT_INTAKE_LLM_PROVIDER=openai_compatible`、删除
   `VOYAGE_API_KEY`（**先不要单独 redeploy**）；
2. 合并本批 → 触发生产部署，代码与配置同时生效；
3. 线上探针复验：录入一段自由口语，确认解析走的是 LLM 而非规则回退。

顺序反了，就是又一次让法律文案跑在实现前面——这条弧线被退回三次都是同一个形状。

**配置层（不动代码）**

- [ ] `ASSISTANT_PROVIDER=openai_compatible` + `OPENAI_COMPAT_BASE_URL=https://api.deepseek.com` + model + key
- [ ] `WORKOUT_INTAKE_LLM_PROVIDER=openai_compatible` ← §1.1，最容易漏
- [ ] `WEEKLY_REPORT_DELIVERY_ENABLED=off` 保持不动 ← §2
- [ ] `VOYAGE_API_KEY` / `GROQ_API_KEY` / `ANTHROPIC_API_KEY` 全部留空 ← §3.2(d)
- [ ] `ASSISTANT_SAFETY_GATE` 保持 on ← §3.3

**代码层**（分支 `china/launch-prep`，2026-07-31）

- [x] 服务端关闭公开注册 + 测试钉 ← §3.2(a)。`f2f567d`
- [x] 邀请制下的建号途径（`pnpm create:user`）+ 关闭注册的中文文案 ← `0c47c3a`
- [x] 隐私政策 + 用户协议两页（`client/public/legal/`）← §3.2(c)。`65480ef`
- [x] footer 组件与备案号接线 ← §3.2(b)。`d2ad3f7`
      **备案号本身还没填**：`VITE_ICP_BEIAN_NUMBER` 未配置时 footer 只显示两条法律链接，不显示占位号码。号下来后配环境变量重新构建即可，无需改码。公安备案号在上线 30 日内补 `VITE_PUBLIC_SECURITY_BEIAN_NUMBER`。
- [ ] `README.md` 生产 URL 与 PWA 指引改写 ← §1.3 / §4

**运维层**

- [ ] nginx 关 SSE 缓冲 + `X-Accel-Buffering: no` ← §1.4

**明确不做（有理由，别当遗漏）**

- embedding 国产化 ← §1.2，接受词法降级
- 周报时区 ← §2，功能保持 off
- 账号注销接口 ← §3.2(e)，人工代替
- 微信引导页 ← §4

---

## 6. 触发重估的条件

出现下面任何一条，回来重读 §3.1：

- 想开放公开注册
- 想把链接发到公开渠道（小红书 / 即刻 / 掘金等）引流
- 备案主体从个人变更为企业

前两条会让「面向公众」成立，§3.1 的三条豁免同时失效。

### 6.1 开放注册是计划中的事（2026-08-02 用户确认）

境内实例的邀请制是**阶段性**的，不是终局：先小范围用，之后要开放公开注册。

> 记账：这一条一度被写成已确认，而当时并没有确认过——用户拍板过的只有 §3.1 的地基
> （个人备案主体 + 邀请制）。审查抓出来后回退为未决，随后由用户明确确认为阶段性。
> 现在它是真的确认了。

**直接后果：§3.1 的三条豁免是有期限的。** 开放公开注册的那天，「不面向公众提供」
不再成立，下面三项同时回到桌面上，都必须在开放**之前**完成，而不是之后补：

1. 生成式 AI 服务的算法备案；
2. 用户实名（手机号 + 验证码，替换当前的纯邮箱注册）；
3. 内容安全审核机制。

因此"什么时候开放注册"不是一个产品排期问题，而是一个合规批次的触发器。

**文案与 UI 的对应**（本轮已落实）：用户协议写「当前不开放公开注册，之后计划开放」，
不承诺时间；不使用「以注册页是否可用为准」这类客户端无法证明的判据——`AuthScreen`
始终渲染注册入口，并不读服务端开关，提交后才会收到 `403 REGISTRATION_CLOSED`。让 UI
如实反映该开关是独立的前端批次，尚未做。

由此产生的两条约定：

- **法律文案按实例写明当前状态，并接受它需要人工维护。** 曾经想过让协议不写死状态、
  改用「以注册页实际是否可用为准」——这条已被否掉，因为客户端根本不知道服务端开关，
  这个判据不成立。也不能反过来写一句无实例限定的「当前不开放公开注册」：海外演示实例
  的注册是开着的，那样写对它就是假话。所以协议**按实例分别陈述**，代价是每次运营状态
  变化都要手工改文案——这个代价明确接受，因为替代方案（让静态法律页读运行时配置）
  比它贵得多，而实例只有两个。
- **算法备案要提前排，不能等到想开放的那天。** §3.1 已经写明这是届时最贵的一项，
  且不是写码能解决的。把它当成开放注册的**前置**，不是伴随项。

**盘点数据流时不要只看服务端出站。** 这一轮漏掉了浏览器内置的 Web Speech API：语音
按钮调的是 `SpeechRecognition`，音频由浏览器/操作系统处理，是否上传、上传到哪个国家
都不由本服务决定。删掉服务端的境外 provider 并不能消除这一层，托管与数据库在境外
同样不能。**"数据去了哪里"要按三层分别查：浏览器、服务端出站调用、托管与存储。**
