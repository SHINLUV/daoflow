# DaoFlow Auth / 同道大厅 / RAG：P0 安全与数据契约

状态：**待独立范围复审**。本文件关闭 19 号矩阵的 P0 契约缺口；尚未授权把任何项写成已实现或已验收。它与 16–19 一起仅覆盖 AH-01 至 AH-12，优先级见 19 号文件。

## 1. 同源 BFF 与账户 API

浏览器不再构造 Supabase 客户端、不读取或保存 Supabase access/refresh token，也不直接调用 Supabase Auth。浏览器只能调用下表中的同源 `/api/auth/*`；页面私有数据继续调用现有同源业务 API，由该 API 按服务器从 HttpOnly cookie 恢复的用户 JWT 调用 RLS。每一个 SSR/route request 创建新的 Supabase server client，不能复用用户会话对象。

生产 cookie 使用 `__Host-daoflow-auth`（`Secure; HttpOnly; SameSite=Lax; Path=/`，不设置 Domain）和独立 `__Host-daoflow-csrf`（`Secure; SameSite=Strict; Path=/`，非 HttpOnly 的随机双提交值）。本地 loopback 可使用不同的 `daoflow-dev-*` 名称和 `Secure=false`，不得把开发例外带到生产。认证及私有响应必须 `Cache-Control: no-store`。access/refresh 的轮换和清除只能由服务器 `setAll` 写 cookie；`GET /api/auth/session` 永不返回 token。

| API | 允许 body / 返回 | 认证与防护 |
| --- | --- | --- |
| `GET /api/auth/session` | 无 body；`{user:{id,email,emailVerified}, aal:'aal1'|'aal2', csrfToken}` 或 `{user:null,csrfToken}` | 新 CSRF 值/同值重用受 cookie 生命周期约束；`no-store` |
| `POST /api/auth/otp/request` | `{email,redirectPath}`；一律 `202 {accepted:true}` | 严格 schema、正规化 email、邮箱/IP 持久限流、Origin 和 CSRF；`redirectPath` 只允许单 `/` 开头站内路径 |
| `POST /api/auth/otp/verify` | `{email,token,flow:'login'|'signup'|'recovery'}`；成功 `204` | 单次验证码由 Auth 负责；失败统一错误；服务器设置会话 cookie |
| `POST /api/auth/password/sign-up` | `{email,password,redirectPath}`；一律 `202` | Auth 管理密码；最少 12 字符、允许长密码/密码管理器；确认邮箱后才视为可发布 |
| `POST /api/auth/password/sign-in` | `{email,password}`；成功 `204` | 不枚举账户；渐进限流；服务器设置会话 cookie |
| `POST /api/auth/password/recovery` / `POST /api/auth/password/reset` | 前者 `{email,redirectPath}`，后者 `{password}` | 前者统一 `202`；后者需受 Auth recovery 会话和近期验证；不得用 email 字符串重置 |
| `POST /api/auth/mfa/enroll` / `challenge` / `verify` / `unenroll` | 只接受各流程必要的 factor/challenge/验证码字段 | 当前用户会话、Origin+CSRF；移除因子需 AAL2 与 15 分钟内 AMR 时间；用户没有可恢复因子时不得删除最后一个因子 |
| `POST /api/auth/sign-out` / `sign-out-all` | 无 body | 当前用户、Origin+CSRF；先撤销 Auth session，再清除所有 app 私密缓存广播标记 |

Auth callback 使用服务端 PKCE `code` 交换，仅接受状态绑定的 callback，拒绝 `//`、反斜线、协议和双重编码绕过。成功或失败都不把 token 放入 URL。公共业务 API 也不接受客户端传来的 `userId`、`owner`、role、provider、model、systemPrompt、messages、baseURL、visibility、审核状态或响应快照。

### 直连与限流

生产 Caddy 必须删除客户端传入的 forwarding headers 后再设置可信请求源头。当前 Next 运行态不能可靠获得 TCP peer，因此应用只在 Caddy 同时注入 `X-DaoFlow-Client-Ip` 与独立的 `X-DaoFlow-Proxy-Attestation`、且后者匹配 `DAOFLOW_PROXY_ATTESTATION_SECRET` 时使用该 IP；否则拒绝需要 IP 分桶的认证/匿名模型操作，绝不信任 `X-Forwarded-For` 或退回到进程内 Map。IP 与 email 只存 HMAC 分桶键和窗口计数，不记完整邮件或文本。所有计数使用受限 RPC 单事务：每邮箱 5/小时、每 IP 20/小时、登录失败渐进冷却；参数可配置但不能用进程内 Map 代替。若可信代理签名不能实测，IP 细分限制为 BLOCKED，系统仍启用账户/全站限制且不伪称 IP 已受保护。

### 浏览器直连迁移清单

