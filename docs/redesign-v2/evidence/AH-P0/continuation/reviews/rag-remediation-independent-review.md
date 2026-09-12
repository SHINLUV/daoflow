# AH-P0 续跑：RAG / Agnes / Worker 修复独立复审

日期：2026-09-13（Asia/Shanghai）
审查者：独立复审 Agent（未参与本轮 RAG/Agnes/worker 开发；未修改产品源码、语料、数据库或外部服务）
审查范围：当前工作树中的 `src/lib/rag/approvedLexical.ts`、`src/lib/ai/generateAnswerV2.ts`、`src/workers/askWorker.ts`、`src/lib/ask-worker/runtime.ts`、对应测试、候选 manifest 及迁移 `013_auth_hall_rag_foundation.sql`。

## 结论

**范围代码复审：PASS WITH MINOR。** 未发现 Critical 或 Important 缺陷：未批准语料不会在运行策略不合格时读取或送入 Agnes；Agnes 未获有效模型响应时保持 `provider: none`；新心跳栅栏会在已知 stale 或错误的在途 heartbeat 后阻止 complete/save/失败回写，并阻止重叠心跳。

**功能门禁：BLOCKED。** 本结论不是可信语料、真实 Agnes、持久 worker 重启恢复或完整候选构建的通过证明。候选语料仍是 `PENDING_INDEPENDENT_CONTENT_REVIEW` / `NOT_ELIGIBLE`，没有 approved chunk、许可证/署名捕获、Top5 标注集、真实 Agnes 或真实 worker 运行证据。根控同时报告全局构建当前被 Auth 范围的 `node:crypto` 编译问题阻塞；该问题不改变本范围审查结论，不能以范围测试替代完整候选构建。

## 审查结果

| 契约 | 独立核查 | 结论 |
| --- | --- | --- |
| 未审批语料不得检索或调用 Agnes | `retrieveApprovedLexically` 在 policy 非 `eligible` 时于读 chunk 前返回；运行时仓储同时要求 version 与 chunk 的 `approved`。manifest 测试锁定当前候选为 pending/NOT_ELIGIBLE。 | PASS（离线 fail-closed） |
| 伪造/畸形 adapter 行不得成为 evidence | 新边界检查要求对象形状、版本、状态、章段、正文、edition、来源 revision、HTTPS 来源、明确 license、非空主题词；`null`、原始值、伪造数组、`unknown` license 和 `javascript:` URL 测试均返回 `NO_APPROVED_EVIDENCE`。 | PASS |
| 不得虚构 Agnes 成功 | `generateDaoAnswerV2` 只在检索 evidence 和 schema/citation 校验后返回 `provider: agnes`；`statusCode`/`status` 均被规范读取，401/403 不重试，失败返回 `provider: none`。 | PASS（离线分类） |
| lease/claim/generation 栅栏 | worker 停止 interval 后等待唯一在途 heartbeat；若返回 false/异常则不 complete/save 或失败回写；RPC 参数持续携带 claim token 与 generation。fake-timer 回归在未完成心跳跨多个 tick 时断言仅请求一次。 | PASS（单 tick 离线逻辑） |
| 语料审批边界 | 迁移中的 version/chunk approval 都要求 reviewer 与时间；当前运行库仍无 chunks。未发现导入器、自动提升或 seed/static fallback。 | PASS（保持 BLOCKED 的边界） |

## 发现

### Critical

无。

### Important

无。

### Minor

1. `src/lib/rag/approvedLexical.ts` 对 `sourceUrl` 只验证 `https://` 前缀，不能保证它本身是可解析的 HTTPS URL。当前数据库审批约束和运行时仓储仍是主要边界，因此这不构成未审批内容放行；建议随后用 `URL` 解析并验证 `protocol === 'https:'`，同时增加如 `https://` 的回归用例，以使“畸形 metadata 返回证据不足”的防御承诺更精确。

## 独立执行的验证

```text
npm test -- --run src/lib/rag/__tests__/approvedLexical.test.ts src/lib/rag/__tests__/corpusManifest.test.ts src/lib/ai/__tests__/generateAnswerV2.test.ts src/workers/__tests__/askWorker.test.ts
# PASS: 4 files, 19 tests

npx tsc --noEmit
# PASS (exit 0)

npx eslint src/lib/rag/approvedLexical.ts src/lib/rag/__tests__/approvedLexical.test.ts src/lib/rag/__tests__/corpusManifest.test.ts src/lib/ai/generateAnswerV2.ts src/lib/ai/__tests__/generateAnswerV2.test.ts src/workers/askWorker.ts src/workers/__tests__/askWorker.test.ts
# PASS (exit 0)

git diff --check
# PASS: no whitespace error
```

未调用 Agnes，未导入、批准或提升语料，未读取或输出密钥、令牌、Cookie、邮箱或私人正文。测试、静态类型检查或这份审查报告均不替代真实 JWT/RLS、真实 Agnes、进程重启/断线恢复、独立语料审批或用户 UAT。
