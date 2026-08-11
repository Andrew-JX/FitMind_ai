# FitMind AI Local Run Guide

## 1. Project Structure

`client`
- React + Vite 前端工作台。
- 当前本地开发端口是 `5173`。
- 默认通过 Vite proxy 把 `/api` 转发到后端。

`server`
- Express + TypeScript 后端。
- 当前本地默认端口是 `3000`。
- 提供认证、训练记录、确定性分析和 assistant SSE 接口。

`shared`
- 前后端共享类型与契约。
- 包含训练 DTO、认证类型、统一错误和响应结构。

`docs`
- 项目说明、架构、当前状态、阶段进度和排错记录。

## 2. Required Environment Variables

以仓库里的 `.env.example` 和 `server/src/env.ts` 为准。

服务端示例：

```env
DATABASE_URL=your_neon_postgres_url
JWT_SECRET=your_local_secret
REGISTRATION_INVITE_ONLY=off
DATA_RESIDENCY=overseas
ASSISTANT_PROVIDER=mock
ANTHROPIC_API_KEY=optional_only_for_anthropic
GROQ_API_KEY=optional_for_groq
OPENAI_COMPAT_BASE_URL=optional_https_openai_compatible_base_url
OPENAI_COMPAT_MODEL=optional_model_for_openai_compatible
OPENAI_COMPAT_API_KEY=optional_key_for_openai_compatible
```

说明：
- `REGISTRATION_INVITE_ONLY` **失败即关闭**：不设、留空、拼错都保持邀请制，只有显式 `off/false/0/no` 才开放注册。本地开发和 auth smoke 脚本需要它为 `off`。
- `DATA_RESIDENCY`（`overseas` | `mainland`）决定注册时是否强制要求跨境同意。**失败即境外**：不设或拼错都要求同意。本地设 `overseas` 才能走到同意勾选那条路径；设 `mainland` 可以验证勾选框正确消失。
- **不设 `DATA_RESIDENCY` 时本地注册会返回 `422 CONSENT_REQUIRED`**，这不是 bug —— 客户端会自动读 `GET /api/auth/registration-policy` 并渲染勾选框，只有绕开 UI 直接打 API 才会撞到它。
- 环境变量的**首尾空白只对枚举和模型名做裁剪**（`server/src/env.ts` 的 `TRIMMED_ENV_KEYS`）。密钥类变量原样保留字节：改写凭据会把一个吵闹的连接错误换成一个安静的灾难（trim 过的 `JWT_SECRET` 会让线上所有 cookie 失效且日志里毫无线索）。所以粘贴密钥时**自己确认没带上尾随换行**。
- `ASSISTANT_PROVIDER` 当前支持 `mock`、`anthropic` 和 `groq`，默认值是 `mock`（见 `ai-decisions.md` D34）。
- 使用 `anthropic` 时需提供 `ANTHROPIC_API_KEY`；使用 `groq` 时需提供 `GROQ_API_KEY`（可选 `GROQ_MODEL`，默认 `llama-3.3-70b-versatile`）。
- `ASSISTANT_PHRASING`（默认 `off`）：开启后让 LLM 改写答案 summary 措辞，**仅当 `ASSISTANT_PROVIDER=groq` 时生效**，且运行时 faithfulness 校验改写文本（见 `ai-decisions.md` D39）。
- 注意：Slice 11.1 只建好了 Groq provider 接缝，**路由仍走确定性分类器**；让 LLM 真正参与路由是 11.2。

客户端示例：

```env
VITE_API_BASE_URL=/api
```

说明：
- 仓库当前 `.env.example` 里 `VITE_API_BASE_URL` 是空值，也可以正常工作，因为前端默认会走相对路径并依赖 Vite proxy。
- 如果你想显式写本地开发配置，`/api` 是当前推荐写法。

## 3. Local Ports and Proxy

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`
- Vite proxy: `/api -> http://localhost:3000`

## 4. Install and Verify

在项目根目录执行：

