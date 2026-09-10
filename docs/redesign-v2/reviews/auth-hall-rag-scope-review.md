# Auth / Hall / RAG 增量规格独立复核

日期：2026-09-11（Asia/Shanghai）
审查者：`spec_rereview`（未参与本轮产品开发；仅审规格）
基线：`29e3b94601a93bcbf0e159136356820be0f20e0d`

## 结论

**PASS：允许进入实现；不代表任何产品功能、真实上游、独立功能验收或业务 UAT 已完成。**

## 已核对的 P0 契约

1. 固定 revision/hash 的候选语料 manifest 包含可复现提取规则、81/81 逐章 normalized hash 与差异账本；所有条目仍为 `PENDING_INDEPENDENT_CONTENT_REVIEW` / `NOT_ELIGIBLE`。
2. 登录持久 job、匿名同步问道、owner-only 状态轮询与只重试保存的 API 形状一致且互不冒充。
3. `auth.users` 是唯一身份真源，`public.users` 是级联 profile mirror；业务外键不会创建第二身份源。
4. 大厅明确 `(owner_id, source_session_id)` 唯一、复合外键、删除源问答先撤回后置空 FK，账户删除不会留下公开孤儿。

## 仍然是实现 / 验收门槛

- 81 章逐章内容审核、许可页面留证与批准前，禁止启用 RAG。
- 真实邮件、OTP/密码/MFA、可信代理、审核员 UUID/TOTP 配置。
- 真实 Agnes 故障分类/限流、持久 worker 编排与恢复，以及 pg_trgm/向量容量证明。
- 前向迁移保留数据、双账户 JWT/RLS 浏览器验证、实现后的全新独立验收、生产发布和业务 UAT。