以下现有路径必须迁移或删除浏览器 Auth token 依赖后才能关闭 AH-03：`src/app/page.tsx`、`src/app/ask/page.tsx`、`src/app/my-dao/page.tsx`、`src/app/auth/callback/route.ts`、`src/components/NavBar.tsx`、`src/components/v2/journal/JournalEditor.tsx`、`JournalLibrary.tsx`、`VolumeDetail.tsx`、`src/components/v2/reading/FavoriteControls.tsx` 和 `src/lib/supabase/client.ts`。所有其它 `src/app/api/**` 可继续使用 server client，但必须按 request 恢复用户身份并保持 RLS。验收以网络记录确认：登录后浏览器 Local Storage、Session Storage、可读 cookie 和 API JSON 中都没有 access/refresh token。

## 2. 管理角色、MFA 与大厅状态机

身份主键只有一个：`auth.users.id` 是 Supabase 身份真源；既有 `public.users.id` 是与其一一对应的 profile mirror，具有 `FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE`，由安全 definer 的注册/修复流程创建，绝不能脱离或生成第二个用户 ID。所有业务表（含 `app_user_roles`、`ask_sessions`、`hall_publications`）统一引用 `public.users(id)`；所有请求/RPC 先以 `auth.uid() = public.users.id` 绑定 owner，再执行 RLS/权限检查。因此现有以 `public.users` 为外键的私密数据不迁移身份、不失去级联删除语义。

`app_user_roles` 是私表：`user_id`（引用上述 `public.users`，唯一）、`role`（`hall_reviewer`）、`created_at`、`created_by`。普通 authenticated/anon 不能 SELECT/INSERT/UPDATE/DELETE，不能通过 metadata 获得角色。生产 bootstrap 不提供网页或公开 API：受控运维命令只能向已验证、指定 UUID 的账户写入角色并留最小审计事件。测试可由 service_role 创建虚构管理员；业务授权测试必须使用其真实用户 JWT。生产管理员 UUID 尚未指定，因此生产审核发布保持 pending，直至产品负责人完成受控配置和 TOTP enrollment。

`hall_publications` 状态只能 `pending | published | withdrawn | rejected`：

```text
pending --review approve(CAS + reviewer AAL2)--> published
pending --review reject(CAS + reviewer AAL2)--> rejected
pending|published|rejected --owner withdraw(CAS)--> withdrawn
published --source delete trigger--> withdrawn
```

一条发布持有 `id`、随机独立 `public_id`、`owner_id`、可空 `source_session_id`、`source_hash`、`public_question`、不可伪造的原始 `answer_snapshot`、派生的 `public_answer_snapshot`、`citations_snapshot`、`provider/model/prompt_version/corpus_version`、`status`、`version`、`redacted`、`created_at/published_at/withdrawn_at`。`hall_reports` 只由登录用户写；公共 DTO 和公共页面绝不返回 owner、email、source session/entry/volume ID、审计或举报文本。

发布请求只允许 `{sessionId,sourceHash,questionRedactions,answerRedactions,consent:true,idempotencyKey}`。服务器在同一所有者范围内读取已保存的 answer_v2，要求 `provider='agnes'`、`degraded=false`、answer_v2 已验证、每个引用仍与 approved corpus chunk 完全匹配；旧 v1、DeepSeek、local fallback 及无效引用都拒绝。重写文本不被接受：redaction 只能从源文本中删除/替换为固定 `[已隐去]`；任何非纯脱敏的问题改动返回 `REGENERATE_REQUIRED`，用户必须以新问题重新生成后才能发布。发布永远先 pending，绝不自动公开。

审核和撤回按 `id + version` CAS；旧版为 `409`。浏览器公共读取只查询 `status='published'` 的明确投影，`no-store`；撤回后源站在同一提交后立即 `404`。迁移必须断言或补建 `ask_sessions UNIQUE (user_id,id)`，并定义 `hall_publications UNIQUE(owner_id,source_session_id)` 与复合外键 `(owner_id,source_session_id) REFERENCES ask_sessions(user_id,id) ON DELETE SET NULL (source_session_id)`。`ask_sessions` 的 BEFORE DELETE trigger 必须在同一事务将关联 pending/published publication 设为 `withdrawn`、记录 `withdrawn_at` 并递增 `version`，随后由该 FK 清空 `source_session_id`；不能留下仍为 published 的失源快照。删除 `auth.users` 经 `public.users` 级联删除其 publication，公共查询立即为 404。迁移测试必须在真实保存问答、已发布问答、删除源问答和删除虚构 Auth 账户上证明没有公开孤儿。

## 3. 可信语料与 AnswerV2

现有章节 seed 和 preset interpretation 没有来源/许可/审核元数据，故在本轮开始时 **不是 approved RAG corpus**。迁移必须有 `dao_corpus_documents`、`dao_corpus_chunks`、`dao_corpus_versions`，每项带 `edition`、`chapter`、`paragraph`、`kind`、`source_url`、`source_revision`、`license`、`content_sha256`、`review_status(pending|approved|rejected)`、`corpus_version`、审计时间与审核者。用户、心笺、历史问答、大厅、管理员自由输入一律不能写入这些表。

