# DaoFlow Auth / Hall / RAG 生产部署记录

日期：2026-09-13（Asia/Shanghai）  
部署候选：`ab067cdca07dba51699b6790332697b7101aa8c1`  
线上入口：`https://dao.shinluv.cloud`（兼容入口：`https://tanfeng.shinluv.cloud`）

## 最终状态

**生产部署 PASS；完整 Auth / Hall / Agnes / 可信 RAG 业务验收仍 BLOCKED。**

本记录只证明候选提交、正式迁移、Web 应用、可信代理边界和持久 worker 已进入真实生产运行。它不把构建、mock、空队列轮询、管理员请求或静态降级当成真实业务闭环。

## 部署与回滚

- 发布目录：`/opt/daoflow/releases/ab067cd`
- 当前软链接：`/opt/daoflow/current -> /opt/daoflow/releases/ab067cd`
- 镜像：`daoflow:ab067cdca07dba51699b6790332697b7101aa8c1`
- 环境文件在原值基础上原子补齐新增密钥；未输出或提交任何密钥。
- 环境备份：`/opt/daoflow/shared/stack.env.pre-ab067cd`
- 数据库备份：`/opt/daoflow/backups/postgres/daoflow-20260912T195911Z.dump`，部署前已验证可读取。
- 上一发布目录仍保留，可通过镜像 tag、环境备份和 release 软链接回滚。

## 正式迁移

生产迁移 ledger 共 16 条；本轮新增并成功应用：

- `013_auth_hall_rag_foundation.sql`
- `014_ask_generation_capacity_and_anonymous_limits.sql`
- `015_auth_rate_limit_anon_and_mfa_backup.sql`
- `20260911053348_hall_execute_and_published_cursor.sql`

迁移后保留数据计数：`chapters=81`、`auth_users=1`、`journal_entries=0`、`ask_sessions=0`。

## 验收结果

| 验收项 | 结果 | 生产证据 |
| --- | --- | --- |
| 版本绑定 | PASS | `/api/health` 返回 release `ab067cdca07dba51699b6790332697b7101aa8c1` |
| 公共页面 | PASS | `/`、`/ask`、`/auth/login`、`/auth/register`、`/hall`、`/journal`、`/my-dao` 均为 HTTP 200 |
| 兼容域名 | PASS | `https://tanfeng.shinluv.cloud/` 为 HTTP 200 |
| Web 容器 | PASS | 最终镜像、running、healthy |
| ask-worker | PASS（运行门） | 最终镜像、running、healthy；真实成功 tick 后心跳约 1 秒更新 |
| Caddy 可信代理 | PASS | 同源请求即使伪造 `X-Forwarded-Host/Proto`，仍到达 CSRF 门并返回 `CSRF_REJECTED`；跨源返回 `ORIGIN_REJECTED` |
| 会话接口缓存边界 | PASS | `/api/auth/session` 为 200，并返回 `cache-control: no-store, private, max-age=0` |
| 生产迁移 | PASS | 数据库 healthy；ledger=16；既有聚合计数保持 |
| 可信经典语料 | BLOCKED | `dao-de-jing-wang-bi-v1:pending`，`chunks_total=0`，`chunks_approved=0` |
| 真实 Agnes 深度回答 | BLOCKED | 未批准语料使 worker 按设计 fail closed；未消费真实 Agnes 请求来伪造通过 |
| 私人账户与双用户 RLS | BLOCKED | 生产页面和 BFF 边界已上线，但未取得真实邮件/OTP/MFA、双 JWT 隔离和跨标签退出的独立浏览器证据 |
| 匿名大厅完整闭环 | BLOCKED | 生产接口已上线，但未以真实用户完成发布、审核、匿名读取、撤回、举报及注销级联闭环 |
| 业务 UAT | NOT_EXECUTED | 必须由真实业务用户完成，技术发布不代签 |

## 测试结果

- `npm ci`：exit code 0。
- lint：exit code 0，无 warning/error。
- typecheck：`tsc --noEmit` exit code 0。
- Vitest：38 files / 199 passed / 14 skipped；skip 不计为通过。
- Playwright 本地浏览器：此前记录 11 passed / 5 skipped；5 个真实外部前置用例继续 BLOCKED。
- production build：exit code 0，生成 47 个静态页面；远端最终镜像构建 exit code 0。
- production smoke：核心页面、容器、迁移、代理防伪造与缓存边界通过。

## 已知未完成事项

1. 经典语料许可证/来源留证、独立内容审核、批准和 chunk 导入尚未完成；因此可信 RAG 必须保持不可用。
2. 只有在批准语料可检索后，才能执行真实 Agnes 可靠性、引用逐字核对、深度质量集和异常注入验收。
3. 真实邮件验证码、密码找回、MFA、双账户 RLS、匿名大厅角色闭环尚需独立生产浏览器验收。
4. 业务 UAT 尚未执行。

这些门禁阻塞“完整功能通过”和正式商业化声明，但不否定本次生产基础设施与候选版本已经成功部署。
