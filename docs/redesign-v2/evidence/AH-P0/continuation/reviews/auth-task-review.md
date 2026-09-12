# AH-P0 续跑 Auth 子任务独立审查

日期：2026-09-13（Asia/Shanghai）
审查者：独立任务审查 Agent（未参与该 Auth 改动；未修改产品代码或 Git）
审查范围：`src/app/api/auth/otp/verify/route.ts`、`tests/auth/otp-verify-recovery.test.ts`、`docs/redesign-v2/evidence/AH-P0/continuation/auth-bff-runtime.md`，并只读关联 `src/lib/auth/bff.ts`、密码重置 route、16/19/20 与 R3。
现场 HEAD：`301139dc672b649a1097dfb698d991eb688813a8`；被审 Auth 文件为未提交候选改动。

## 结论

**Spec compliance：REQUEST CHANGES。**
**Code quality：REQUEST CHANGES。**

把 `markRecoverySession(response)` 放在 `verifyOtp` 无 error 之后、且只限 `flow === 'recovery'`，这一局部顺序是正确的：失败 OTP 会在标记前返回，正常 login/signup 不会在这条新分支直接写 recovery 标记。可是当前“短期凭据”不是可用于密码重置授权的可靠 recovery proof，不能据此关闭 AH-01/AH-02 的真实 Auth 门禁。

## Findings

### Critical — recovery 标记不绑定恢复会话/用户，能绕开当前密码校验

`markRecoverySession` 只写入一个随机、15 分钟 cookie，而 `hasRecoverySession` 只检查该 cookie 是否存在（`src/lib/auth/bff.ts:99-104`）。`POST /api/auth/password/reset` 只要求这个布尔值加“任意当前 authenticated user”（`src/app/api/auth/password/reset/route.ts:14-17`）；它没有验证 cookie 对应的 user id、认证 session id、Auth recovery AMR/flow，亦没有服务器端可消费状态。

因此，一个账户 A 完成 recovery OTP 后不提交 reset，随后同一浏览器以普通 login/signup/session refresh 切换到账户 B；原 recovery cookie 在 OTP login/signup 路径未清除，B 可走 reset 路径而不再输入 B 的当前密码、也没有完成 B 的 recovery flow。这与 20 的“后者需受 Auth recovery 会话和近期验证”契约不符，且会把旧/别人的恢复意图变成当前会话的改密授权。

修复应采用服务端可验证且绑定当前 Auth session/user 的一次性 recovery state（成功 reset 即消费；切换/登录/退出时清除），或在 reset 时验证 GoTrue 的真实 recovery session/AMR 与当前 user。一枚仅以存在性判断的随机 cookie 不足以作为授权证明。修复后须以真实或严格集成夹具覆盖 A-recovery → B-login → B-reset 被拒绝，以及正确 recovery → reset 一次成功、重复失败。

### Important — 新测试没有验证“only after success”，也漏测 signup

`tests/auth/otp-verify-recovery.test.ts:50` 在每例都把 `verifyOtp` mock 为成功；两例只断言 mock 的 `markRecoverySession` 是否被调用（54-69）。它没有覆盖 `verifyOtp` 返回 error 时标记绝不出现，不能验证标题所称“只在成功后”。helper 的 mock 也不会验证 `Set-Cookie` 的 HttpOnly、SameSite=Strict、15 分钟 TTL、绑定或消费语义。

测试类型仅允许 `login | recovery`（38），未测试 `flow: 'signup'` 映射为 Supabase `signup` 且绝不获得 recovery proof。应补充失败 recovery、成功 signup、无效 flow，以及实际 response cookie/消耗语义测试。

### Minor — 运行证据准确标为 BLOCKED，但“短期 recovery cookie”措辞过强

`auth-bff-runtime.md` 没有把真实 Auth/BFF、双账户 JWT/RLS 宣称为通过，这是正确的；所列 Docker/配置限制也清晰。建议将“短时 recovery cookie”明确标为“当前源码标记”，而非恢复授权已被证明，以免掩盖上述绑定缺口。

## login / signup 越权判断

静态上，`FLOWS` 只允许 login/signup/recovery，type 映射为 `email`/`signup`/`recovery`，且新标记只在 recovery success 后调用（`route.ts:6,19-25`）。请求 schema 不接收 owner、role 或密码重置对象。因此该差异没有给 login/signup **直接**写 recovery cookie。

但 Critical 场景说明它们不能清除或隔离已存在的 recovery cookie，故不能签署端到端“login/signup 不会获得恢复改密权限”。

## 独立执行证据

| 命令 | 结果 |
| --- | --- |
| `npm test -- --run tests/auth/otp-verify-recovery.test.ts tests/auth/bff-security.test.ts tests/auth/callback.test.ts tests/auth/mfa-recovery.test.ts` | PASS：4 files、14 tests |
| `npx tsc --noEmit` | PASS |
| `npx eslint src/app/api/auth/otp/verify/route.ts tests/auth/otp-verify-recovery.test.ts` | PASS |
| `git diff --check -- …` | PASS（仅现有 LF/CRLF Git 警告） |

这些是 unit/type/static 结果，不代替真实 GoTrue、BFF cookie、邮件、双账户 JWT/RLS 或浏览器闭环。审查期间未读取/输出秘密、未调用外部服务、未创建账户、未使用 service role。
