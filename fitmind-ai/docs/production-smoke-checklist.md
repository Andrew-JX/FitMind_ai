# Production Smoke Checklist

Production targets:

- Mainland invite-only candidate: `https://fitmind.jimmyuuu.com/`
- Overseas portfolio demo: `https://fitmind-ai-psi.vercel.app/`

Use this checklist before sending the app to an interviewer, friend, or recruiter. Mark an item passed only after it has been checked in the live app.

## Infrastructure preflight (Tencent Cloud target)

- [ ] `fitmind.jimmyuuu.com` resolves to `115.159.102.34`.
- [ ] `https://www.jimmyuuu.com/` redirects to `https://fitmind.jimmyuuu.com/`.
- [ ] TLS covers both DNS names and `certbot renew --dry-run` succeeds.
- [ ] `curl --fail https://fitmind.jimmyuuu.com/api/health` returns the wrapped `{ status: "ok" }` response.
- [ ] `docker compose -f deploy/compose.yaml ps` reports both `api` and `web` healthy.
- [ ] FitMind is reachable only through public 80/443; API 3000 and Web 8081 remain loopback-only, and PostgreSQL 5432 is not exposed.
- [ ] Existing public 8080 still serves only `/etc/nginx/sites-enabled/mj-portfolio`; FitMind does not alter or depend on it.
- [ ] Footer displays `苏ICP备2026054660号` and links to the MIIT filing query.
- [ ] `DATA_RESIDENCY=overseas`; registration asks for separate cross-border consent because Neon is in AWS Singapore.
- [ ] Privacy policy names the current contractual recipient and actual region before the site accepts real user data.

## Browser Setup

- [ ] Open the target URL in a normal browser tab.
- [ ] Open the same URL in a mobile viewport or on a phone.
- [ ] Confirm the app loads without a blank screen.
- [ ] Confirm there is no horizontal overflow on the login screen.

## Auth

- [ ] Register a fresh test user, or log in with an intentional test account.
- [ ] Confirm invalid login credentials show a friendly message.
- [ ] Confirm logout returns to the login screen.
- [ ] If a token expires or a `401` is reproduced, confirm the UI says `登录已过期，请重新登录。`.
- [ ] Confirm the login screen can remember the email only, without storing password or token.

## Training

- [ ] Create a workout manually with at least one exercise, weight, and reps.
- [ ] Confirm the workout appears in the history list.
- [ ] Open the workout detail.
- [ ] Edit one set or metadata field and save.
- [ ] Delete the test workout and confirm it disappears.
- [ ] Confirm loading, empty, and error states use the shared `StateNotice` style.

## Intake

- [ ] Open text intake.
- [ ] Parse a simple workout sentence.
- [ ] Save the parsed draft.
- [ ] Confirm the saved intake workout appears in history.
- [ ] Open the saved workout and edit the training time.
- [ ] Voice intake can recover from the mobile microphone permission prompt with visible Done / Cancel controls.

## Analysis

- [ ] Open the Analysis tab after creating or saving a workout.
- [ ] Confirm Training Summary refreshes.
- [ ] Select an exercise and confirm Exercise Progress loads.
- [ ] Confirm Recommendation Context Preview loads.
- [ ] Confirm Muscle Load either shows data or a friendly empty/thin-evidence state.

## AI Assistant

- [ ] Open the AI Assistant tab.
- [ ] Confirm the insight dashboard loads or shows a friendly empty/error state.
- [ ] Send one training-related quick prompt.
- [ ] Confirm the assistant either answers with training context or shows a scoped error state.
- [ ] Confirm unsupported/general prompts do not get presented as medical or unrestricted advice.

## Product Feedback

- [ ] Confirm the Feedback button is visible only after login.
- [ ] Submit rating-only feedback.
- [ ] Submit message-only feedback.
- [ ] Submit rating + message feedback.
- [ ] Confirm empty feedback is blocked in the UI or returns the Chinese validation error from `/api/feedback`.
- [ ] Confirm `product_feedback.user_id` is the authenticated user id, not a client-provided body value.

## Mobile Readiness

- [ ] Login screen fits a narrow mobile viewport.
- [ ] Training tab has no clipped primary controls.
- [ ] Intake modal fits the viewport and can be dismissed.
- [ ] Workout edit and time edit controls are reachable.
- [ ] Analysis cards wrap without horizontal scrolling.
- [ ] AI Assistant composer and messages remain usable on mobile.

## PWA Install Experience

- [x] Browser devtools detects `/manifest.webmanifest`.
- [x] Manifest shows `FitMind AI`, standalone display mode, and 192 / 512 icons.
- [x] iOS Safari can add the app to the home screen.
- [ ] Android Chrome shows Add to Home screen or Install app. Pending real Android device validation.
- [x] Installed app opens in standalone mode rather than a normal browser tab on iPhone Safari.
- [ ] App refresh still loads the training UI after service worker registration.
- [ ] Offline navigation shows the friendly offline fallback page.
- [x] `/api/health` still returns a live 200 response when online.
- [x] `/api/*` responses are not served stale from the service worker cache by `sw.js` design.
- [ ] Login still works after the PWA changes.
- [ ] Training create/edit still works after the PWA changes.
- [ ] Intake still works after the PWA changes.

## 2026-06-01 iPhone Safari Notes

