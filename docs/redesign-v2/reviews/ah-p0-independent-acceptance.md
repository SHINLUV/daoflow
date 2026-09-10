# AH-P0 独立技术验收（最终候选）

日期：2026-09-11（Asia/Shanghai）  
验收者：`/root/ah_p0_independent_acceptance`（本任务在此前 A/B/C 开发和总控实现完成后新建；未修改产品代码、迁移、测试或运行配置）  
绑定产品候选：`615c53b563fc74699909b94eceebadf218ebbb0c`  
验收记录提交：`498150bb516ba20a78a2d984cfd077d281b2375b`

## 结论

**总 verdict：FAIL — 拒绝将 `615c53b` 作为 AH-P0 可验收/可发布候选。**

存在三项可复现的本地实现缺陷：未登录认证流程对 `anon` 无执行权限却在 BFF 中强制调用限流 RPC；MFA 最后一个因子没有可用恢复机制；问道输入框的实际最小高度低于本轮规格。另一次独立 `npm run build` 实际失败，原因是 `/auth/complete` 的 `useSearchParams()` 没有 Suspense 边界。真实账户、双 JWT/RLS、大厅审核、可信语料、Agnes、代理与 worker 运行态也都没有可接受的独立实证，保持 BLOCKED。

本报告不把通过的静态检查、测试、克隆库或管理员/服务角色路径计为这些外部功能的 PASS。

## 起点与独立性检查

- 起点 `git status --short` 无输出；`git diff --quiet` 返回干净工作树。
- `HEAD` 为 `498150b`；`498150b^` 和 `git merge-base --is-ancestor 615c53b 498150b` 均确认其直接产品父提交是 `615c53b`。
- 读取并对照了 `16-AUTH-HALL-RAG-SOLUTION.md`、`17-DAO-ANSWER-SYSTEM-PROMPT.md`、`18-TERRA-AUTH-HALL-RAG-PROMPT.md`、`19-AUTH-HALL-RAG-EXECUTION-MATRIX.md`、`20-AUTH-HALL-RAG-SECURITY-AND-DATA-CONTRACT.md` 与 `.ai-development/state.yaml`。既有 evidence 只作为待验证主张，没有直接采信。
- 本验收只新增本文件；开始和完成时均未修改产品代码、迁移、测试或配置。

## 独立运行记录

| 命令 / 检查 | 观察 |
| --- | --- |
| `npm test -- --run` | PASS：27 files、145 passed、14 skipped；跳过项不是通过证据。 |
| `npx tsc --noEmit` | PASS。 |
| `npx eslint src/app src/components src/lib tests --ext .ts,.tsx` | PASS。 |
| `npx playwright test tests/e2e/reading-ask.spec.ts --grep "anonymous ask preserves|ask input"` | PASS：3/3；确认 320/390/768/1440/1920 无横向溢出、标签和按钮可见。没有覆盖 200% 缩放、软键盘、IME、reduce-motion 或真实登录问道。 |
| `npm run build` | **FAIL**：Next.js 在预渲染 `/auth/complete` 时报告 `useSearchParams() should be wrapped in a suspense boundary`。 |
| `git diff --check 29e3b94..615c53b` | PASS。 |
| 本地只读 PostgreSQL 查询 | `supabase_db_DAOFLOW` healthy；账本最高为 `014`；`ask_sessions=43`、`hall_publications=0`、`dao_corpus_chunks=0`、语料版本为 `pending`。未修改数据。 |
| 同一只读权限查询 | `has_function_privilege('anon', consume_auth_rate_limit)=false`、`authenticated=true`、`anon(check_auth_rate_limit)=false`。 |

## 可复现失败

### IA-01：未登录认证被错误的 RPC 授权阻断

分类：**IMPLEMENTATION_BUG**；影响 AH-01、AH-02 的认证入口。

`src/app/api/auth/otp/request/route.ts`、`password/sign-up`、`password/recovery` 和 `password/sign-in` 在取得用户会话之前调用 `consumeUnauthenticatedLimit` / `checkUnauthenticatedLimit`。该 BFF 的无会话 Supabase client 使用 anon key；但 `013_auth_hall_rag_foundation.sql` 最终只授予 `authenticated` 执行 `consume_auth_rate_limit` 与 `check_auth_rate_limit`，并显式撤销 anon。独立本地数据库的 `has_function_privilege` 结果也确认 anon 为 false。

结果是这些入口会把 RPC 权限错误归为 `AUTH_LIMITS_UNAVAILABLE` 并返回 503，故不能完成 OTP、注册、找回或首次密码登录。不能以服务角色调用来替代这一真实未登录入口。

### IA-02：MFA 最后因子没有恢复机制

分类：**REQUIREMENT_GAP**；影响 AH-02。

