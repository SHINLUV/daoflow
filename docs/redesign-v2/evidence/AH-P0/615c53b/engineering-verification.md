# AH-P0 工程验证记录

日期：2026-09-11（Asia/Shanghai）

## 绑定范围

- 产品候选提交：`615c53b563fc74699909b94eceebadf218ebbb0c`
- 基线提交：`29e3b94601a93bcbf0e159136356820be0f20e0d`
- 环境：`D:\DAOFLOW` 本地工作区；本地 `supabase_db_DAOFLOW`；未部署生产。
- 数据原则：未重置、删除或覆盖现有私人记录。迁移前备份和克隆库恢复演练见同目录的 `../local-migration-011-012.md` 与 `../local-migration-013.md`。

## 已执行的工程检查

| 层级                 | 命令或流程                                                                                                                                                                       | 结果                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 单元 / 集成          | `npm test -- --run`                                                                                                                                                              | PASS：27 files、145 passed、14 opt-in skipped                               |
| 类型                 | `npx tsc --noEmit`                                                                                                                                                               | PASS                                                                        |
| 静态检查             | `npx eslint src/app src/components src/lib tests --ext .ts,.tsx`                                                                                                                 | PASS                                                                        |
| 候选构建             | `npm run build`                                                                                                                                                                  | PASS                                                                        |
| 问道协议回归         | `npx vitest run tests/reading/ask-persistence.integration.test.ts`                                                                                                               | PASS：7 passed、4 live opt-in skipped                                       |
| 截图输入框浏览器回归 | `npx playwright test tests/e2e/reading-ask.spec.ts --grep "anonymous ask preserves\|ask input"`                                                                                  | PASS：3 tests；390px 截图，320/390/768/1440/1920 无横向溢出且输入/按钮可达  |
| 生产编排静态展开     | `docker compose -f ops/production/stack.compose.yml --env-file ops/production/stack.env.example config --quiet`，仅注入验证占位值并将 `DAOFLOW_STACK_ENV_FILE=stack.env.example` | PASS；未启动或修改服务                                                      |
| Caddy 语法           | 容器内 `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`                                                                                                        | PASS；仅提示可格式化                                                        |
| 本地数据库健康       | `docker exec supabase_db_DAOFLOW pg_isready -U postgres -h 127.0.0.1`                                                                                                            | PASS：accepting connections                                                 |
| 本地迁移账本 / 状态  | 只读查询 `supabase_migrations.schema_migrations`、`ai_generation_leases`、`dao_corpus_versions`                                                                                  | PASS：最新 `014`；leases=0；`dao-de-jing-wang-bi-v1` 为 `pending`、chunks=0 |

## 已实现但未被外部运行时清除的边界

- 私人账户 BFF、host-only 会话、同源 CSRF、OTP/密码/恢复/MFA 界面与 API 已进入候选；没有用管理员请求、模拟会话或静态页面证明真实邮件、MFA、登出撤销或双账户隔离。
- 匿名大厅、公开 DTO、发布预览、撤回/举报/审核契约与迁移已进入候选；没有真实已验证账户、真实 Agnes 快照、审核角色/MFA 或注销级联的浏览器运行证据。
- 问道改为登录用户的持久 job/lease/worker 和匿名用户的可信代理 HMAC 预算。克隆库已演练 enqueue/claim/heartbeat/complete/save；实际 worker 服务、Caddy 代理证明和真实重启恢复尚未运行验证。
- V2 只能调用 Agnes，且语料不足时返回显式 `insufficient_evidence`，不会降级为静态章节或其他模型。当前语料的独立内容审核尚未完成，因此真实 Agnes 深度回答、引文 Top5 与供应商故障分类均未执行，不能标记为 PASS。
- 旧私密数据迁移保持加性兼容，且历史 v1 仍可读取；真实双 JWT/RLS、跨标签和移动端私密回归仍未执行。

## 结论

`implementation_complete=PASS`：授权范围内的候选代码、加性迁移、运行编排、测试及输入框修复均已提交。

`engineering_verification=BLOCKED`：上述外部核心运行时证据尚缺。构建、自动测试、克隆库 SQL、管理员/服务请求、跳过用例和静态缺配置页面均不构成这些门槛的替代品。