```bash
pnpm install
pnpm verify
pnpm --filter @fitmind/server type-check
pnpm --filter @fitmind/server type-check:scripts
pnpm --filter @fitmind/client type-check
pnpm lint
```

`server` 的默认 `type-check` 会依次检查 production `src` 与 `server/scripts`；
`type-check:scripts` 只用于单独定位维护脚本、迁移验证脚本和 smoke 的类型错误，
不会把这些脚本加入 production `dist`。

## 5. Database Migration and Seed

仓库里当前真实存在的数据库命令如下：

迁移：

```bash
pnpm --filter @fitmind/server db:migrate
```

回滚一版：

```bash
pnpm --filter @fitmind/server db:migrate:down
```

Seed：

```bash
pnpm --filter @fitmind/server exec tsx scripts/seed.ts
```

说明：
- 当前 seed 没有单独 package script，上面这个 `tsx` 入口就是仓库现有方式。
- 如果没有可用的 `DATABASE_URL`，migration 和 seed 都无法完成真实入库。

## 6. Start Backend

根目录方式：

```bash
pnpm dev:server
```

等价方式：

```bash
pnpm --filter @fitmind/server dev
```

`server/package.json` 当前实际命令是：

```bash
tsx watch --env-file ../.env src/server.ts
```

## 7. Start Frontend

根目录方式：

```bash
pnpm dev:client
```

等价方式：

```bash
pnpm --filter @fitmind/client dev
```

## 8. Build

标准命令：

```bash
pnpm --filter @fitmind/client exec vite build
```

Windows fallback：

```powershell
cd client
.\node_modules\.bin\vite.cmd build
```

## 8.5 Browser E2E (Playwright)

客户端浏览器 E2E 用 Playwright，**mock 后端**（route interception），不需要运行 API server、数据库或密钥。Vite dev server 由 `client/e2e/global-server.ts` 拉起和关停，再跑 Chromium headless。

首次需要下载浏览器二进制（约 110MB，仅一次）：

```bash
pnpm --filter @fitmind/client exec playwright install chromium
```

运行 E2E：

```bash
pnpm test:e2e
# 或：pnpm --filter @fitmind/client run test:e2e
```

- 用例位置：`client/e2e/*.spec.ts`，mock 工具：`client/e2e/support/mock-api.ts`，配置：`client/playwright.config.ts`。
- 当前覆盖：鉴权会话流程（加载时 cookie 会话恢复、刷新保持登录、登录、登出、无会话回登录页）。
- 训练 / 分析 / 助手的全流程 E2E 留待后续批次；真实后端链路继续靠 `server/scripts/*-smoke.ts`。

**每次运行都自带一台 server，不复用现成的**（fitmind-yi7）。由 `client/e2e/global-server.ts`
启动和关停 Vite，不再使用 Playwright 的 `webServer`。因此：

- 5173 被占用时，运行会**立刻失败并说明端口**，不会静默接管别人的 server。
- 如果你自己开着 `pnpm dev`，跑 E2E 前要先停掉，否则会得到一个明确的端口错误。

### 进程生命周期回归

```bash
pnpm --filter @fitmind/client run verify:e2e-lifecycle
```

检查三件用测试结果看不出来的事：通过的运行会自行退出并释放端口；失败的运行同样清理干净；
端口被一台**能正常应答**的陈旧 server 占用时，命令拒绝启动而不是接管它。约 25 秒。

```bash
pnpm --filter @fitmind/client run verify:e2e-exit
```

连跑三轮根目录的 `pnpm test:e2e`，量「最后一条用例 → 进程退出」的静默，并要求每轮都是**自行**
退出（不是被夹具杀掉的）。预算 20 秒，当前实测 0.3–0.7 秒。

看门狗超时后会**强杀并校验**：先整树 `taskkill`（自身 10 秒上限），失败则 `SIGKILL`，有界轮询后
仍存活就释放该进程的 stdout/stderr 与句柄、以 `UNKILLABLE` 报失败并退出——绝不因为杀不掉而
陪着一起挂住。

