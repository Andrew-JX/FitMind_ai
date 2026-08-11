# fitmind-xd4 — scripts 门禁测试位置补充

addendum SHA：本文档首次提交所在的 commit；candidate 不得修改。

触发证据：原合同同时要求新增 `server/src/server-scripts-typecheck.test.ts`，并要求 production build 的 `dist` 路径集合与 baseline 219 项逐项相同。当前未改的 `server/tsconfig.json` 使用 `include: ["src/**/*.ts"]`，所以该测试必然被 production build 发出为第 220 项；两个判据结构上冲突，不能靠忽略新增产物或修改 production tsconfig 假装通过。

本 addendum 作以下唯一修订：

1. 原允许路径 `fitmind-ai/server/src/server-scripts-typecheck.test.ts` 替换为 `fitmind-ai/server/scripts-typecheck.test.ts`。
2. 新增允许文件 `fitmind-ai/vitest.config.ts`，仅可把上述根级测试文件加入现有 Vitest include；不得改变 environment 或排除已有测试。
3. 原判据 1 中的 `server-scripts-typecheck.test.ts` 指新的 server 根级路径。测试内容、动态脚本枚举、TypeScript program closure、严格选项、门禁接线和已知假绿保持不变。
4. 原判据 4 保持不变：candidate build 后仍须精确得到 baseline 的 219 个 `dist` 路径、冻结路径 SHA-256 和零个 `dist/scripts`。实施过程中由错误测试位置产生的 ignored `dist/server-scripts-typecheck.test.js` 必须在最终验证前删除，并证明 production build 不会重建它。

其余允许文件、排除文件、判据、未验证项和授权边界均沿用原合同 `61f93aa`，不得借本补充扩大范围。
