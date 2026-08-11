# fitmind-y70 — 浏览器安全策略契约

contract SHA：本文件首次提交所在的 commit；提交后记录到 Beads，后续 candidate 不得修改。

baseline SHA：`cb39445a7a5ac8d3bce0601ef2222a9168948d77`

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/deploy/nginx/fitmind-security-headers.conf`
- `fitmind-ai/server/src/deploy-nginx.test.ts`
- `fitmind-ai/deploy/README.md`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/contracts/fitmind-y70-browser-security-policy.md`

## 冻结事实与策略

1. 当前 React UI 有 36 个 `.tsx` 文件使用 `style={{...}}`，`client/public/legal/privacy.html` 与 `terms.html` 含内联 `<style>`。本批不做 CSS 重构，因此 `style-src 'self' 'unsafe-inline'` 是兼容性边界，不得冒充成“可删除的宽松项”。
2. `client/index.html` 只有同源 module script，没有内联 script；生产 bundle、manifest、图标、service worker 和 API/SSE 都是同源。
3. 训练录入使用浏览器 SpeechRecognition，需要同源页面的 microphone 权限；应用不使用 camera/geolocation。
4. 安全头仍来自同一个 shared snippet，并由 HTTPS server 与 `/api/` location 各 include 一次；本批不改变 Batch 0 修复的 `add_header` 继承结构。

精确 CSP：

`default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; frame-src 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'`

精确 Permissions-Policy：

`camera=(), geolocation=(), microphone=(self)`

## 判据

判据 1：机器 · shared snippet 以 `always` 写入精确 CSP 与 Permissions-Policy；HTTPS 主站和 `/api/` 继续通过两个 include 获得同一策略，API 的 `X-Accel-Buffering: no` 不变。

- 度量：`pnpm test:unit -- server/src/deploy-nginx.test.ts`。
- 负向断言：只在 server scope 加头、在 `/api/` 因局部 `add_header` 丢失，或复制两份会漂移的策略文本，不算通过。

判据 2：机器 · CSP 不允许 script `'unsafe-inline'`、`'unsafe-eval'`、`*`、`https:` 或 `data:`；frame/object 为 none，frame-ancestors 为 none；connect 只允许 self；style 保留当前必要的 `'unsafe-inline'`。

- 度量：测试把 header 拆成 directive map 后逐项精确比较，不用子串“看起来存在”代替。
- 负向证明：内存删除 `frame-ancestors`、给 script 加 `unsafe-eval`、删除 style 的 `unsafe-inline` 均必须失败。

判据 3：机器 · 源码兼容证据仍存在：至少一个 React `style={{` 和两份 legal inline `<style>`；service worker 注册路径为同源 `/sw.js`。策略与证据一起变化。

- 已知假绿：只验证 header 语法，不验证它会不会阻断当前应用。

判据 4：机器 · Permissions-Policy 精确为 `camera=(), geolocation=(), microphone=(self)`；把 microphone 放宽为 `*` 或关闭都必须在内存策略测试中失败。

判据 5：机器 · 隔离环境中的真实 `nginx -t`、`pnpm verify`、client/server 生产构建均成功。

判据 6：尚不可验证 · 生产响应携带新头、真实页面无 CSP console violation、同源语音仍可申请权限。

- 缺少条件：用户禁止部署；本地不能冒充生产 Nginx 响应、浏览器权限或厂商 SpeechRecognition 链路。
- 后续验证：单独获授权后检查 main/API/legal/sw 响应头，浏览器跑登录/合规/语音 smoke，并审查 console。

## 冲突与限定词检查

冲突检查：已通过。严格 script 策略与当前 bundle 兼容；style 例外由现有源码证明；不 push、不部署。

限定词：

- “同源”指生产页面 origin `https://fitmind.jimmyuuu.com`。
- `'unsafe-inline'` 仅出现在 `style-src`；若未来完成 CSS/nonce 重构，应另批删除并增加浏览器证据。
- Permissions-Policy 只控制页面可请求的能力，不承诺浏览器语音识别供应商的数据处理位置；隐私披露仍以当前政策为准。
