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
ASSISTANT_PROVIDER=mock
ANTHROPIC_API_KEY=optional_only_for_anthropic
```

说明：
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
pnpm --filter @fitmind/client type-check
pnpm lint
```

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

客户端浏览器 E2E 用 Playwright，**mock 后端**（route interception），不需要运行 API server、数据库或密钥。Playwright 会自己拉起 Vite dev server 再跑 Chromium headless。

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
