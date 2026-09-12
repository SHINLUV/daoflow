# AH-P0 续跑：Auth / BFF / 双账户 RLS 运行门禁

日期：2026-09-13（Asia/Shanghai）
责任人：Agent A（仅 Auth/BFF 范围）
基线：`301139dc672b649a1097dfb698d991eb688813a8`
结论：**局部源代码修复并通过自动验证；真实 Auth/BFF、双账户 JWT/RLS 仍 BLOCKED。**

## 范围与现场

- 已读取 `16-AUTH-HALL-RAG-SOLUTION.md`、`19-AUTH-HALL-RAG-EXECUTION-MATRIX.md`、`20-AUTH-HALL-RAG-SECURITY-AND-DATA-CONTRACT.md` 与 R3 独立验收报告，并审查 `src/app/auth/**`、`src/app/api/auth/**`、`src/lib/auth/**`、既有 `tests/auth/**`。
- Git 基线命令 `git rev-parse HEAD` 返回上述 SHA。开始时仅存在控制过程目录 `.superpowers/`；本报告不将其他并行责任人的文件计入本范围。
- 仅检查了环境变量**名称**：`.env.local` 仅见 Agnes 相关名称，未见本地 Auth/BFF、代理证明、持久限流或回调交易所需名称；没有读取、打印或写入任何变量值、Cookie、令牌、邮箱或密钥。
- `docker ps --format '{{.Names}} {{.Status}}'` 退出非零：Docker Desktop Linux engine 的 named pipe 不存在。故没有启动/修改 Docker 或 Supabase、没有创建账户、没有使用 service role，也没有调用外部邮件或 Agnes。

## 静态边界审计

- 浏览器页面及组件中未发现对浏览器 Supabase client、access token 或 refresh token 的直接导入；登录、账户安全、问道、心笺、卷册和收藏均调用同源 `/api/auth/session`、`postAuth` 或 `csrfFetch`。
- `src/lib/supabase/server.ts` 用 `authCookieName()` 创建每请求 server client，因此业务 route 读取 HttpOnly BFF cookie，而不依赖浏览器可读 `sb-*` cookie。
- Auth route 已为 mutation 要求精确同源 Origin + 双提交 CSRF；会话与私有响应设置 `Cache-Control: no-store`；回调有交易签名和安全 next 路径限制。以上是源码/单测证据，不替代运行态浏览器证明。

## 初始修复与独立审查后的加固

### 发现

`POST /api/auth/otp/verify` 明确接受 `flow: 'recovery'` 并以 Supabase `recovery` OTP type 校验，但原先没有建立 `/api/auth/password/reset` 所需的恢复上下文。初始补丁曾采用仅表示“存在”的随机短时 cookie；独立审查正确指出它未绑定用户或 Auth session，账户切换后可能被错误继承，不能作为密码重置授权证明。

### 改动

