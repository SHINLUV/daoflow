# AH-P0 续跑：RAG `sourceUrl` 修复独立复核

日期：2026-09-13（Asia/Shanghai）
审查者：新独立复核 Agent（未参与本轮 RAG / Agnes / worker 开发；本报告之外未修改工作树）
范围：`src/lib/rag/approvedLexical.ts` 与 `src/lib/rag/__tests__/approvedLexical.test.ts` 中针对上轮 Minor 的 `sourceUrl` 运行时 fail-closed 校验。

## 结论

**PASS。** 上轮“仅检查 `https://` 前缀”的 Minor 已关闭：`isSafeHttpsSourceUrl` 以 `new URL` 解析输入，并同时要求 `https:` 协议、非空 hostname、且没有 username/password。无法解析的 `https://` 与非 HTTPS `javascript:` URL 都在进入证据映射前被拒绝，检索结果为 `NO_APPROVED_EVIDENCE`；不会把该 adapter 行传给 Agnes。

| 项目 | 独立核查 | 结论 |
| --- | --- | --- |
| 可解析 HTTPS | 运行时要求 URL 解析成功、协议严格等于 `https:`、hostname 非空。 | PASS |
| 凭据 URL | URL 含 username 或 password 时拒绝，避免把带嵌入凭据的来源元数据带入 evidence。 | PASS |
| 回归覆盖 | 用例覆盖 `javascript:` 与无 host 的 `https://`，二者都断言 `NO_APPROVED_EVIDENCE`。 | PASS |
| 非对象 / 伪造字段防御 | 既有用例仍覆盖 `null`、原始值和伪造 `themeTerms`，验证无异常且不产生 evidence。 | PASS |

## 独立执行

```text
npm test -- --run src/lib/rag/__tests__/approvedLexical.test.ts src/lib/rag/__tests__/corpusManifest.test.ts
# PASS: 2 files, 7 tests

npx eslint src/lib/rag/approvedLexical.ts src/lib/rag/__tests__/approvedLexical.test.ts src/lib/rag/__tests__/corpusManifest.test.ts
# PASS (exit 0)

git diff --check -- src/lib/rag/approvedLexical.ts src/lib/rag/__tests__/approvedLexical.test.ts
# PASS (exit 0)
```

## 发现

- Critical：0
- Important：0
- Minor：0

本复核只关闭上述 metadata URL 校验 Minor；它不批准候选语料，也不替代许可证/署名证据、独立语料审核、approved chunks、真实 Agnes、worker 运行验证、JWT/RLS 或用户验收。当前候选 manifest 仍为 pending / not eligible，因此可信 RAG 功能门禁仍为 **BLOCKED**。
