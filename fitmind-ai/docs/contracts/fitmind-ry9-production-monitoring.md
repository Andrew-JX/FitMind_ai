# fitmind-ry9 — 生产 Paging 与质量 Digest 契约

contract SHA：本文件首次提交所在的 commit；提交后记录到 Beads，后续 candidate 不得修改。

baseline SHA：`97c9b27bdd967e1f2b44885a28e291fd403e8e58`

candidate SHA：开工前为空。

允许改动文件：

- `fitmind-ai/server/src/app.ts`
- `fitmind-ai/server/src/app.test.ts`
- `fitmind-ai/deploy/compose.yaml`
- `fitmind-ai/deploy/scripts/fitmind-monitor.sh`
- `fitmind-ai/deploy/scripts/test-fitmind-monitor.sh`
- `fitmind-ai/deploy/scripts/summarize-monitor-logs.mjs`
- `fitmind-ai/deploy/scripts/summarize-monitor-logs.test.mjs`
- `fitmind-ai/deploy/systemd/fitmind-monitor@.service`
- `fitmind-ai/deploy/systemd/fitmind-monitor-page.timer`
- `fitmind-ai/deploy/systemd/fitmind-monitor-digest.timer`
- `fitmind-ai/.github/workflows/tencent-deploy.yml`
- `fitmind-ai/package.json`
- `fitmind-ai/deploy/README.md`
- `fitmind-ai/docs/production-smoke-checklist.md`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/contracts/fitmind-ry9-production-monitoring.md`

## 冻结事实与策略

1. 现有 API 只为未处理异常输出 `unhandled_request_error`，没有所有请求的完成事件，所以缺少 5xx 比例的分母。本批新增去标识化的 `http_request_completed` 事件，而不是用异常条数冒充比例。
2. 生产宿主已确认 Docker、Bash 与 curl；未确认宿主 Node。本批的日志汇总器由当前 API 镜像中的 Node 运行，宿主脚本不得把另装 Node 当成前提。
3. Paging 只处理应立即介入的可用性故障：API/Web 容器不运行或不健康、容器重启计数增加、loopback `/api/health` 连续三次失败、5xx 突增。
4. 5xx 突增默认定义为同一 5 分钟窗口内：排除 `/api/health` 后请求数至少 10、5xx 至少 3，且 5xx 比例至少 20%。三个阈值均可由服务器私有环境文件覆盖。
5. Digest 每日汇总 provider-error fallback、budget fallback、两者合并 fallback、faithfulness flagged、调用数、可估算成本与未知价格模型。达到调用或成本上限的 80% 只标记为 `approaching_limit`，不得升级成 Paging。
6. Paging 对未变化的同一故障去重；故障集合从非空变为空时输出一次恢复。第一次观察重启计数只建立基线，不追发历史重启告警。
7. 通知端只接收固定 schema 的 JSON，不包含请求 query、body、headers、错误 message、stack、用户输入或密钥。dry-run 只向 stdout 输出；真实 webhook 非 2xx 必须以非零退出。
8. API/Web Docker 日志开启有界轮转。systemd user timer 只作为可安装候选进入仓库；本批不复制 unit、不 enable timer、不发送真实 webhook、不部署、不执行真实回滚演练。

## 判据

判据 1：机器 · 每个完成的 HTTP 请求产生一个 `http_request_completed`，仅含 event、method、归一化 path、status、duration_ms；日志函数抛错不改变原响应。

- 度量：`app.test.ts` 覆盖 2xx、4xx、5xx、UUID/日期/query 归一化和 logger 抛错。
- 负向断言：事件或序列化结果出现 query、body、Authorization/Cookie、异常 message/stack、UUID、健康日期均失败。

判据 2：机器 · 日志汇总器忽略 Compose 前缀、空行、非 JSON、错误 schema 与 `/api/health`，精确计算请求总数、5xx 数和比例。

- 正向阈值：10 个非健康请求中 3 个 5xx 必须生成 `http_5xx_spike`。
- 负向阈值：9 个请求、2 个 5xx 或低于 20% 任一条件成立均不得 Paging。

判据 3：机器 · 容器状态、重启增量、连续健康失败和 5xx 只进入 Paging；未变化故障不重复通知，清除后通知一次 recovery。

- 负向断言：仅出现 provider/budget fallback、faithfulness flagged、成本或调用量逼近上限时，Paging payload 必须为空。

判据 4：机器 · 24 小时 Digest 同时给出 assistant turn 总数、两类及合并 fallback 数/率、faithfulness flagged 数/率、估算成本总额、未知价格次数和预算压力；无事件时输出零值而不是失败或 `NaN`。

判据 5：机器 · webhook dry-run 不访问网络；真实 webhook 仅发送固定 JSON schema，非 2xx/curl 失败非零退出。脚本不得 `source` 不可信状态文件，状态写入须原子替换并由 lock 防并发。

判据 6：机器 · Compose 为 API/Web 配置 `json-file`、`max-size` 与 `max-file`；两个 timer 分别按分钟和每日触发 page/digest；GitHub 发布门禁在 SSH 前运行 monitor 脚本隔离测试。

判据 7：机器 · `node --test deploy/scripts/summarize-monitor-logs.test.mjs`、`bash deploy/scripts/test-fitmind-monitor.sh`、`pnpm verify`、client/server production build 全部成功。

判据 8：尚不可验证 · systemd timer 已在腾讯云安装运行、真实 webhook 可达、真实生产日志能产生正确告警/日报、真实镜像回滚演练成功。

- 缺少条件：用户禁止部署；本地无权代替生产 host、通知接收端与真实上一版本镜像。
- 后续验证：另行授权后安装 user units，制造受控 health/5xx/fallback 样本验证两档输出；再执行“部署 → 回滚上一 tag → 健康检查 → 滚回候选”的真实演练并记录证据。

## 冲突与限定词检查

冲突检查：已通过。新增请求完成日志补齐 5xx 分母；它不记录个人数据。监控只读 Docker 状态和日志，除自己的状态目录外不修改应用或数据库。本批不越过用户的“不 push、不部署”边界。

限定词：

- “5xx 比例”仅以 `http_request_completed` 的非健康请求为分母，不以异常日志条数或健康探针为分母。
- “连续三次”指 timer 的三个连续 page invocation，不是一次 invocation 内 curl 三次。
- “每日”由 digest timer 定义；手工执行 digest 允许重复输出，不参与 Paging 去重。
- “成本”是现有 telemetry 的 list-price 估算；未知模型必须单列，不能静默按零成本解释。