- `src/lib/auth/bff.ts`：recovery proof 为 Web Crypto HMAC 签名的 HttpOnly cookie，绑定已验证 `userId` 与当前 BFF Auth session 的单向指纹、15 分钟过期；cookie 不含 access token，也不再引入会破坏 Next Edge bundle 的 `node:crypto`。密码重置仅接受同一用户、同一当前 Auth session 的 proof。
- `src/app/api/auth/otp/verify/route.ts`：仅在成功的 recovery OTP 同时返回 user 与 BFF session 时建立绑定 proof；失败 recovery OTP、普通 login 与 signup 均清掉旧 proof，不能继承恢复授权。
- `src/app/auth/callback/route.ts`：PKCE recovery callback 同样要求 user+session 后建立绑定 proof；非 recovery callback 清掉旧 proof。
- `src/app/api/auth/password/sign-in/route.ts`、`sign-up/route.ts`、`recovery/route.ts`：普通登录、注册和新的恢复请求均清掉旧 proof。
- `src/app/api/auth/password/reset/route.ts`：先以服务端 `getUser` 获取当前身份、读取当前 BFF Auth session，并核对绑定 proof；不匹配即拒绝并清 cookie。更新成功后调用 Auth 全局退出并在 `bff.apply` 后最终清掉所有 BFF/csrf/recovery cookies，迫使下一次重置重新完成恢复流程。若会话撤销出现临时传输失败，本地 BFF cookies 仍被清除；真实 GoTrue 撤销证据仍列为 BLOCKED。
- `src/lib/auth/http.ts`：生产 standalone 的本地例外现在同时要求 `DAOFLOW_LOCAL_RUNTIME=true`、进程绑定 `HOSTNAME=127.0.0.1|localhost|::1`、以及当前请求 Host/URL 都是 loopback，才切换到 `daoflow-dev-*`、`Secure=false`。公网 Host 即使错误继承该环境变量也保持 `__Host-daoflow-*` 和 `Secure`。`src/middleware.ts` 与 `src/lib/supabase/server.ts` 分别消费 request/headers 的同一 host-bound 规则，因此本地 BFF、middleware 与 SSR 使用同一 cookie 名称；无请求上下文默认生产安全语义。
- 新增/扩展 `tests/auth/otp-verify-recovery.test.ts`、`recovery-proof.test.ts`、`password-reset-recovery.test.ts`、`recovery-proof-clearing.test.ts`：覆盖成功/失败 recovery、login/signup、不可建立 Auth session、用户或 session 不匹配、更新后的退出/清 cookie、密码登录/注册/找回的限流早退清理，以及 loopback/public host cookie 语义。均使用合成值与 mocked Auth 边界，不使用真实 Auth 或任何秘密。

## 自动验证

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `npm test -- --run tests/auth/otp-verify-recovery.test.ts tests/auth/recovery-proof.test.ts tests/auth/password-reset-recovery.test.ts tests/auth/callback.test.ts tests/auth/bff-security.test.ts tests/auth/mfa-recovery.test.ts` | 0 | 6 files、20 tests passed |
| `npm test -- --run tests/auth` | 0 | 12 files、48 tests passed |
| `npx tsc --noEmit` | 0 | TypeScript pass |
| `npx eslint src/app/auth src/app/api/auth src/lib/auth tests/auth` | 0 | scoped lint pass |
| `git diff --check -- src/app/auth src/app/api/auth src/lib/auth tests/auth` | 0 | no whitespace error |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/local-session.ps1 -Action Build -WithoutDatabase` | 0 | `next build` compiled successfully; generated `.next/BUILD_ID` and standalone `server.js` present. Build emitted the pre-existing Supabase Edge compatibility warning, but no `node:crypto` `UnhandledSchemeError`. |

曾以 `npm run dev -- -p 3211` 做配置 fail-closed 探测；它使用默认 `.next`，与共享构建目录冲突，`curl.exe --max-time 15 http://127.0.0.1:3211/api/auth/session` 退出码为 28、未收到响应。该实例仅由本 Agent 启动，已停止 PID `3468`（其子进程 `12756`），并确认端口 3211 已释放。此探测不记为 API 或浏览器验证通过。

## 仍然阻断的真实门禁

1. Docker/Supabase 引擎不可用，且本地 Auth/BFF/可信代理/限流/回调配置缺失，无法启动真实 GoTrue + BFF 链路。上述 binding、cookie 清理与全局退出是代码和隔离单测证据，不替代真实 GoTrue recovery AMR/session 撤销验证。
2. 未以两个合成测试账户完成 OTP、密码注册/登录、密码找回、MFA enrollment/challenge/verify/backup-factor、退出/全退、刷新与 Cookie 属性的真实浏览器闭环。
3. 未以两个真实用户 JWT 证明心笺、卷册、收藏、问道、历史和 Hall 的 RLS/IDOR 隔离；没有用 service role、管理员请求、mock 或静态降级替代该验证。
4. 未验证 Caddy 注入的代理证明、IP 限流、真实邮件收发、OTP 重放/过期、CSRF/开放重定向的完整浏览器/代理记录。

后续复验必须在隔离 local distDir 或完成的 standalone 构建上进行，绑定新的候选提交；完成上述门禁前不得将 AH-01、AH-02、AH-03、AH-10、AH-12 标记为 PASS。
