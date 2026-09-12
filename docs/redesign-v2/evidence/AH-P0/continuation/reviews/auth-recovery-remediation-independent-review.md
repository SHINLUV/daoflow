# AH-P0 续跑：Auth 恢复链路修复独立复核

日期：2026-09-13（Asia/Shanghai）
审查者：新独立复核 Agent（未参与本轮 Auth/BFF 开发；仅新增本审查证据）
范围：恢复 OTP / callback / 密码重置、BFF Cookie、local standalone Cookie 语义及 middleware/SSR 会话名称一致性。

## 结论

**源码修复 PASS；真实功能门禁仍 BLOCKED。**

此前随机 recovery Cookie 未绑定 Auth 身份/会话的问题已被关闭：proof 为短时签名载荷，只保存 userId、会话绑定值和到期时间；重置时同时取得当前可信用户与当前 Auth session，二者均须匹配才调用 `updateUser`。proof 不含 access token。成功重置后全局退出并清除 BFF、CSRF、transaction 与 recovery cookies；失败的 recovery OTP、普通登录/注册 OTP、密码登录失败和限流、注册/找回失败和限流均会清除旧 proof。

独立复核也确认先前两个实现级阻断已经关闭：

- recovery proof 改用 Web Crypto HMAC 和字节常数时间比较；`bff.ts` 不再导入 `node:crypto`，因此 middleware 不会再因该导入落入 Edge bundling 错误。
- Cookie 模式由 request/host 共同决定。只有 `NODE_ENV=production`、显式 local flag、loopback bind、loopback Host 与 loopback URL 同时成立才使用 `daoflow-dev-*`/非 Secure；任一 public Host 即使误带 local flag 仍为 `__Host-*`/Secure。middleware 传入 request，SSR 使用请求 Host，故二者与 BFF 在 local standalone 下都读取 `daoflow-dev-auth`，不再出现名称不一致。

local callback 现在也只在上述显式 loopback 条件下放行 `localhost:3200` / `127.0.0.1:3200`，避免 standalone 的生产 NODE_ENV 使本地恢复回调固定 503，同时不放宽公网 callback origin。

| 项目 | 独立核查 | 结论 |
| --- | --- | --- |
| 身份与会话绑定 | 恢复 proof 必须同时匹配 verified userId 和当前 session token 的 HMAC 绑定；账号切换或 session 更换不会调用更新密码。 | PASS |
| 一次性消费/清理 | 成功重置先尝试全局退出，且无论 provider sign-out 是否暂时失败都清理本地认证及 recovery Cookie；拒绝路径也清理。 | PASS（源码/单测） |
| Cookie 覆盖顺序 | BFF pending session Cookie 先 `apply`，随后 reset 的 `clearAuthCookies` 写入最终清理 Cookie；success/failure 均无 proof 覆盖窗口。 | PASS（源码） |
| local 与 production 隔离 | request/Host 与 launcher bind 三重约束；公开 Host 不会因 local flag 降级。 | PASS（源码/单测） |
| middleware / SSR 一致性 | middleware 以 request 配置 Cookie；服务端读取 Host 后选择同一 Cookie 名称和属性。 | PASS（源码） |
| Edge 兼容 | 本轮审查范围内 `bff.ts` 无 `node:crypto` 导入，proof 使用 Web Crypto；开发方已记录 standalone build 成功。 | PASS（源码；构建结果由总控单独复验） |

## 独立执行

```text
npm test -- --run tests/auth
# PASS: 12 files, 48 tests

git diff --check -- src/lib/auth src/app/api/auth src/app/auth src/middleware.ts src/lib/supabase/server.ts tests/auth scripts/local-session.ps1
# PASS

# static Edge audit of bff/middleware paths
# PASS: bff.ts has no node:crypto import; no unbound authCookieName()/isProduction() call remains in reviewed request paths
```

## 发现

- Critical：0
- Important：0
- Minor：0

本报告不宣称真实 GoTrue 邮件/OTP、双账户跨标签、刷新/注销后 token 撤销、BFF 可信代理、JWT/RLS、真实浏览器会话或 MFA 已完成。它们尚无独立运行证据，因此认证的端到端功能验收结论仍为 **BLOCKED**；不能由本次源码和单元测试替代。