这条路径需要一个既杀不死、又抗 `SIGKILL` 的进程才能自然触发，没法诚实地制造，所以留了两个
仅供验证用的环境变量：

```bash
FITMIND_E2E_SIMULATE_UNKILLABLE=1 FITMIND_E2E_MEASURE_CEILING_MS=5000   node client/scripts/measure-e2e-exit.mjs 1
```

它让所有强杀变成空操作。预期：11 秒内退出、打印 `UNKILLABLE`、退出码 1，并提示留下的那轮需要
手工清理（**确实会留下一个真实运行，记得清**）。

历史上这三件事都坏过，而当时每个用例都是绿的。

### 为什么 server 由 `e2e/global-server.ts` 自己管（fitmind-yi7）

症状是「35 条用例全部通过，然后命令长时间不退出」。逐段计时之后位置很明确：

```
最后一条用例 12.9s → 静默 148.2s → 打印汇总 → 0.0s 退出
```

时间不在用例里，也不在退出之后，而在**关停 Vite 这一步**。单变量验证：改成由外部启动、
Playwright 只复用不负责关停，静默立刻从 148.2 秒降到 0.4 秒。

具体开销是 Windows 上的 `taskkill /T`（整树遍历终止）。同一台机器上实测 3.8 秒到 96 秒不等，
正是这个方差让整轮耗时在 15 秒到 166 秒之间跳，也让外层 120 秒超时有时恰好砍在汇总行之前，
看起来就像「跑完了不退出」。

所以现在：

- 由 `client/e2e/global-server.ts` 启动和关停，先用 Node 直接终止进程（立即返回），
  只有在进程或端口没释放时才升级到 `taskkill /T`；
- **每一条外部命令都有硬时限**（`execFile` 的 `timeout`，10 秒）。之前所有 deadline 都写在
  `await taskkill` 的外面，而 taskkill 自己可能跑 96 秒——那种情况下 JS 层的 deadline 根本
  轮不到执行。边界必须落在被等待的那个东西上；
- server 的 stdio 是 `inherit` 而不是管道，没有任何句柄需要等待；
- 端口被占用时**拒绝启动并说明端口**，绝不接管不是本轮启动的 server；
- 关停后校验「进程已死」且「端口已释放」——这是两件不同的事实；
- 如果本轮的 server 已经死了、而 5173 被**别的**进程占着，**报错而不是杀它**。那个进程不是本轮
  启动的，可能是同事的 dev server，也可能是别的程序抢了端口。越界去终止它，和上一轮从这里删掉的
  「遍历进程表」是同一类错误。

修复前后的静默（最后一条用例 → 进程退出）：**90–148 秒 → 0.3–0.7 秒**。

一条排除掉的假设：观察到的 `/api` 代理 ECONNREFUSED 与本缺陷无关。Service Worker 只在
`import.meta.env.PROD` 注册（`client/src/register-service-worker.ts`），E2E 跑 dev server
根本不会注册。

## 9. Known Windows Issues

### `vite/esbuild spawn EPERM`

Symptom:
- `pnpm --filter @fitmind/client exec vite build` 失败，错误里包含 `esbuild` 或 `spawn EPERM`。

Likely cause:
- 当前 Windows / sandbox 环境对子进程启动有限制，`vite` 依赖的 `esbuild` 会被拦住。

Accepted workaround:
- 使用 package-local 命令：
- `cd client`
- `.\node_modules\.bin\vite.cmd build`

### `tsx/esbuild spawn EPERM`

Symptom:
- `pnpm --filter @fitmind/server exec tsx ...` 或 `pnpm dev:server` 类命令在当前环境报 `spawn EPERM`。

Likely cause:
- `tsx` 运行时同样依赖 `esbuild`，会受到相同的 Windows / sandbox 子进程限制。

Accepted workaround:
- 在允许的提权环境执行。
- 或使用 package-local `tsx.cmd` 路径执行同一个脚本。

