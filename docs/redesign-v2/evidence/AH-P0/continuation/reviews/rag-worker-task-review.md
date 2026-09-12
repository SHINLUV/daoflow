# AH-P0 续跑：RAG / Agnes / Worker 独立任务审查

日期：2026-09-13（Asia/Shanghai）
审查者：独立任务审查 Agent（未参与本轮开发；未修改源码、Git、语料、数据库或外部服务）
审查范围：`src/lib/rag/**`、`src/lib/ai/generateAnswerV2.ts`、`src/workers/askWorker.ts`、各自测试，以及 `corpus-rag-preparation.md`。
候选基线：工作树基于 `301139dc672b649a1097dfb698d991eb688813a8`；本审查的结论仅覆盖其上未提交的 RAG/Agnes/worker 改动。

## 结论

**代码审查：PASS WITH MINOR NOTES。** 未发现会让未批准语料进入 Agnes、把 Agnes 失败伪装成成功、或让已知 stale heartbeat 后继续完成/保存的 Critical 或 Important 缺陷。

这不是 RAG、真实 Agnes 或持久 worker 的运行验收通过。候选 corpus 仍为 `PENDING_INDEPENDENT_CONTENT_REVIEW` / `NOT_ELIGIBLE`；不得批准、导入、调用 Agnes，或将离线测试写成真实运行证据。

## 对照契约的审查结果

| 项目 | 证据 | 结论 |
| --- | --- | --- |
| 语料资格 fail-closed | `retrieveApprovedLexically` 在 policy 非 `eligible` 时不读取 chunks；运行时仓储又只读取 version/chunk 都是 `approved` 的行。候选 manifest 回归测试锁定为未批准，且 `corpus-rag-preparation.md` 明确没有 chunks、没有批准或真实 Agnes 调用。 | PASS（离线代码门）；真实内容/许可审批仍 BLOCKED。 |
| 证据元数据 | 检索层额外核查 chunk/version/status、章节/段落、正文、edition、来源 revision、HTTPS source、license、主题词；非法 URL、`unknown` license 与伪造数组测试均返回证据不足。 | PASS（本轮所加边界）。 |
| Agnes HTTP 分类 | `httpStatus` 仅接受 100–599 整数，优先 `statusCode` 后退 `status`；401/403 无重试，429 记录 status、Retry-After 路径和有限重试。测试覆盖 status-only、statusCode-only 与无效 statusCode 后退。 | PASS（离线分类）。 |
| heartbeat / stale 写栅栏 | 单一 in-flight heartbeat 阻止 interval 重叠；停表后等待在途 heartbeat；heartbeat 返回 false/抛错时，生成成功路径不再 complete/save，异常路径不再 markFailed。claim token 和 generation 继续传至 gateway。 | PASS（单 tick 离线逻辑）。 |
| 真实运行主张 | 19/20 要求独立 worker 编排、重启/断线/202 查询、真实 Agnes 与已审核语料证据；本次没有这些运行证据，准备记录也没有把它们标成 PASS。 | 正确保持 BLOCKED。 |

## 发现

### Critical

无。

### Important

无。

### Minor

1. `src/lib/rag/approvedLexical.ts:55` 的 `isUsableApprovedChunk` 在检查对象形状前直接读取 `chunk.reviewStatus`。当前 production adapter 的 `toChunk` 已过滤非对象，所以不构成当前运行路径的放行；但该函数的注释承诺防御“malformed adapter row”，未来 adapter 若返回 `null`、`undefined` 或原始值，会抛异常而不是稳定返回 `NO_APPROVED_EVIDENCE`。建议在第一项增加对象/record guard，并加该回归测试，使 fail-closed 保持为显式业务结果。

2. `src/workers/__tests__/askWorker.test.ts:30` 验证了 heartbeat 在 complete 前完成，`65` 验证在途 heartbeat 返回 stale 后不写入；但没有保持一个 unresolved heartbeat 跨越多个 interval tick 来断言 gateway heartbeat 仅调用一次。实现中的 `heartbeatInFlight` guard 合理，建议补一条确定性测试，避免未来重构恢复重叠心跳。

## 已执行的独立离线验证

```text
npm test -- src/lib/rag/__tests__/approvedLexical.test.ts src/lib/rag/__tests__/corpusManifest.test.ts src/lib/ai/__tests__/generateAnswerV2.test.ts src/lib/ai/__tests__/answerV2.test.ts src/lib/ai/__tests__/callModel.test.ts src/lib/ai/__tests__/evaluationFixtures.test.ts src/workers/__tests__/askWorker.test.ts
# PASS: 7 files, 31 tests

npx tsc --noEmit
# PASS

npx eslint src/lib/rag/approvedLexical.ts src/lib/rag/__tests__/approvedLexical.test.ts src/lib/rag/__tests__/corpusManifest.test.ts src/lib/ai/generateAnswerV2.ts src/lib/ai/__tests__/generateAnswerV2.test.ts src/workers/askWorker.ts src/workers/__tests__/askWorker.test.ts
# PASS

git diff --check -- <审查范围>
# PASS（仅有既有 core.autocrlf 的 LF/CRLF 提示，无 whitespace error）
```

未调用 Agnes，未读取或输出任何密钥，未以 service role、mock、构建成功或静态降级替代真实业务证明。

## 审批边界

本审查仅可作为开发任务的代码质量结论。以下门禁仍由后续独立验收处理：独立内容审阅者的逐章/许可证/署名结论及可审计 approval，approved chunks 导入与 Top5 标注集，真实 Agnes 的 401/403/429/timeout/引用验证，worker 进程编排/重启/断线恢复，以及双账户真实 JWT/RLS 与浏览器链路。
