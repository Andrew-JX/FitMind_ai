# fitmind-1lo — HTTPS API 安全头修复契约

contract SHA：使用替代锚点；以本文件绝对路径和冻结后的 SHA-256 为准。

baseline SHA：`f4d3402`

candidate SHA：开工前为空；Beads 当前上下文禁止 Git 操作，本批完成后状态最高为“实现完成，未收口”。

契约文件路径：`E:\studyspace\webroad\FitMind\fitmind-ai\docs\contracts\fitmind-1lo-security-headers.md`

允许改动文件：

- `fitmind-ai/docs/contracts/fitmind-1lo-security-headers.md`
- `fitmind-ai/deploy/nginx/fitmind-https.conf`
- `fitmind-ai/deploy/nginx/fitmind-security-headers.conf`
- `fitmind-ai/deploy/README.md`
- `fitmind-ai/server/src/deploy-nginx.test.ts`
- `fitmind-ai/docs/progress.md`

## 判据

判据 1：机器 · 源码中的 HTTPS 页面作用域和 `/api/` 作用域必须共同应用同一份安全头片段；该片段必须定义 `Strict-Transport-Security`、`X-Content-Type-Options`、`X-Frame-Options` 和 `Referrer-Policy`。

- 度量：运行 `pnpm test:unit -- server/src/deploy-nginx.test.ts`；测试解析 `deploy/nginx/fitmind-https.conf` 的 server/location 结构和 include 目标，不以全文件字符串出现次数代替作用域验证。
- 已知的假绿灯：四个 header 字符串存在于 server 作用域，但 `/api/` 因自身 `add_header` 仍不继承它们。

判据 2：机器 · `/api/` 必须继续显式返回 `X-Accel-Buffering: no`，且安全头片段不得包含该 SSE 专用响应头。

- 度量：同一测试命令解析 `/api/` location 与共享片段，分别断言 `X-Accel-Buffering no always` 存在和共享片段不含该 header。
- 已知的假绿灯：删除 `/api/` 的唯一 `add_header` 让父级继承恢复，却破坏 SSE 禁止代理缓冲的响应头。

判据 3：机器 · 完整 Nginx 配置在隔离环境中通过语法检查。

- 度量：若本机 Docker daemon 可用，使用官方 Nginx 镜像挂载测试配置和共享片段，运行 `nginx -t`，期望退出码 0；测试配置使用临时自签名证书且不连接生产服务。
- 已知的假绿灯：只解析文本，不证明 include 路径和 Nginx 指令语法有效。

判据 4：机器 · 服务器安装说明必须在加载站点配置前安装共享片段，并在 reload 前执行 `nginx -t`。

- 度量：`pnpm test:unit -- server/src/deploy-nginx.test.ts` 解析 `deploy/README.md` 的 HTTPS 安装代码块，断言 copy 共享片段、copy 站点配置、`nginx -t`、reload 的顺序。
- 已知的假绿灯：源码配置引用共享片段，但部署说明只复制主配置，导致线上 `nginx -t` 找不到 include。

判据 5：尚不可验证 · 真实生产 `/` 与 `/api/health` 响应均包含四个安全头，且 `/api/health` 额外包含 `X-Accel-Buffering: no`。

- 缺少条件：本批没有 push、生产部署或服务器操作授权。
- 生产验收路径：部署获批 candidate 后分别执行 `curl -sS -D - -o /dev/null https://<生产域名>/` 和 `curl -sS -D - -o /dev/null https://<生产域名>/api/health`，按响应头名称不区分大小写逐项比对。
- 已知的假绿灯：用本地 Nginx 或源码测试冒充生产已生效，或只测试首页。

## 冲突与限定词检查

冲突检查：已通读，无冲突。本批明确不加入 CSP/Permissions-Policy，不修改 HTTP 站点配置，不部署生产。

限定词检查：

- “HTTPS 页面作用域”来自 `fitmind-https.conf` 中 `server_name fitmind.jimmyuuu.com` 的 443 主站 server 块。
- “`/api/` 作用域”来自同一 server 块内字面量为 `/api/` 的 location。
- “共享片段”来自两处 include 指令解析出的同一个文件路径。
- “真实生产”来自获批部署后的公网 HTTPS 响应；在此之前必须标记未验证。