`has_mfa_recovery_factor()` 在 `013_auth_hall_rag_foundation.sql` 中固定 `select false`；`mfa/unenroll` 因此会拒绝移除最后一个因子，但产品没有创建、验证或管理恢复因子的路径。失败闭合优于丢失 MFA 保护，但不满足 16/20 要求的可落地且已测试的 MFA 丢失/恢复机制，不能标记账户安全闭环完成。

### IA-03：问道输入框没有达到指定最小高度

分类：**REQUIREMENT_GAP**；影响 AH-09。

16 号文件要求桌面 `min-height:180px`、手机 `160px`。`src/app/globals.css` 的 `.dao-question-form textarea` 为 `144px`，移动媒体规则进一步降为 `132px`。独立 Playwright 仅证明控件可见和可达，不能覆盖这一明确的视觉规格偏差。

### IA-04：生产构建失败

分类：**IMPLEMENTATION_BUG**；影响全候选。

`npm run build` 在生产模式失败：`/auth/complete` 使用 `useSearchParams()`，但页面没有 Suspense 边界。该失败发生在独立运行中，不能由 Vitest、TypeScript 或选择性 Playwright 成功抵消。

## AH-01 至 AH-12 验收矩阵

| ID | 状态 | 独立结论 |
| --- | --- | --- |
| AH-01 | **FAIL** | IA-01 阻断无会话 OTP/注册/找回/密码登录限流 RPC；真实邮箱与代理流程也未执行。 |
| AH-02 | **FAIL** | IA-01 影响认证入口；IA-02 缺少可用 MFA 恢复机制。真实 TOTP、会话撤销与最近认证未执行。 |
| AH-03 | **BLOCKED** | 静态检索未发现浏览器 Supabase client/token 依赖，且私密 API 使用 BFF cookie；但未进行真实双账户、跨标签、刷新、RLS 或存储/网络 token 取证。 |
| AH-04 | **BLOCKED** | 公共 DTO 和默认 pending 路径有代码/夹具，但无已验证账户、已保存真实 Agnes 快照或真实浏览器发布流程。 |
| AH-05 | **BLOCKED** | 迁移含 CAS、撤回 trigger 和受保护 RPC，但没有真实双账户 IDOR、审核 AAL2、撤回 404、源删除/账户注销无孤儿的独立 JWT 证据。 |
| AH-06 | **BLOCKED** | 代码未将 DeepSeek/静态内容标为 Agnes；但当前语料未批准、无真实 Agnes 深度回答、故障分类、202/restart/save 端到端运行证据。 |
| AH-07 | **BLOCKED** | 数据库显示语料 `pending`、chunks 为 0，检索正确失败闭合；未经独立经典审核、许可留证、approved chunks、Top5 指标或向量容量证明，不能称可信 RAG 已完成。 |
| AH-08 | **BLOCKED** | lease/worker/预算实现与克隆库主张无法替代实际 worker、可信代理、Agnes 401/403/429/5xx/timeout 运行证据。 |
| AH-09 | **FAIL** | IA-03。选择性浏览器可达性 3/3 通过，但没有达到指定高度，也未验证完整视口/缩放/IME/软键盘/reduce-motion 矩阵。 |
| AH-10 | **BLOCKED** | 145 个自动测试通过不能代替旧私人功能的真实双 JWT、桌面/手机浏览器回归。 |
| AH-11 | **BLOCKED** | 30+20+10 仅为 `not_run` 离线夹具；未有质量分数、引用核验、Top5 或真实攻击测试结果。 |
| AH-12 | **FAIL** | 本独立验收已执行，但候选有 IA-01 至 IA-04，且要求的真实浏览器/双账户/Agnes/迁移恢复实证仍缺失；不能签发技术通过。 |

## 外部阻塞项（不是通过）

- 独立审核并批准的王弼本语料、许可留证、已批准 chunks 与检索质量集。
- 真实邮箱 OTP/密码/找回/MFA、受信 Caddy 代理证明、BFF cookie 与浏览器无 token 网络/存储证据。
- 两个真实 JWT 的私密数据隔离、跨标签退出、大厅作者/他人/审核者/注销级联。
- 已部署 worker 的重启、断线、lease/heartbeat 与仅重试保存；真实 Agnes 的成功和受控失败分类。
- 用户业务 UAT、生产迁移、备份恢复和发布均未执行。

## 验收后行动

先以新的前向迁移或受控部署修复 IA-01，补齐 MFA 恢复能力并修复 `/auth/complete` 的 Suspense 和 AH-09 尺寸，再在干净新候选上重新执行构建和独立验收。之后再按真实账户/JWT、语料审批、Agnes/worker/代理与浏览器证据逐项解除 BLOCKED；不得将这些未执行项改写为 PASS。
