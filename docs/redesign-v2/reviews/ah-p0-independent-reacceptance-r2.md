# AH-P0 独立技术复验 R2

日期：2026-09-11（Asia/Shanghai）

验收者：`/root/ah_p0_reacceptance_r2`。本验收者未参与 A/B/C 开发、总控实施或 R1 验收；R1 报告和修复记录只作为待证主张重新检查。本次只新增本报告，未修改产品代码、迁移、测试、配置或既有报告。

绑定候选：`f5e54823923dfada234af785d4132fb7df3d62b0`。它的产品修复父提交为 `f4d0a4a3697ec1ebf3603f2796e4bcebd2cec0bc`；`git merge-base --is-ancestor f4d0a4a HEAD` 返回成功。起点 `git status --short` 无输出，`git diff --quiet` 为干净工作树。

## 总结

**总 verdict：BLOCKED。**

R1 的四个本地失败项均已独立复测为修复：前向 `015` 已在本地迁移账本登记，受限认证限流 RPC 可由 anon 在严格输入约束下调用；备用 TOTP 策略允许先验证第二因子，且拒绝移除唯一已验证因子；问道输入框达到桌面 180px、移动 160px；生产构建完成。

这不构成 AH-P0 完整技术通过或发布许可。真实邮箱/OTP/密码/恢复/MFA、可信 Caddy 代理及 BFF cookie 的浏览器取证、两个真实 JWT 的 RLS 与大厅角色流程、已批准语料上的 Agnes、已部署 worker 的重启/lease 及用户 UAT 均未执行。构建、单元测试、SQL 回滚事务、服务角色或 opt-in skipped 用例均未被当作这些外部功能的 PASS。

## 读取范围与独立运行记录

已完整读取 `16-AUTH-HALL-RAG-SOLUTION.md`、`17-DAO-ANSWER-SYSTEM-PROMPT.md`、`18-TERRA-AUTH-HALL-RAG-PROMPT.md`、`19-AUTH-HALL-RAG-EXECUTION-MATRIX.md`、`20-AUTH-HALL-RAG-SECURITY-AND-DATA-CONTRACT.md`、`.ai-development/state.yaml`、R1 原始报告和 `f4d0a4a` 修复记录。

| 命令或检查                                                                                                             | 独立观察                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `git status --short`; `git rev-parse HEAD`; `git log --oneline -4`                                                     | 起点干净，HEAD 为 `f5e5482`；确认 `f4d0a4a` 是祖先。                                                                                                                                                                                                                           |
| `npx supabase migration list --local`                                                                                  | 本地/远端账本一致列出 `001`–`015`；最高项为 `015_auth_rate_limit_anon_and_mfa_backup`。                                                                                                                                                                                        |
| 只读 PostgreSQL 授权查询                                                                                               | `anon` 与 `authenticated` 均有两个认证限流 RPC 的 execute 权；语料版本为 `pending`、chunks 为 0、活动生成 lease 为 0。                                                                                                                                                         |
| 回滚 PostgreSQL anon 调用                                                                                              | 在事务内 `SET LOCAL ROLE anon`：合法 `otp_request` 和有效 20 字符 HMAC 形状键返回 `allowed:true`；非法 action 抛 `INVALID_RATE_LIMIT_INPUT`。两次均回滚，未保留测试数据。                                                                                                      |
| `npm test -- --run`                                                                                                    | PASS：28 files、148 passed、14 skipped；跳过项不计为通过。                                                                                                                                                                                                                     |
| `npx tsc --noEmit`；`npx eslint src/app src/components src/lib tests --ext .ts,.tsx`；`git diff --check f4d0a4a..HEAD` | 均 PASS。                                                                                                                                                                                                                                                                      |
| `npm run build`                                                                                                        | PASS：Next 14.2.35，47/47 静态页生成完成。                                                                                                                                                                                                                                     |
| `npx playwright test tests/e2e/reading-ask.spec.ts --grep "anonymous ask preserves                                     | ask input"`                                                                                                                                                                                                                                                                    | PASS：3/3。匿名路径在无可信代理时保留草稿并失败闭合；320/390/768/1440/1920 下输入、按钮可达、无横向溢出，实际高度满足移动 ≥160px、桌面 ≥180px。 |
| BFF / 大厅 / RAG / worker 代码与夹具抽查                                                                               | BFF session 不返回 access/refresh token，写请求验证精确 Origin 和双提交 CSRF；公共大厅 DTO 无 owner/email/source 私密 ID；v2 路径不调用 DeepSeek/静态回退，pending corpus 返回 `insufficient_evidence`；worker 使用 claim token、generation 与 15 秒 heartbeat / 75 秒 lease。 |

## IA 复验

