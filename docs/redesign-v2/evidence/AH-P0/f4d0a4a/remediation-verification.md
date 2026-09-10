# AH-P0 独立验收 R1 的修复验证

日期：2026-09-11（Asia/Shanghai）

## 范围

- 原始独立 FAIL：`docs/redesign-v2/reviews/ah-p0-independent-acceptance.md`，候选 `615c53b`。
- 修复候选：`f4d0a4a3697ec1ebf3603f2796e4bcebd2cec0bc`。
- 本记录只验证 IA-01 至 IA-04 的本地修复；不替代新独立验收，也不解除真实运行时门槛。

## 已修复的原始发现

| 原发现                                          | 修复                                                                                                                            | 本地复核                                                                                                                                      | 状态                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| IA-01 未登录认证 RPC 无 anon 权限               | 前向 `015_auth_rate_limit_anon_and_mfa_backup.sql` 为现有参数受限、仅 HMAC 分桶的两个限流 RPC 授予 `anon, authenticated` 执行权 | `npx supabase migration list --local` 对齐 `001`–`015`；只读权限查询为 `anon_consume=true`、`anon_check=true`；`SET ROLE anon` 可调用检查函数 | PASS_LOCAL_DB_GRANT；真实 BFF/可信代理/邮件流仍未验  |
| IA-02 MFA 恢复占位符永远为 false                | 删除占位函数；安全页允许添加并验证备用 TOTP；唯一已验证因子不可移除，已验证第二因子后才允许移除其中之一；不提供邮箱绕过         | `tests/auth/mfa-recovery.test.ts`：3 个策略分支通过                                                                                           | PASS_LOCAL_POLICY；真实 TOTP/恢复设备流程仍未验      |
| IA-03 输入框高度小于规格                        | 桌面最小高度改为 180px、移动最小高度改为 160px；E2E 读取实际 bounding box                                                       | Playwright 320/390/768/1440/1920 检查通过                                                                                                     | PASS_LOCAL_E2E；200%/IME/软键盘/reduce-motion 仍未验 |
| IA-04 `/auth/complete` 缺 Suspense 导致构建失败 | `useSearchParams()` 移入 Suspense 内的客户端内容组件                                                                            | `npm run build` 完成 47/47 静态页                                                                                                             | PASS                                                 |

## 共同回归

| 命令                                                             | 结果                                          |
| ---------------------------------------------------------------- | --------------------------------------------- |
| `npm test -- --run`                                              | PASS：28 files、148 passed、14 opt-in skipped |
| `npx tsc --noEmit`                                               | PASS                                          |
| `npx eslint src/app src/components src/lib tests --ext .ts,.tsx` | PASS                                          |
| `git diff --check`                                               | PASS                                          |

## 未解除的门槛

真实 OTP/密码/找回/MFA、BFF 浏览器 token 取证、双 JWT/RLS、大厅审核/注销级联、已批准经典语料、真实 Agnes 与受控失败、已部署 worker/可信 Caddy 代理和业务 UAT 都没有在本记录中运行。它们继续为 `BLOCKED`，不能因 IA-01 至 IA-04 的本地修复而改写为通过。
