# AH-P0 续跑：Agent V 独立最终验收

日期：2026-09-13（Asia/Shanghai）
审查者：Agent V（本轮未参与 Auth、RAG、worker、E2E 或运行环境开发）
初始审查对象：工作树相对 `301139dc672b649a1097dfb698d991eb688813a8` 的候选。初始审查完成后，总控提交了候选；以下“提交绑定复核”是本报告的最终、优先结论。

## 发布结论

**NO-GO / BLOCKED，不允许作为完整功能发布候选。**

本轮已关闭若干源码与本地运行入口问题，且没有发现本次差异中的 Critical、Important 或 Minor 级别实现缺陷；但这不等于功能验收。规格要求的真实账户、双 JWT/RLS、审核语料、真实 Agnes、持久 worker 与浏览器业务闭环均未得到独立运行证明。

## 提交绑定复核（最终结论）

- `HEAD`：`2c879774f3788a732e01aeffd6bb47b7ed6ca2d9`（`fix: harden auth hall rag runtime gates`）。
- `git show --stat` 和逐文件 tree 核对确认：本轮 auth/BFF、Caddy、local runtime、RAG/worker、E2E 配置与测试均包含在该提交中（47 files, 1338 insertions, 168 deletions）。
- 工作树只剩未跟踪的 `.superpowers/` 与本轮证据报告目录；没有未提交的产品源码、测试、配置、迁移或运行脚本变更。
- 本独立报告本身也属于未跟踪证据，故未被错误地计入候选产品提交。

因此，原先的“未绑定候选 SHA”阻断已关闭；最终候选明确绑定为 **`2c879774f3788a732e01aeffd6bb47b7ed6ca2d9`**。其余所有真实功能门禁不变，最终发布判断仍是 **NO-GO / BLOCKED**。

| 门禁 | 独立结论 | 证据与边界 |
| --- | --- | --- |
| 候选可追溯性 | **PASS（提交绑定）** | 最终绑定 `2c879774f3788a732e01aeffd6bb47b7ed6ca2d9`；证据和过程目录保持未跟踪，未混入产品提交。 |
| 私人账户、OTP/密码/找回/MFA/退出 | **BLOCKED** | 独立执行 `npm test -- --run tests/auth ...`：18 files / 83 tests 通过；仅为 mocked 边界。未执行真实 GoTrue 发信、OTP 重放/过期、密码、MFA、刷新、注销或两合成账号浏览器流程。 |
| BFF Cookie、CSRF、可信代理 | **PASS（局部运行边界）/ BLOCKED（完整认证功能）** | `3200` standalone、回环 `3210` Caddy 均在本机可达；两端 `GET /api/auth/session` 均为 200，local CSRF cookie 未带 `Secure`。无状态探测中，直连伪造 forwarded authority 得到 403 `ORIGIN_REJECTED`，经回环 Caddy 同一无效 body 得到 400 `INVALID_INPUT`，证明 Caddy 替换并附加可信代理元数据。未把这项探测当作登录、邮件、限流或 JWT/RLS 通过。 |
| 私人数据/RLS/跨账户隔离 | **BLOCKED** | 未使用真实用户 JWT 做心笺、卷册、收藏、问道、历史或 source 关系的双账户隔离测试；未用管理员或 service role 将其代替。 |
| 匿名大厅 | **BLOCKED** | 源码、RPC 和公开 DTO 隔离检查存在；但未以已验证用户完成“保存的真实 Agnes 回答 → 主动预览/同意 → pending → 审核 → 匿名读取 → 撤回 404”，也未完成 IDOR、审核 CAS、举报和源记录/注销撤回的真实数据库路径。 |
| Agnes 可靠性与深度回答 | **BLOCKED** | 失败分类、answer_v2、重试与 lease 单测可通过；没有本轮真实 Agnes 虚构问题、401/403/429/timeout/格式错误、保存失败、202/restart 或深度质量评测证据。不得把 `provider=none`、静态参考或其他供应商算 Agnes 成功。 |
| 可信经典 RAG | **BLOCKED（fail closed 正确）** | 独立只读数据库结果：approved versions=0、approved chunks=0、total chunks=0。候选 manifest 仍 pending，许可/署名捕获、独立内容审批、导入 chunks、Top5 标注集与逐字引文/真实模型验收缺失。词法 adapter 对伪造 metadata 的拒绝测试通过，正是未批准时应有的失败闭合。向量容器当前不健康，且无向量能力/容量证明。 |
| worker / 生成持久化 | **BLOCKED** | heartbeat 重叠与 stale 栅栏仅有 fake-timer 回归；未部署或独立验证真实 worker、lease 续租、断线/重启恢复、并发和“生成成功仅重试保存”。 |
| 问道输入框 | **PASS（自动化布局范围）/ BLOCKED（物理设备范围）** | 代码实际使用 `dao-question-form`；独立读取 Playwright JSON 为 expected=11、skipped=5、unexpected=0、flaky=0，且 `/ask` 经 standalone/Caddy 均返回 200。已有浏览器证据覆盖 320/390/768/1440/1920、中文输入、Enter 换行、Tab、reduced motion 与 CSS 200% 布局压力。物理浏览器 200% 缩放、系统 IME 组合态和真实移动软键盘仍未验，不能写成全量 PASS。 |
| 迁移与回滚 | **PARTIAL / BLOCKED** | 只读本地 ledger 包含 001–015 与 `20260911053348`。没有本轮新迁移；未进行本候选绑定的保留数据双账户验收、回滚演练或远端操作。 |
| 业务 UAT、生产部署/迁移 | **NOT EXECUTED** | 未执行，且不应由本验收替代。 |

## 本次独立执行记录

1. 只读核对 `16`、`17`、`18` 号规格、现有证据、Git 差异、迁移与源码边界；`git diff --check` 退出 0。
2. 执行定向回归：`npm test -- --run tests/auth src/lib/rag/__tests__/approvedLexical.test.ts src/lib/rag/__tests__/corpusManifest.test.ts src/lib/ai/__tests__/generateAnswerV2.test.ts src/workers/__tests__/askWorker.test.ts`，结果 18 files / 83 tests 通过。
3. 只读检查本地 Postgres：迁移 ledger 完整至 `20260911053348`；approved corpus versions/chunks 均为 0，所有 chunks 为 0。
4. 只读解析 `output/playwright/continuation-full-run-r2.json`，确认 11 个实际通过、5 个明确 skip、0 unexpected、0 flaky；跳过项未计入任何业务门禁。
5. 不修改应用、测试、数据库、容器或进程；不读取、输出或记录任何密钥、Cookie、令牌、邮箱或私人正文。

## 发现分级

- Critical：0
- Important：0
- Minor：0

“0 实现级发现”只表示本轮独立抽检没有新增代码缺陷，**不抵消上述 BLOCKED 运行门禁**。解除 NO-GO 的最低顺序是：先提交并绑定干净候选 SHA，再以两个合成账户通过真实 BFF/邮件/OTP/MFA/JWT/RLS 与大厅闭环，取得独立许可证/内容批准并导入可信 chunks，随后做真实 Agnes/worker/质量与引用测试，最后重新由未参与开发者验收；业务 UAT 与任何生产操作继续另行执行。
