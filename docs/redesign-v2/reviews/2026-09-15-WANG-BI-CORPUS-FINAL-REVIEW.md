# 王弼本可信语料最终独立审核

FINAL_DECISION: APPROVED

批准时间：2026-09-15（Asia/Shanghai）

独立审核角色：`independent_classics_reviewer`

批准仅绑定待审 release SHA-256：

`CCC17C34CF85B7FA4E1692D451EC8A59BB21C667599180E8EF3EC16EC19837A6`

## 审核结论

- 固定 revision `2354026`、原始源码哈希、81 章顺序、正文/注文分离及 81 个 chunk 哈希均复核通过；候选可确定性重建。
- 1925 扫描与 Wikimedia Commons 原文件字节一致，65 页完整；81 章覆盖记录成立。16 处跨版本异文均已逐项核对，主版本保留固定 revision 字词，没有静默改写。
- 主语料包含作品名、固定版本、来源、版本历史、讨论页、CC BY-SA 4.0 链接和改动说明，许可与署名整改通过。
- 见证扫描的公共领域权利信息成立；它只作为校勘见证，不替代主版本。
- 检索索引覆盖 81 章，每章 4–6 个主题词，并与经典正文分离；未发现控制指令或伪出处。30 条自然问题复跑 Top5 为 30/30，超过 90% 门槛。
- 旧 `scripts/seed/chapters.json` 仍不得作为可信原文、现代译文或权威解释。

## 审核证据

- [固定 Wikisource revision 2354026](https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026)
- [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- [1925 扫叶山房见证扫描及权利说明](https://commons.wikimedia.org/wiki/File:NLC511-027032013014585-17123_新式標點老子道德經.pdf)
- `docs/redesign-v2/reviews/2026-09-15-WANG-BI-CORPUS-COLLATION.md`
- `scripts/corpus/wang-bi-retrieval-index.json`

## 失效条件

正文、检索主题词、来源、许可元数据、抽取规则或待审 release 哈希发生任何变化，均使本批准失效，必须重新独立审核。
