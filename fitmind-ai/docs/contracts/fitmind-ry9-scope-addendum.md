# fitmind-ry9 — 文件作用域纠正附录

本附录在任何 implementation 文件改动前冻结，只纠正原契约中的路径事实，不改变 Paging/Digest 语义、阈值、判据或授权边界。

原 contract SHA：`c544f17`

发现：原契约把发布 workflow 误写为不存在的 `fitmind-ai/.github/workflows/tencent-deploy.yml`。仓库中的真实文件是根目录 `.github/workflows/deploy-tencent.yml`，且已有 `fitmind-ai/server/src/deploy-workflow.test.ts` 负责机器校验 SSH 前的 gate 顺序。

作用域修订：

- 从允许改动清单移除不存在的 `fitmind-ai/.github/workflows/tencent-deploy.yml`。
- 加入 `.github/workflows/deploy-tencent.yml`。
- 加入 `fitmind-ai/server/src/deploy-workflow.test.ts`，用于证明 monitor shell 隔离测试在 SSH key 配置与 deploy step 前执行。
- 加入本附录 `fitmind-ai/docs/contracts/fitmind-ry9-scope-addendum.md`。

其余原契约全部保持冻结。不得新建原误写路径来制造“文件存在”的假绿。
