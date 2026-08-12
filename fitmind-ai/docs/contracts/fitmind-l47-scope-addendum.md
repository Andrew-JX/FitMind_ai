# fitmind-l47 — no-call telemetry 所有权补充

addendum SHA：本文档首次提交所在的 commit；candidate 不得修改。

触发证据：实现迁移后的相关消费测试为 68/81，通过的 turn-routing characterization 仍为 43/43；其余 13 条失败均来自 orchestrator 中三个合同盘点遗漏的直接引用：provider/raw routing telemetry 两处仍需要 `NO_LLM_CALL`，resumed clarification 分支一处仍调用 `withoutRouterCall`。server type-check 同时报出这三个未定义符号。该常量描述“本调用点没有 LLM 调用”，并非只描述 intent router，因此不能为追求文件归属把 provider telemetry 生命周期一起搬入 routing。

本 addendum 作以下唯一修订：

1. 原合同中“无 router call、常量留作模块私有实现”收窄为：`assistant-turn-routing.ts` 使用私有 `NO_ROUTER_CALL` 与 `withoutRouterCall` 构造 routing 结果；orchestrator 保留原有私有 `NO_LLM_CALL` 供 provider telemetry 使用。二者必须分别私有，不能扩大新模块精确四函数 runtime API。
2. resumed clarification 分支不再调用 routing 私有 helper；它在 orchestrator 原位机械构造 `{ intent: resumedIntent, routerCall: NO_LLM_CALL }`。这只替换不可跨模块访问的私有 helper，不授权改变 intent、telemetry 字段或 router/provider 调用次数。
3. 原合同允许文件不变；本 addendum 文件自身加入允许清单。
4. 43 条冻结 characterization 不修改；13 条失败的既有 orchestrator 测试必须恢复为绿，server type-check 必须 exit 0，才能继续 candidate。

其余 API 数量、依赖方向、目标函数所有权、禁止依赖、验证与授权边界均沿用原合同 `a09084e`。
