# fitmind-gct — assistant `lat` / `lateral` 词边界合同

contract SHA：本文档首次提交所在的 commit；后续 regression 与 candidate 不得修改。

baseline SHA：`93100d9`

regression SHA：开工前为空；必须以目标失败证明现状缺陷。

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/server/src/services/assistant/assistant-focus-area.ts`
- `fitmind-ai/server/src/services/assistant/assistant-focus-area.test.ts`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/contracts/fitmind-gct-assistant-lat-boundary.md`

开工前已存在且明确排除的工作树改动：

- `fitmind-ai/deploy/README.md`
- `fitmind-ai/deploy/compose.yaml`
- `fitmind-ai/deploy/scripts/deploy.sh`
- `fitmind-ai/server/src/app.test.ts`
- `fitmind-ai/server/src/routes/health.ts`

## 冻结事实与策略

1. baseline 的名称与消息 back 正则都含裸 `lat` 分支；由于没有 token 边界，`lateral raise` 会在 shoulders 分支之前命中 back，`pilates` / `latest` 等非目标词也会误命中。
2. 期望语义是：完整 token `lat` 与复数 `lats` 仍归 back；`lat pulldown` 仍归 back；`lateral raise` 归 shoulders；包含同字符子串但不是 token 的 `pilates`、`latest` 归 unknown。
3. 先只修改测试期望并增加正反例，形成 targeted test 非零退出的 regression commit；再只修改两个正则中的裸 `lat`，测试 blob 从 regression 到 candidate 必须相同。
4. 允许的最小实现是 `\blats?\b`（或行为严格等价的 token 表达式）；不得重排 chest/back/legs/shoulders 分支，不得改变其他关键词或文案。

## 判据

判据 1：机器 · regression commit 的定向测试必须因 `lateral raise`/`pilates` 与 `lateral raise`/`latest` 两组期望而失败；`lat pulldown`、`lat`、`lats` 保持 back 的断言必须已存在。

- 度量：运行 `pnpm --filter @fitmind/server test -- src/services/assistant/assistant-focus-area.test.ts`，记录非零退出和失败用例名称；不得用手工调用或复制正则代替真实模块。
- 已知假绿：只新增修复后才会通过的正例但不先运行红灯，无法证明测试能捕获原缺陷。

判据 2：机器 · candidate 对 exercise name 的结果精确为：`Dumbbell Lateral Raise`→shoulders、`Pilates Roll Up`→unknown、`Lat Pulldown`→back、`Lats`→back。

- 度量：直接调用 `inferFocusAreaFromName` 的表驱动断言。
- 已知假绿：把所有含 `lat` 的词改成 shoulders 会让前两项通过但破坏 lat/lats。

判据 3：机器 · candidate 对自由消息的结果精确为：`add lateral raise`→shoulders、`latest news`→unknown、`train lats`→back、`lat pulldown`→back；既有中文胸背腿肩与“模型训练/女朋友生气”反例继续通过。

- 度量：直接调用 `detectTargetArea`，覆盖完整 token、复数、子串反例和既有分布。
- 已知假绿：只修 exercise-name 正则，消息路由仍错误；只测健身句也会漏掉 latest。

判据 4：机器 · regression 与 candidate 的测试 blob 完全相同；生产 diff 只改变两处 back 正则的 `lat` token 表达式，运行时导出集合不变。

- 度量：比较 `git rev-parse <regression>:<test-path>` 与 candidate blob；审查 `git diff <regression>..<candidate> -- assistant-focus-area.ts`，除两处正则外不得有变化。
- 已知假绿：修实现同时放宽断言、删除反例或重写测试，可制造假绿。

判据 5：机器 · 定向 focus 测试、全部 assistant 测试、`pnpm verify` 与 server production build 均 exit 0。

- 度量：报告本次实际发现的测试文件数、断言数；全量结果若受排除文件影响必须单独归因。
- 已知假绿：只跑新测试，无法证明意图路由和回答消费链未回归。

判据 6：机器 + 人工 · candidate commit 只含允许文件；合同未变，五个排除文件未暂存、未提交；无 provider、数据库、网络调用，不 push、不部署。

- 度量：比较 `git diff --name-only <baseline>..<candidate>` 与允许列表，检查 cached diff 与 worktree status，人工确认正则顺序未变。
- 已知假绿：直接提交整个脏工作树会把并行 deploy/health 修改混入本批。

## 冲突与限定词检查

冲突检查：已通过。用户已授权本地 commits，但未授权 push 或部署；红灯 regression commit 是合同要求的证据锚点，不代表可发布候选。

限定词：

- “token”由正则 word boundary 语义产生，运行时输入来源分别是 exercise name 与用户 message 的 trim/lowercase 结果。
- “两处正则”指 `inferFocusAreaFromName` 和 `detectTargetArea` 的 back 分支，各一处。
- 本批只修 substring collision，不声称所有自然语言部位分类歧义均已解决。