- Passed: add to home screen works, FitMind opens with an app-like standalone feel, icon appears on the home screen.
- Found: because auth token is intentionally memory-only, reopening after the OS ends the PWA process requires login again.
- Found: the previous press-and-hold voice input could get stuck after the iOS microphone permission prompt interrupted the pointer gesture.
- Action in Batch 7B.1: keep token memory-only, add email-only remember convenience, and add visible voice Done / Cancel controls.
- Android Chrome: pending real-device validation.

## Cookie Session (Phase 5.3 Batch 1) — 真机回归

> 部署后先确认新版本已上线：登录页底部文案应为「登录状态保存在安全的 HttpOnly 会话 cookie 中，刷新页面后会自动保持登录。」（旧版写的是"仅保存在内存中"）。看到新文案才说明 Vercel 已部署最新构建。

- [ ] 手机浏览器打开 `https://fitmind-ai-psi.vercel.app/`，注册 / 登录一个测试账号。
- [ ] **关键**：登录后**下拉刷新 / 重新加载页面** → 仍保持登录，不回登录页（这是 Batch 1 的核心修复）。
- [ ] 关闭标签页后重新打开同一 URL → 仍登录（7 天内）。
- [ ] 点「退出登录」→ 回到登录页；再刷新 → 仍是登录页（cookie 已清）。
- [ ] 在隐私 / 无痕窗口打开 → 显示登录页（无会话 cookie）。

## Phase 5.3 Batch 3 — 真机性能测试流程

目标：实测并回填 `PROJECT_BRIEF.md §11` 的指标。下面三种方法按"准确度 / 便利度"排序，按需选用。

### 方法 A — Lighthouse 移动端（首屏类指标，最可复现，建议写进 README 的就是这个）

1. 任意桌面 Chrome 打开 `https://fitmind-ai-psi.vercel.app/`。
2. DevTools（F12）→ Lighthouse 面板 → 设备选 **Mobile** → 勾 Performance → Analyze page load。
3. 记录：First Contentful Paint、Largest Contentful Paint、Speed Index、Time to Interactive。
   - 用 **LCP / TTI** 对照 §11 的「首屏加载 < 2s」。

### 方法 B — 安卓手机真机 + 远程调试（API / SSE 类指标最准）

1. 手机开「开发者选项 → USB 调试」，USB 连电脑。
2. 桌面 Chrome 打开 `chrome://inspect` → 找到手机上的标签页 → inspect。
3. 在弹出的 DevTools 用 **Network** 面板在真机上操作并读时延：
   - **训练日志列表（100 条）**：先用账号造 ~100 条训练（可跑 `pnpm seed:assistant-demo` 或手动多记几条），切到训练 tab，看 `GET /api/workouts` 的 Time（目标 < 500ms）。
   - **AI 首 token TTFT**：在助手里发一句（如「帮我做一份本周训练报告」），看 `POST /api/assistant/stream-turn` 从发起到**第一个 SSE chunk** 的时间（目标 < 1.5s）。
   - **Tool Calling 端到端**：同一次请求从发起到 `done` 事件 / 回答渲染完成的总时长（目标 < 5s）。
   - **SSE 渲染流畅度**：Performance 面板录一段流式回答，看有无明显掉帧（目标接近 60fps）。

> iPhone 真机需要 Mac + Safari「开发」菜单做 Web Inspector，方法同理。

### 方法 C — 纯手机粗测（没有电脑时）

- 首屏：秒表掐"点开链接 → 看到登录页"的时间。
- TTFT / Tool 端到端：秒表掐"发消息 → 出现第一个字"和"→ 回答结束"。
- 仅作量级参考（"约 Ns"），README 正式数字仍建议用方法 A/B。

### 结果记录（实测后回填，删掉 TBD）

| 指标 | 目标 | 实测 | 方法 | 设备 / 网络 |
| --- | --- | --- | --- | --- |
| 首屏加载（LCP/TTI） | < 2s | TBD | | |
| AI 首 token TTFT | < 1.5s | TBD | | |
| Tool Calling 端到端 | < 5s | TBD | | |
| SSE 渲染流畅度 | ~60fps | TBD | | |
| 训练日志列表（~100 条） | < 500ms | TBD | | |

> 回填后，把达标的数字同步到 `README.md` 与 `docs/project-study-guide.md`（面试稿），并在本表标注测试日期 / 机型 / 网络（Wi-Fi / 4G）。注意：助手 TTFT / Tool 端到端依赖 `ASSISTANT_PROVIDER`——线上若用 mock 则偏快，用真实 Anthropic 才是真实体验，记录时注明 provider。

## Verification Notes

- `pnpm test` is the unit-test lane only.
- `pnpm --filter @fitmind/client exec vite build` should emit `manifest.webmanifest`, `sw.js`, `offline.html`, and icon assets into `client/dist`.
- DB-backed smoke commands require a valid database environment:
  - `pnpm smoke:auth`
  - `pnpm smoke:training`
  - `pnpm smoke:assistant`
  - `pnpm smoke:workout-intake`
- Phase 4.8C vector RAG smoke additionally requires `VOYAGE_API_KEY`, the pgvector migration, and knowledge embedding backfill:
  - `pnpm --filter @fitmind/server run db:migrate`
  - `pnpm --filter @fitmind/server run embed:knowledge ../.env`
  - `pnpm --filter @fitmind/server run smoke:knowledge-rag ../.env`
  - When `VOYAGE_API_KEY` is set, the smoke asserts `Retrieval mode: vector`.
- This checklist is manual browser smoke. Do not mark it complete unless the live browser flow was actually run.
