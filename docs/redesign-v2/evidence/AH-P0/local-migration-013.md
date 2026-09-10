# AH-P0 本地 013 迁移证据

日期：2026-09-11（Asia/Shanghai）
目标：本机 `supabase_db_DAOFLOW` 的 DaoFlow 数据库；未触及生产。

## 保留数据与恢复副本

- 前向迁移前生成本地 custom-format 备份：`output/local-backups/daoflow-pre-013-auth-hall-rag-20260911-054936.dump`
- 备份大小：891048 bytes
- SHA-256：`62205A7A832810DC86F5D8439CDFCB237C5562A9FD6BB3FBA04B8680C56614BC`
- 在恢复副本 `daoflow_p0_013_verify_20260911_054936` 验证了 `public/auth` 目标表的原始计数：账户 30、问道 43、心笺 586、卷册 15、请求 21。
- 恢复仍有 Supabase 平台对象的 owner/vault 权限警告；所以本项是 **PASS_WITH_RESTORE_SCOPE_LIMIT**，不是整套 Supabase 灾难恢复证明。

## 013 原子前向应用

`013_auth_hall_rag_foundation.sql` 本身以 `BEGIN/COMMIT` 包裹。恢复副本成功创建 `pg_trgm`、候选 corpus 记录、worker/hall/auth 限流 RPC 与删除源问答撤回 trigger。其无模型 worker 闭环验证为：enqueue → claim → schema-v2 generated → retry-save，终态 `saved` 且 `answer_v2/session_id` 均存在。公开大厅空列表为 `{items:[],next_cursor:null}`，未知 public ID 不是公开记录；源问答删除的后置条件为 `withdrawn + source_session_id IS NULL`。

原库在应用前后的关键计数完全相同：账户 30、问道 43、心笺 586、卷册 15、请求 21；迁移账本从 `012` 前进至 `013`，并已实际启用 `pg_trgm`。这只证明本地 schema/RPC 与保留数据兼容；不证明真实 Agnes、MFA、审核角色、双账户 RLS、语料审核、生产部署或业务 UAT。

## 014 容量与匿名限流前向应用

- 013 原库之上、014 应用前再次生成 local custom-format 备份：`output/local-backups/daoflow-pre-014-ask-capacity-20260911-061500.dump`
- 备份大小：602013 bytes；SHA-256：`310C2A7A21F52ACD00D02C90562DCCE461A46E6544E3823E7D0BB1ED966F6647`
- 先在同一保留副本成功执行 `014_ask_generation_capacity_and_anonymous_limits.sql`。事务回滚验证了匿名 HMAC 分桶的两并发上限、第三次预约拒绝，以及两个临时 lease 的释放。
- 同一保留副本的事务回滚验证了登录 worker 的 `enqueue → claim → heartbeat → complete(schema-v2) → save`；终态为 `saved`，且对应 generation lease 已释放。该验证使用 clone 中既有的合成/保留测试身份，未用 service-role 请求代替任何浏览器/RLS 验收。
- 本机原库随后前向应用 014，并在 `supabase_migrations.schema_migrations` 记录 014；应用后 `ai_generation_leases` 为空。013/014 均为新增结构与函数，不回写 001–012。

这仍只是本地数据库迁移和 worker 围栏机制的证据。它不证明 Caddy 可信代理签名、真实浏览器 Cookie/CSRF、真实 Agnes、已审批 RAG、真实双账户 RLS 或生产发布。
