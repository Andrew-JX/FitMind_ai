# fitmind-h22 — 发布关键 E2E 与 Assistant Eval 门禁契约

contract SHA：本文件首次提交所在的 commit；提交后记录到 Beads，后续 candidate 不得修改本文件。

baseline SHA：`8b846d548317c295223d3691d59160b22ff80d27`

candidate SHA：开工前为空。

契约文件路径：`E:\studyspace\webroad\FitMind\fitmind-ai\docs\contracts\fitmind-h22-release-gates.md`

允许改动文件：

- `.github/workflows/deploy-tencent.yml`
- `fitmind-ai/package.json`
- `fitmind-ai/client/package.json`
- `fitmind-ai/client/playwright.config.ts`
- `fitmind-ai/client/e2e/registration-consent.spec.ts`
- `fitmind-ai/client/e2e/injury-withdrawal.spec.ts`
- `fitmind-ai/client/src/features/auth/registration-consent-state.ts`
- `fitmind-ai/client/src/features/auth/registration-consent-state.test.ts`
- `fitmind-ai/client/src/features/auth/AuthScreen.tsx`
- `fitmind-ai/client/src/features/profile/injury-withdrawal-state.ts`
- `fitmind-ai/client/src/features/profile/injury-withdrawal-state.test.ts`
- `fitmind-ai/client/src/features/profile/AthleteProfileSheet.tsx`
- `fitmind-ai/server/src/deploy-workflow.test.ts`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/contracts/fitmind-h22-release-gates.md`

## 冻结事实

发布关键浏览器集合由以下命令的输出冻结：

`pnpm --filter @fitmind/client test:e2e -- e2e/registration-consent.spec.ts e2e/injury-withdrawal.spec.ts --list`

取数算法：只计该命令输出中以 `[chromium]` 开头的测试条目；冻结时为 21 条、2 个 spec 文件。该数字仅在本节保存，其他判据引用“发布关键浏览器集合”。

## 判据

判据 1：机器 · `pnpm test:e2e:release -- --list` 必须列出且只列出发布关键浏览器集合，不能通过空筛选获得绿灯。

- 度量：运行命令并逐项比对测试标题及来源文件；集合大小引用“冻结事实”。
- 已知的假绿灯：脚本拼错路径后零测试退出 0，或额外把非关键 UI finishing spec 混入发布门禁。

判据 2：机器 · `pnpm test:e2e:release` 必须完成发布关键浏览器集合且退出码为 0；注册请求必须携带服务端发布的政策版本，拒绝同意时不得发注册请求，伤病删除必须在 mock 后端状态中清空目标数据且保留其他档案字段。

- 度量：Playwright 的进程退出码、最终 passed/failed 汇总，以及两个 spec 内对请求体和 mock 后端状态的断言。
- 已知的假绿灯：只更新旧文案 locator 让页面可点，但删掉请求体、后端状态或“保留其他字段”的断言。

判据 3：机器 · 腾讯部署 workflow 必须在配置 deployment key 和执行 SSH 之前依次完成 repository verify、离线 assistant eval、生产 build、Chromium 安装和 release E2E；任一门禁失败不得进入 SSH。

- 度量：`pnpm test:unit -- server/src/deploy-workflow.test.ts` 解析 workflow step 顺序，拒绝 `continue-on-error`，并对删除 eval、删除 E2E、把 E2E 移到 SSH 后三种内存退化配置逐项证明失败。
- 已知的假绿灯：workflow 含有 `pnpm eval` 字符串，但它位于部署之后或被 `continue-on-error` 放行。

判据 4：机器 · CI 中 Playwright 失败必须上传可下载诊断产物，上传步骤本身不得遮蔽原始失败。

- 度量：同一 workflow 测试断言使用 `actions/upload-artifact@v4`、`if: failure()`、路径包含 `client/test-results` 与 `client/playwright-report`，且步骤位于 E2E 后、SSH 前。
- 已知的假绿灯：只配置 trace 但未上传，或上传步骤使用默认成功条件导致失败时反而不运行。

判据 5：机器 · 注册政策与伤病删除 readback 的纯决策必须由直接单测覆盖，并由真实组件调用。

- 度量：`pnpm test:unit -- client/src/features/auth/registration-consent-state.test.ts client/src/features/profile/injury-withdrawal-state.test.ts`；测试覆盖注册开放/关闭、境内/境外、政策读取失败，以及伤病已清空/仍存在两类 readback。
- 已知的假绿灯：新增未被组件 import 的纯函数和全绿测试，生产组件继续走旧内联分支。

判据 6：机器 · 离线 eval 和完整仓库门禁均成功退出。

- 度量：依次运行 `pnpm eval`、`pnpm verify`，分别取进程退出码；eval 输出中每个 check 必须有非零 `total` 且 `Overall: PASS`。
- 已知的假绿灯：只打印报告但失败时退出 0，或空数据集得到 100%。

判据 7：尚不可验证 · GitHub 托管 runner 上的首次 workflow 会在失败时阻断 SSH、在成功时部署同一 `github.sha`。

- 缺少条件：用户明确禁止 push 和部署，本地无法冒充 GitHub runner 与 production environment。
- 验证路径：获批 push 后读取该 SHA 的 Actions step 结果；失败演示必须使用无生产凭据的测试分支/workflow，生产 main 不做故意破坏。
- 已知的假绿灯：本地命令成功后声称 GitHub Actions 已生效。

## 冲突与限定词检查

冲突检查：已通读，无冲突。本批允许创建本地 contract/candidate commit，但禁止 push 和部署；不引入审批门，不运行真实 provider eval，不把其他 E2E 加入 release 集合。

限定词检查：

- “发布关键浏览器集合”唯一来源是“冻结事实”中的 `--list` 命令及其取数算法。
- “服务端发布的政策版本”来自 E2E mock 的 registration-policy HTTP 响应，不来自客户端常量臆测。
- “真实组件”指 `AuthScreen.tsx` 和 `AthleteProfileSheet.tsx` 的生产 import/call path。
- “SSH”指 `.github/workflows/deploy-tencent.yml` 中向 `${DEPLOY_USER}@${DEPLOY_HOST}` 发送 `deploy ${RELEASE_SHA}` 的 step。
- “同一 github.sha”来自 workflow 的 `RELEASE_SHA: ${{ github.sha }}`，本批不改为 artifact 部署。
