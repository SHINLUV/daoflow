# AH-P0 运行时门禁独立验收 R3

日期：2026-09-11。验收者：独立验收智能体（未参与本轮开发）。范围：只读核验当前候选，不修改业务源码、迁移或脚本；不调用真实外部服务、不使用真实账户、不提交 Git。

## 绑定版本与现场

- 分支：`codex/auth-hall-rag-runtime-gates`
- 验收绑定 HEAD：`6e21b179bc6bf0a0560618df2df9fd6e1a365166`
- 本轮候选提交：`2eedf62 fix(hall)`、`64e208a fix(ai)`、`6e21b17 fix(runtime)`。
- 工作树除控制过程目录 `.superpowers/` 外未见业务源码未提交改动。该目录不纳入本验收结论。
- 已完整阅读 `16-AUTH-HALL-RAG-SOLUTION.md`、`17-DAO-ANSWER-SYSTEM-PROMPT.md`、`18-TERRA-AUTH-HALL-RAG-PROMPT.md`。

## 已独立通过的有限证据

| 门禁 | 独立命令或检查 | 结果 |
| --- | --- | --- |
| 本地迁移账本 | `npx supabase migration list --local` | PASS：001–015 与前向迁移 `20260911053348_hall_execute_and_published_cursor` 均在本地账本中对齐。未声称生产已迁移。 |
| Hall helper 最小授权 | 本地 PostgreSQL `has_function_privilege` 查询 | PASS：`require_hall_user`、`require_hall_reviewer`、撤回触发器 helper 及所列 DTO/脱敏 helpers 对 `anon`、`authenticated`、`PUBLIC` 均无 EXECUTE；`hall_list_publications` 保持受控的 anon/authenticated EXECUTE，且为 `SECURITY DEFINER`。 |
| Hall 游标无跳过 | 事务内插入 3 条合成 published 记录，`SET LOCAL ROLE anon` 后调用分页 RPC，再 `ROLLBACK` | PASS：限制为 2 时第一页返回 public_id `...003`,`...002`，第二页返回 `...001`，末页游标为空；没有持久化任何合成账户或发布记录。 |
| Hall 服务边界测试 | `npm test -- tests/hall/service-boundaries.test.ts` | PASS：1 文件、5 测试通过。该测试仅覆盖本地服务错误映射，不证明真实 JWT/RLS 业务闭环。 |
| 已启动 standalone 可达性 | `Invoke-WebRequest http://127.0.0.1:3200/ask` | PASS：HTTP 200。当前验收所用 HTML 解析没有匹配到可独立计数的 `/_next/static/*.js` `src` 属性，因此静态资源逐个 200 不能由本验收单独签为通过。 |

本次所有数据库检查均为本地容器；未输出或记录密钥、Cookie、令牌、邮箱或私人正文。

## 不能签为通过的门禁

| 规格切片 | 结论 | 缺失的真实证据 |
| --- | --- | --- |
| P1 问道输入框全体验收 | NOT_EXECUTED | 没有本验收者执行的 320/390/768/1440/1920、200% 缩放、软键盘、IME、Tab 与 reduce-motion 浏览器闭环。HTTP 200 不是 UI 体验通过。 |
| P2 私人账户与会话 | BLOCKED | 未完成真实测试邮箱、BFF HttpOnly Cookie、OTP/密码/找回/MFA、退出/草稿清理、CSRF/开放重定向/枚举/重放与双账户 JWT/RLS 证据。 |
| P3 可信经典 RAG | BLOCKED | 现场 published corpus/chunk 数为 0；没有获批语料来源/许可、检索 Top5 评测、引文逐字验证和 30 题质量基线证据。 |
| P4 Agnes 与持久 worker | BLOCKED | 未做真实 Agnes 请求和 401/403、429、超时、保存失败的运行时链路；未验证真实 worker 重启、断线、lease/claim_token/generation 恢复。单元测试不能替代。 |
| P5 同道大厅业务闭环 | BLOCKED | 未以两个真实 JWT 账户验证所有权、邮箱验证、pending 审核、撤回 404、举报、源删除撤回、公开 DTO 与审核 CAS。合成匿名分页仅证明局部数据库函数。 |
| P6 攻击与质量评估 | NOT_EXECUTED | 没有 30 条常规、20 条注入、10 条高风险/模糊题、质量评分、检索命中率或完整 E2E 已记录退出码。不得以 build、mock 或跳过用例代替。 |
| 业务 UAT / 生产 | NOT_EXECUTED | 本验收未触发生产部署、外部模型或真实用户操作，用户 UAT 仍待执行。 |

## 独立结论

**总体：BLOCKED，不能作为 AH-P0 完整功能通过或发布批准。**

本候选对 Hall helper 授权和公开分页的本地数据库修复有可复现的正向证据，且 `/ask` standalone 路由可达；它们不足以满足 16/17/18 所要求的真实认证、双账户 RLS、可信语料、Agnes、持久 worker、浏览器交互、质量/攻击集与 UAT。后续复验应绑定新的提交，并先补齐以上真实运行时证据；不得用管理员请求、service role、静态降级、构建通过或 mocked 上游响应取代这些门禁。
