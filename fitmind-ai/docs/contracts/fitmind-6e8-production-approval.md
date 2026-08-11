# fitmind-6e8 — 已验证 SHA 的生产审批契约

contract SHA：本文件首次提交所在的 commit；提交后记录到 Beads，后续 candidate 不得修改。

baseline SHA：`8c3bdec`

candidate SHA：开工前为空。

允许改动文件：

- `.github/workflows/deploy-tencent.yml`
- `fitmind-ai/server/src/deploy-workflow.test.ts`
- `fitmind-ai/deploy/README.md`
- `fitmind-ai/docs/production-smoke-checklist.md`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/contracts/fitmind-6e8-production-approval.md`

## 冻结事实与策略

1. GitHub 官方当前语义：引用 environment 的 job 必须先通过该 environment 的 protection rules；配置 required reviewers 后，job 在获批前不会启动，environment secrets 也不会提前可用。来源：`https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments`，核实日期 2026-08-11。
2. GitHub 官方当前语义：下游 job 使用 `needs.<job_id>.outputs.<output_name>` 消费上游输出；`needs` 同时建立成功依赖。来源：`https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/pass-job-outputs`，核实日期 2026-08-11。
3. 审批必须发生在 verify/eval/build/release E2E/monitor shell 全部成功后，不能把 `environment: production` 放在包含验证步骤的同一个 job 上，否则人工先审批、验证后失败。
4. `verify` job 输出本次运行的精确 40 位 `GITHUB_SHA`；`deploy` job 必须 `needs: verify`，并只把 `needs.verify.outputs.release_sha` 传给服务器既有 forced command。
5. 本批只保证“部署同一个已验证 SHA”，不声称部署同一个 artifact，不引入 GHCR/TCR、镜像 push/pull 或 Compose image source 改造。
6. workflow 中写 `environment: production` 只建立引用；required reviewer、prevent self-review、deployment branch、admin bypass 是 GitHub 仓库远端设置，本地代码无法证明已启用。
7. 本批不 push、不修改 GitHub environment、不触发 workflow、不审批、不 SSH、不部署。

## 判据

判据 1：机器 · workflow 存在独立 `verify` 与 `deploy` job；所有现有 release gates 只在 verify，deploy 声明 `needs: verify` 与 `environment.name: production`。

- 负向断言：把 environment 放到 verify、删除 needs、把 SSH/deploy 移入 verify 或把任一 gate 移到 deploy 均失败。

判据 2：机器 · verify 通过具名 step 输出精确 `GITHUB_SHA`，job output 映射该 step；deploy 的 `RELEASE_SHA` 只来自 `needs.verify.outputs.release_sha`。

- 负向断言：deploy 直接使用 `github.sha`、`GITHUB_SHA`、branch 名、moving ref 或手写 SHA 均失败。

判据 3：机器 · deploy job 仅在 `github.ref == 'refs/heads/main'` 时运行；deployment key/known hosts/host/user 只在 deploy job 或其 steps，verify job 不可读取。

判据 4：机器 · workflow 和说明不得出现 registry push/pull、上传部署 artifact 后消费、或“部署同一个 artifact”的声称。

判据 5：文档 · runbook 与 production smoke 明确要求远端 `production` environment：required reviewer、prevent self-review、只允许 main、禁用管理员 bypass（若当前仓库计划/可见性支持），并保存设置截图和一次 Waiting → approved 的运行证据。

判据 6：机器 · `pnpm verify`、client/server production build 通过。

判据 7：尚不可验证 · GitHub `production` environment 已真实受保护、审批者无法自审/旁路、一次通过门禁的 SHA 等待并获批后成功部署。

- 缺少条件：用户禁止 push/部署，本地也没有 GitHub environment 管理授权。
- 后续验证：另行授权后在 GitHub Settings → Environments 配置并截图，push reviewed SHA，核对 verify 全绿后 deploy 为 Waiting；由独立 reviewer 批准，再核对服务器收到的 SHA 与 verify output 完全相同。

## 冲突与限定词检查

冲突检查：已通过。审批只延迟 deploy job，不延迟或跳过验证；服务器 forced command 与 main ancestry 校验继续保留。本批不把 SHA 验证偷换成 artifact 化。

限定词：

- “已验证 SHA”指同一次 workflow run 中 verify job 输出、deploy job 通过 `needs` 消费的 40 位提交 SHA。
- “审批已生效”只有 GitHub 远端 environment 规则和 Waiting/approved 运行证据同时存在时才能声明。
- GitHub required reviewers 的可用性受仓库可见性与计划约束；若远端不支持，必须记录真实限制并改用独立、可审计的保护机制，不能把无保护 environment 当成审批门。