### git `dubious ownership`

Symptom:
- 执行 `git status`、`git diff` 或其他 git 命令时出现 `detected dubious ownership in repository`。

Likely cause:
- 仓库目录所有者和当前 Windows 用户不一致，Git 默认会阻止操作。

Accepted workaround:

```powershell
git config --global --add safe.directory E:/studyspace/webroad/FitMind/fitmind-ai
```

### Neon `sslmode=require` warning

Symptom:
- 连接 Neon 时控制台出现 `sslmode=require` 相关警告。

Likely cause:
- 上游连接串或驱动提示 SSL 参数处理方式，不一定代表当前请求失败。

Accepted workaround:
- 如果 migration、seed、API smoke 已经实际通过，这个警告可以先视为已知环境提示。
- 优先确认真实连接是否成功，而不是只看 warning 文案。

## 10. Demo Smoke Path

手工演示可以按下面顺序走：

1. 启动后端，确认 `http://localhost:3000/api/health` 可访问。
2. 启动前端，打开 `http://localhost:5173`。
3. 注册一个新用户并登录。
4. 在“训练”页点击“记录训练”。
5. 创建一条 workout，至少添加一个动作和几组 sets。
6. 确认“训练”页的训练日志和顶部统计已更新。
7. 切到“分析”页，确认 30 天总览、动作进展、AI 可用上下文预览已更新。
8. 切到 “AI 助手” 页。
9. 直接使用“训练总览” quick prompt，或手动提问最近训练概况。
10. 确认状态栏会经历 SSE 状态变化，并最终看到助手回答。

## 11. Notes

- 本地前端端口以当前仓库代码为准，是 `5173`，不是任务描述里曾出现过的 `5174`。
- 本批没有改后端 API、assistant SSE contract、quick prompt mode、训练 CRUD 或 `set_index` 逻辑。

## 12. Tencent Cloud production

生产环境不是在本地 Windows 终端启动。已确认的目标是 Ubuntu 24.04 腾讯云轻量应用服务器，
API 与静态客户端由 Docker Compose 管理，宿主机 Nginx 负责 80/443 与 TLS。完整步骤见
[`deploy/README.md`](../deploy/README.md)。

两个数据库连接串用途不同：运行时 `DATABASE_URL` 使用 Neon pooler；
`MIGRATION_DATABASE_URL` 使用 direct connection。生产数据库位于 AWS Singapore，故即便应用服务器
在上海，`DATA_RESIDENCY` 仍必须是 `overseas`。

Compose 配置只允许用下面的无泄密检查：

```bash
docker compose -f deploy/compose.yaml config --no-env-resolution --quiet
```

普通 `docker compose config` 会把 `.env` 内容展开到输出，禁止用于生产配置检查、工单或聊天记录。

### 2026-07-01 OpenAI-Compatible BYO

- `ASSISTANT_PROVIDER` supports `mock`, `anthropic`, `groq`, and `openai_compatible`; default is still `mock`.
- `WORKOUT_INTAKE_LLM_PROVIDER` supports `off`, `mock`, `anthropic`, `gemini`, `groq`, and `openai_compatible`.
- `openai_compatible` uses the shared `OPENAI_COMPAT_BASE_URL` (must be `https`), `OPENAI_COMPAT_MODEL`, and `OPENAI_COMPAT_API_KEY` env vars for both assistant and intake. DeepSeek, Qwen/DashScope, Kimi, Zhipu, OpenAI, and similar `/chat/completions` endpoints fit this path.
- v1 limitation: if assistant and intake both select `openai_compatible`, they share the same endpoint/model/key. Mixing Groq for one seam and BYO for the other still works.
- `ASSISTANT_PHRASING=on` can run with `ASSISTANT_PROVIDER=groq` or `openai_compatible`; runtime faithfulness still gates the rewrite.
- Browser speech recognition remains Web Speech API. These settings configure the text LLM after speech-to-text, not cloud STT.
