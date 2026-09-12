# AH-P0 续跑：候选经典语料与离线 RAG/Worker 准备记录

日期：2026-09-13（Asia/Shanghai）。范围：可信经典候选、词法检索、Agnes 失败分类与持久 worker 的离线可验证部分。基线提交：`301139dc672b649a1097dfb698d991eb688813a8`。本记录未读取或输出任何密钥、令牌、Cookie、邮箱或私人正文；没有调用真实 Agnes，未写入/批准任何语料，也没有改迁移。

## 候选《道德經（王弼本）》核验

候选 manifest：`docs/redesign-v2/corpus/dao-de-jing-wang-bi-v1.manifest.json`。

| 项目 | 本轮可复核事实 | 结论 |
| --- | --- | --- |
| 固定来源 | 中文维基文库《道德經（王弼本）》；固定 revision `2354026`；raw URL 已在 manifest 固化 | 候选来源可定位，不以浮动页面作为输入 |
| 原始字节哈希 | 本地只读下载该固定 raw revision，`SHA-256=4827E5A84B37FDEAA99706B7505B3719B5EB40E2DA8E7B8A0A499944051AF611`，与 manifest 和本地 `dao_corpus_versions` 一致 | PASS（字节级固定 revision 一致） |
| 章节结构 | raw wikitext 命中 81 个章标题，首章 1、末章 81；无缺号、无重号、NUL 或 U+FFFD 替换字符 | PASS（仅结构完整性） |
| 本地 seed 基线 | `scripts/seed/chapters.json` 有 81 行、ID 1–81 各一次；原文均非空、无 NUL/U+FFFD | PASS（仅现有 seed 的结构完整性） |
| manifest 比较账本 | 81 条比较记录，章节 1–81 各一次；两侧规范化哈希均为合法 SHA-256；所有记录仍为 `pending_independent_content_review` | PASS（账本结构）；不把“存在差异”解释为语义等价 |
| 许可证 | manifest 与数据库均明确为 `CC-BY-SA-4.0_or_later_pending_license_page_capture`。CC BY-SA 4.0 的署名、许可链接、修改标示和相同方式共享条件可由 [Creative Commons 官方协议页](https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hans)复核，但本轮没有取得可审计的维基文库页面许可/署名捕获 | **PENDING**，不得据此批准或导入 |

上述“PASS”仅表示固定来源、哈希和章节结构；不代表王弼本的校勘正确、逐章语义等价、许可证归属完整或可公开使用。

## 本地数据库与可重复验证路径

本地 `supabase_db_DAOFLOW` 可用。本轮仅进行了只读 SQL 核查：

```text
dao-de-jing-wang-bi-v1 | pending | revision 2354026 | 上述 SHA-256
dao_corpus_chunks = 0
```

因此没有本地导入、没有 `approved` 行，也没有任何可供 Agnes 使用的证据片段。可重复的候选核验顺序为：

1. 以 manifest 的 `rawUrl` 下载固定 `revisionId`，计算原始 UTF-8 字节 SHA-256，并与 manifest/`dao_corpus_versions.source_sha256` 比对。
2. 提取 `== …章 ==` 标题，断言恰为 1–81 且无重号/缺号；再核对每章内容、规范化规则、差异和许可/署名。
3. 独立内容审阅者写入其身份、时间、逐章结论和许可捕获后，才由总控设计并执行前向的、可回滚的导入计划；本轮不提供绕过审批的 importer。
4. 导入后以受限运行身份验证 version、chunk hash、review status 和引用逐字子串，再执行 Top5 标注集与真实 Agnes 门禁。任何一个环节缺失，运行策略保持 `not_eligible`。

## 离线修复

- `src/lib/rag/approvedLexical.ts`：在数据库约束之外再做 fail-closed 边界检查。即便适配器声称 chunk 已批准，缺少合法 chunk ID、章节/段落、文本、edition、revision、严格解析的 HTTPS（有效主机且无 URL 凭据）来源、明确许可证或主题词时都不能进入模型 evidence；运行时伪造的必填数组、`null`、原始值行或仅有 `https://` 前缀的无主机 URL 都返回证据不足而非抛出或放行。
- `src/lib/ai/generateAnswerV2.ts`：失败分类和脱敏 attempt 统一读取合法 `statusCode`/`status`，避免仅有 `statusCode=403` 时被错分并错误重试。
- `src/workers/askWorker.ts`：停止任务时先停止计时器、等待唯一的在途 heartbeat，并在 heartbeat 报 stale 前拒绝 complete/save；同时避免重叠 heartbeat 请求。使用 fake timer 的确定性回归测试保持一个 heartbeat 未完成跨过多个 tick，断言 gateway 仍只收到一次 heartbeat。该修改只证明离线 lease 栅栏逻辑，未证明真实 worker 重启恢复。
- 新增 manifest 回归测试，确保当前未审候选仍为 `PENDING_INDEPENDENT_CONTENT_REVIEW` / `NOT_ELIGIBLE`、无审批人/时间，并有 81 条完整的待审比较记录。

## 自动验证

已通过：

```text
npm test -- src/lib/rag/__tests__/approvedLexical.test.ts src/lib/rag/__tests__/corpusManifest.test.ts src/lib/ai/__tests__/generateAnswerV2.test.ts src/lib/ai/__tests__/answerV2.test.ts src/lib/ai/__tests__/callModel.test.ts src/lib/ai/__tests__/evaluationFixtures.test.ts src/workers/__tests__/askWorker.test.ts
# 7 files, 34 tests passed
npx tsc --noEmit
# PASS
```

覆盖候选不合格即不读 chunks、伪造 approved metadata 不进 evidence、当前 manifest 仍不可检索、`statusCode` 403 不重试、429 记录、引用验证、评测夹具数量、worker heartbeat 顺序与 stale 栅栏。未以 mock、构建或静态降级宣称真实 Agnes、真实 worker、检索质量或浏览器业务链路通过。

## 可交独立审批的状态

候选现在可以交给从未参与本轮开发的独立内容审阅者进行逐章内容、版本、许可与署名核查；**尚不可批准为可信语料**。阻塞项是许可证页面/署名捕获、逐章人工结论与审批身份/时间、可审计的受审批文本 chunks、Top5 标注评测、逐字引文和真实 Agnes/worker 运行证据。当前 RAG 运行状态必须继续为 `not_eligible`，Agnes 不得被调用，也不得将 seed 或静态参考伪装成可信 AI 回答。
