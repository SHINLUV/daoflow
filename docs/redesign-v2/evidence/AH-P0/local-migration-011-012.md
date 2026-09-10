# AH-P0：保留数据本地迁移演练与应用

日期：2026-09-11（Asia/Shanghai）
候选源：`29e3b94601a93bcbf0e159136356820be0f20e0d`
范围：仅本机 `supabase_db_DAOFLOW` 的 DaoFlow 本地数据库；未连接、迁移或重启任何生产环境。

## 前提与备份

- 应用前账本：`010`；项目迁移文件已包含未应用的 `011`、`012`。
- 在 Git 忽略的 `D:\DAOFLOW\output\local-backups\` 创建 custom-format `pg_dump`。文件大小 `503679` bytes，SHA-256：`2353777FE9A82F99F24187C54D8143236210788AD9E658B353BA499764486150`。它是本地未加密备份，不进入 Git，也不等价于异地恢复演练。
- 创建临时克隆库 `daoflow_p0_verify_20260911_050212`，从上述备份恢复并在其上测试 011/012。恢复过程在 Supabase `realtime` 函数和 `vault.secrets` 上收到权限警告；该克隆不能作为完整 Supabase 平台灾难恢复证据。目标的 Auth/public 业务表、计数和迁移前提完整，故仅用于这两条表约束迁移的保留数据演练。

## 演练结果

在克隆中对 `011_auth_user_profile_cascade.sql` 与 `012_auth_user_dependency_cascade.sql` 执行单一事务。两文件均成功，演练前后下列计数一致：

| 项目 | 演练前后 |
| --- | ---: |
| `auth.users` | 30 |
| `public.ask_sessions` | 43 |
| `public.journal_entries` | 586 |
| `public.journal_volumes` | 15 |
| `public.journal_ask_requests` | 21 |

之后已删除这个由本轮创建的临时克隆；删除目标在操作前后均以精确数据库名确认。原始库未被删除或重置。

## 实际本地应用

确认原库账本仍为 `010` 后，将 011、012 与两条账本记录置于同一 `ON_ERROR_STOP` 事务。事务提交成功；应用后的账本为 `012`。同一组五项数据计数仍为 `30 / 43 / 586 / 15 / 21`，没有输出账户、心笺或凭据内容。

## 结论与限制

`LOCAL_DB_011_012_BACKUP_APPLY_VERIFY=PASS_WITH_RESTORE_SCOPE_LIMIT`：可安全进入新增、前向的迁移设计；这不证明完整 Supabase 灾难恢复，也不证明新增大厅/RAG迁移、生产迁移或业务功能通过。后续新增迁移仍须先在新的保留数据副本上演练。