首个候选仅限《道德经》原文，采用维基文库的《道德经（王弼本）》为可追溯版本候选；导入前必须固定其页面 revision、记录 CC BY-SA 4.0 的适用归属、将简/繁转换和标点规范规则写入 manifest，逐章人工核对与本地章节的差异。未经该 manifest、hash 与独立复核，所有 chunk 保持 pending，检索端只会返回 `insufficient_evidence`，不显示“可信引文”。现代译文/注释需各自独立的许可证和人工审核，不能从网页批量抓取。

检索先以审核主题词 + PostgreSQL `pg_trgm` 词法召回实现；`pg_trgm`/向量扩展和资源基准都要实测。pgvector + BGE-M3 只在 CPU、RAM、启动、延迟和不影响 ERP 的隔离容量证明后启用；当前环境不具备证明，向量路径明确 BLOCKED。候选经 RRF、去重和章号多样性后传入 3–5 chunks。模型返回最多三条引文；服务器拒绝未知字段、拒绝没有引文的 `answer`，并把 quote 与相同 chunk/version 原文做限定空白/标点规范后的精确子串验证。修复格式最多一次，计入模型预算。

服务端固定采用 17 号 `dao-answer-v2.1` system message；问题和检索块放在低可信 data message。`AnswerV2` 按 19 号字段保存到 `answer_v2` JSONB，另存服务器生成的 `schema_version=2`、actual provider/model、prompt/corpus version、request ID、generated time、validation state 和脱敏 attempt 摘要。历史 v1 只读兼容，不能重新标成 v2 或 Agnes。回答页面在字段存在时顺序显示“看见困惑 / 读懂原文 / 照见此刻 / 也看另一面 / 可以试试 / 反思问题”。

## 4. 持久问道 worker 与预算

登录用户的 `POST /api/ask` 经严格 body 解析、Auth/RLS 链接校验、账户限额后，只原子创建/领取 `journal_ask_requests` job 并返回 `202 + Retry-After`。一个独立 `daoflow-ask-worker` 服务（同代码版本、仅服务器环境变量）轮询受限 claim RPC；它不是易丢失的 route background promise。worker 每 15 秒心跳、租约 75 秒，claim token/generation 继续防止旧 worker 写入。运行态为 `pending | processing | generated | saved | failed`；处理重启后 expired `processing` 由新 worker 接管，旧 token 完成写入必须为零行。Agnes 401/403 直接 failed，429 尊重 Retry-After 且总生成预算内最多一次抖动重试，timeout/network/5xx 按限定次数和时间预算排程。每次 attempt 只存 request ID、provider、错误类别、HTTP 类别、耗时和时间，不存密钥、cookie、完整问题或原始模型回答。

生成成功只写 `generated`；另一个受限事务写 `ask_sessions` 并进 `saved`。登录 `POST /api/ask` 的唯一成功响应是 `202 {requestId,state,statusUrl}`；owner 轮询 `GET /api/journal/ask-requests/{requestId}`，pending/processing 为 `202 + Retry-After`，generated/saved 为带 `AskResultEnvelope` 的 `200`，failed 为不含模型正文的 `200` 错误终态。保存失败的 `POST .../{requestId}/retry-save` 只能把已验证 generated snapshot 再写数据库，绝不唤醒 worker 或调用模型。匿名问道保留为显式不保存的同步受预算路径，成功才直接返回 `AskResultEnvelope`；页面明确它不能跨刷新恢复，也不能发布大厅。新的 worker、迁移和编排进入本地 compose/生产 release；进程存活、重启、断线、202 查询和失败分类必须各有真实证据。

`ai_rate_limits` 以同一事务控制游客每日 3 次、账户每日 20 次、每账户同时 1 个生成和全局同时 2 个生成；全站预算断路状态来自持久表，页面显示可见冷却。模型结果标为 Agnes 成功的唯一条件是 actual `provider=agnes` 与 `degraded=false`；DeepSeek 只有显式用户/运维启用才可用，静态参考不可替代模型成功。

## 5. P0 退出与验证

进入实现前必须同时具备：

1. 本文件与 19 完整、和 16–18 无未决冲突，新的独立范围审查为 PASS。
2. 对现有本地数据库生成保密、可验证备份；在保留副本中按 `011`、`012` 顺序应用并核验账户/私密行未减少，才设计现场下一迁移。
3. Corpus manifest 的来源、revision、license、hash、章节差异与审核责任已记录；未审核 corpus 没有被误标为 approved。
4. worker 的本地/部署编排、健康检查、lease/heartbeat 和恢复验证方案可执行；限流 RPC 与可信代理前提已列出。
5. BFF 的 API schema、cookie、CSRF、callback、MFA/AAL、角色 bootstrap 和浏览器迁移清单已独立复核。

任何一项缺失，保持 `development_entry: UNKNOWN`；不能为“开始开发”删除约束或将外部条件改写为 PASS。