| 项目                                   | Verdict                                          | 证据与边界                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IA-01：`015`、anon 限流授权            | **PASS_LOCAL_DB**                                | `015` 已正式登记。两项新增 anon execute grant 仅指向 `consume_auth_rate_limit` / `check_auth_rate_limit`；它们只接收允许的 action、HMAC 形状 key、有限 limit/window，非法输入被拒绝。匿名问道 reservation 仍是服务端 service-role RPC，并要求可信代理 attestation；本检查不将数据库 RPC 或服务角色调用替代真实 BFF/代理证据。 |
| IA-02：备用 TOTP、删除保护、无邮箱绕过 | **PASS_LOCAL_POLICY / BLOCKED_EXTERNAL_RUNTIME** | 安全页可新增验证器，enroll → challenge → verify 使用当前会话、Origin+CSRF；验证后可有第二个已验证因子。`canRemoveMfaFactor` 仅在另一已验证因子存在时允许移除目标，unenroll 同时要求 AAL2 与 15 分钟最近 MFA cookie。未见按邮箱字符串解锁或移除 MFA 的应用接口。真实 GoTrue TOTP、备用设备、丢失因子与会话撤销均未运行。       |
| IA-03：textarea 实际高度               | **PASS_LOCAL_E2E**                               | CSS 为桌面 `min-height:180px`、移动 `160px`；独立 Playwright 的实际 bounding box 在五档视口均满足要求。200% 缩放、IME、软键盘、reduce-motion 仍未验。                                                                                                                                                                         |
| IA-04：生产构建                        | **PASS**                                         | `npm run build` 独立完成，包含 `/auth/complete`，47/47 页生成成功。                                                                                                                                                                                                                                                           |

## 抽样安全结论与发现分类

1. **已关闭（R1 implementation bugs / gaps）**：IA-01 至 IA-04 的本地复现均已消失，见上表。它们仅关闭相应本地实现缺口。
2. **ADVISORY — 最小权限仍需单独审计**：查询显示 public schema 仍有旧的大厅只读 RPC 及若干 helper 的 inherited `PUBLIC` execute 面。R2 未发现这些 helper 能直接读取私密大厅/账户数据；公开 list/get 是匿名大厅所需能力，helper 多为确定性输入转换或触发器函数。它们不属于 `015` 新增授权，亦不能被描述为“仅限流 RPC 的完整 anon 面”。后续发布前应逐项 revoke 不需要的 helper execute 并以匿名 PostgREST/API 探测复核，不把本次静态判断当作最小权限 PASS。
3. **BLOCKED_EXTERNAL_RUNTIME**：没有真实账户、代理、网络记录、JWT/RLS、Agnes、approved corpus、worker 或 UAT 的结果；不得由本报告解除。

## AH-01 至 AH-12

| ID    | 状态        | R2 结论                                                                                                                            |
| ----- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| AH-01 | **BLOCKED** | 本地未登录限流授权修复通过；真实邮箱 OTP/密码/找回、可信代理限流及 BFF 会话未验。                                                  |
| AH-02 | **BLOCKED** | 本地备用 TOTP/唯一因子策略通过；真实 TOTP、恢复设备、最近认证、退出所有会话未验。                                                  |
| AH-03 | **BLOCKED** | 浏览器直接 token 依赖的静态检索和 BFF/CSRF 抽样合理；未做双账户、跨标签、存储/网络 token 与 RLS 实测。                             |
| AH-04 | **BLOCKED** | 公共 DTO 代码投影不含身份和私密 ID；无已验证账户、真实 Agnes saved snapshot 或浏览器发布实测。                                     |
| AH-05 | **BLOCKED** | 代码含 CAS、撤回及受保护审核路径；未用真实 JWT 验证 IDOR、AAL2 审核、撤回 404 和注销无孤儿。                                       |
| AH-06 | **BLOCKED** | v2 生成只把真实 Agnes 标为 Agnes，pending corpus fail-closed；没有 approved corpus 上的真实深度回答或受控 Agnes 故障实测。         |
| AH-07 | **BLOCKED** | 语料确为 pending / 0 chunks，检索不提升为可信证据；缺独立内容审核、许可留证、approved chunks、Top5 指标和向量容量证据。            |
| AH-08 | **BLOCKED** | lease/claim token/heartbeat 代码及夹具存在；未验证部署 worker、重启、断线、真实代理和 Agnes 失败分类。                             |
| AH-09 | **BLOCKED** | 核心高度与五档视口本地 E2E 通过；完整规格的 200%/IME/软键盘/reduce-motion 未验。                                                   |
| AH-10 | **BLOCKED** | 148 自动测试通过不替代真实双 JWT 与桌面/手机既有私人功能回归。                                                                     |
| AH-11 | **BLOCKED** | 30+20+10 质量/攻击门禁、27/30 分数和 Top5 ≥90% 均未执行，不能声称深度或检索质量通过。                                              |
| AH-12 | **BLOCKED** | R2 独立复验已完成且 R1 本地缺陷已关闭；完整独立技术验收仍缺真实浏览器、双账户、Agnes、语料、worker 与恢复证据。业务 UAT 仍未执行。 |

## 明确未验门槛

- 两个真实邮箱账户的 OTP、注册、密码、找回、备用 TOTP、会话刷新/撤销，以及 BFF 不泄露 token 的浏览器网络/存储记录。
- 已配置 Caddy attestation 下的 IP 限流与匿名问道；不能以本地 SQL、伪 header 或 service role 声称已验证。
- 两个真实 JWT 的私人数据 RLS、跨标签退出、大厅作者/他人/审核者/注销级联。
- 独立经典审核、许可留证、approved chunks、真实 Agnes 成功和 401/403/429/5xx/timeout、已部署 worker 的重启与仅重试保存。
- 迁移恢复演练、生产部署和真实业务用户 UAT。

## 完整性声明

本验收只新增本文件；开始时产品树干净，未编辑任何产品代码、迁移、测试、配置或既有报告。R2 的 `BLOCKED` 不是失败静默通过，也不授权部署：应在上述真实门槛以受控合成数据逐项留下独立证据后，再更新 AH 状态。
