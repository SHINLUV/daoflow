# DaoFlow Auth / 同道大厅 / RAG 增量执行矩阵

日期：2026-09-11（Asia/Shanghai）。本文件是本轮实现的运行台账，不替代 `16` 方案、`17` 服务端提示词或 `18` 实施约束。候选源码尚未提交；本地 Postgres 已前向应用 `011`–`014`，并在保留数据备份及克隆库中完成迁移/RPC 演练。生产仍停留在旧发布，未部署本轮改动。这里的 `LOCAL_IMPLEMENTED`、自动测试或克隆库演练均不等同于真实账户、代理、Agnes、审核语料、生产或业务 UAT 的 PASS。

## 增量授权与优先级

本轮用户对“私人账户、匿名大厅、Agnes 可靠性与深度回答、可信经典 RAG、问道输入框”的直接授权，以及 `16`、`17`、`18`、本文件和 `20-AUTH-HALL-RAG-SECURITY-AND-DATA-CONTRACT.md`，只在 AH-01 至 AH-12 范围内优先于 `01-PRD.md`、`03-DESIGN-AND-TECH-SPEC.md`、`05-IMPLEMENTATION-PLAN.md` 的旧边界。具体替代：旧版“无公开社区”不阻止无评论、无私信、无排行的受审核匿名大厅；旧版“无向量库”不阻止本轮的可信语料检索；旧的四句/单章回答不再适用。其余已确认的水墨视觉、私人记录和既有安全规则继续有效。

旧轮次 PASS 只作为历史基线，不能覆盖任何 AH 行。`20` 号契约、语料来源清单、持久 worker 设计和保留数据迁移演练已经过独立范围审查，允许进入实现与工程验证；本增量的独立功能验收尚未完成。`013` 已安装 `pg_trgm` 用于受审核语料的词法检索；没有 pgvector，向量分支仍是 **BLOCKED_UNTIL_CAPACITY_AND_RUNTIME_PROOF**，不得称向量检索已接通。

## P0 文件所有权与冻结契约

| 责任人 | 允许修改 | 禁止修改 | 与其他人冻结的契约 |
| --- | --- | --- | --- |
| 总控 | `src/app/ask/page.tsx`、`src/app/globals.css`、共享导航/布局、共享类型、`package*.json`、迁移、状态/证据、Git 与部署 | A/B/C 的专属模块 | 只消费版本化 `AnswerV2`、`PublicHallDto`、`SessionInfo`；统一错误 `{error:{code,message},requestId}` |
| A：账户 | `src/app/auth/**`、`src/app/api/auth/**`、`src/lib/auth/**`、会话适配、账户页面及其测试 | 大厅、AI、共享 CSS/迁移 | 浏览器仅用本站认证 API；`GET /api/auth/session` 只返回安全的显示身份与 CSRF，不返回 access/refresh token |
| B：大厅 | `src/app/hall/**`、`src/app/api/hall/**`、`src/app/api/me/publications/**`、`src/lib/hall/**` 及测试 | 账户、AI、共享 CSS/迁移 | 公共 DTO 绝不含 owner、邮箱、私有 session/entry/volume ID；发布请求仅接受允许字段 |
| C：AI / RAG | `src/lib/ai/**`、`src/lib/rag/**`、AI 专属测试和评测夹具 | 页面、认证、大厅、共享迁移 | `AnswerV2` 只由服务端校验生成；引用只能指向已批准 `chunk_id`，模型无写入或工具权限 |

总控是迁移的唯一提交者。每位开发者先提交迁移设计和受影响 RPC 列表；总控在本地先顺序应用 `011`、`012`，再附加现场下一号迁移，并为已有私密数据设计前向兼容路径。禁止重写 `001`–`012`、重置数据库、或触碰同机非 DaoFlow 容器。

## 需求 → 实现 → 证据矩阵

| ID | 需求与用户入口 | 前端 / API | 数据库与安全边界 | 自动验证与运行证据 | 当前状态 / Owner |
| --- | --- | --- | --- | --- | --- |
| AH-01 | 未登录导航有“登录 / 注册”；`/auth/login` 提供 OTP 与密码；注册/找回均为非枚举体验 | A：认证页、`/api/auth/*`、安全 `next` | Supabase Auth，不自建密码表；同邮箱复用身份；发码/失败持久限流 | 两个真实测试邮箱：验证码、密码、重发、过期、找回、刷新 | LOCAL_IMPLEMENTED；真实邮箱/代理限流未验；A |
| AH-02 | 账户安全页：改密码、TOTP MFA、当前/全部退出 | A：账户安全 UI 与会话 API | host-only `Secure`/`HttpOnly`/`SameSite=Lax` Cookie；CSRF/Origin；敏感操作近期认证；管理员强制 MFA | MFA enroll/challenge/移除/失效、会话撤销、CSRF/开放跳转/枚举 | LOCAL_IMPLEMENTED；真实 MFA/会话撤销未验；A |
| AH-03 | 私密心笺、卷册、收藏、问道均以账户会话工作；登录前草稿可显式恢复 | A：会话迁移；总控回归既有页面 | 浏览器不读取 Supabase token；用户 JWT 继续受 RLS；退出清 owner 草稿、跨标签只广播状态 | 双账户、刷新、跨标签、退出后切换账户不泄漏既有私密草稿 | LOCAL_IMPLEMENTED；真实双账户 RLS 未验；A / 总控 |
| AH-04 | `/hall` 匿名浏览；仅已验证登录者可从已保存真实 AI 回答预览并主动提交 | B：列表、详情、发布预览/脱敏/我的发布；`/api/hall/*` | 公共随机 `public_id`；服务端快照；不接受客户端 owner/provider/answer/status；默认 pending | 默认私密、公开 DTO、游标分页、草稿脱敏和未勾选同意拒绝 | LOCAL_IMPLEMENTED；真实已验证账户 / Agnes 快照未验；B |
| AH-05 | 发布审核、撤回、举报；删除源问答或账户注销后不遗留公开内容 | B：管理/作者 UI；审核、撤回、举报 API | 受保护管理员角色、MFA 约束、CAS version、审计最小化；删除级联或可靠事务撤回 | 双账户 IDOR、旧版本审核 409、撤回后 404、举报不公开、删除/注销无残留 | LOCAL_IMPLEMENTED；真实双账户、MFA、注销级联未验；B / 总控迁移 |
| AH-06 | `/ask` 获得真实 Agnes 的深度、可追溯回答，页面展示五段与来源；不把静态参考冒充 AI | C：`AnswerV2`、provider 诊断、任务持久化兼容；总控渲染 | 服务端固定提示词 v2.1；白名单请求体；真实 provider/model/prompt/corpus 元数据由服务器写入 | 真实 Agnes、401/403/429/5xx/timeout/invalid JSON/citation；生成、保存、202、重启与仅重试保存 | LOCAL_IMPLEMENTED；可信语料 pending，因此真实 Agnes 运行 BLOCKED；C / 总控 |
| AH-07 | 可信《道德经》RAG：只使用审核语料，回答含 1–3 条精确引文；检索不足会澄清 | C：词法/主题检索优先，向量分支能力评估；`src/lib/rag/**` | version/hash/license/review status；chunks 与用户数据严格分库；逐字引用校验 | 81章语料账本、Top5 小样本、伪造出处、资料注入与不合格片段拒绝 | 管道与拒绝门已实现；语料 PENDING_INDEPENDENT_CONTENT_REVIEW，检索/引用不具资格；C / 总控迁移 |
| AH-08 | 供应商可靠性与成本：明确失败类别、retry-after、有限重试、预算/并发限制 | C：attempt 追踪、脱敏诊断、模型超时/重试策略 | 原子账户/IP/全局配额与 lease；敏感日志无 key/私人正文 | 真实单次虚构问答和可控 401/429/timeout；不把 DeepSeek/静态回答算 Agnes | LOCAL_IMPLEMENTED；迁移克隆库 lease/保存演练通过，真实供应商故障未验；C |
| AH-09 | 截图所示 `/ask` 输入框正常：标签、正文、计数、按钮布局与可访问性 | 总控：`dao-question-form` / `dao-question-input` 和页面行为 | 无 | 320/390/768/1440/1920、200% 缩放、IME Enter、Tab、soft keyboard、reduce-motion 截图/录屏 | E2E PASS：320/390/768/1440/1920 可达且无横向溢出；200%/IME/soft keyboard/reduce-motion 未验；总控 |
| AH-10 | 既有私人功能不回归：心笺、卷册、收藏、搜索、导出、历史 v1 | 总控 + A/C | 旧 answer v1 保持可读；所有授权仍以真实用户 JWT/RLS 验证 | 真实双 JWT 的原有完整脚本、浏览器桌面/手机回归 | 自动回归通过；真实双 JWT/browser 回归仍 BLOCKED；总控 |
| AH-11 | 质量与攻击门禁 | C：30 条常规、20 条注入、10 条高风险/模糊评测；总控归档结果 | 引文完整可核验；无越权、无控制字段覆盖、无 XSS | 常规题至少 27/30 达 8/10；检索 Top5 ≥90%；真实限流则 BLOCKED | 格式、控制字段与伪引文夹具通过；语料未批准，质量阈值 / Top5 指标未执行；C / 独立验收 |
| AH-12 | 独立验收与业务边界 | 新验收者只读候选；不修代码 | 绑定干净产品提交；技术验收不代替用户 UAT | 真实浏览器、双账户、真实 Agnes、迁移与回滚演练；FAIL→修复→复验保留 | 待新独立验收者；真实业务 UAT 保持未执行 |

## 版本化 API / 数据契约

```ts
type AnswerV2 = {
  status: 'answer' | 'clarify' | 'insufficient_evidence' | 'safety_support'
  summary: string
  citations: Array<{ chunk_id: string; chapter: number; quote: string; explanation: string }>
  interpretation: string
  application: string
  boundary: string
  actions: string[]
  reflection: string
}

type PublicHallDto = {
  publicId: string; question: string; answer: Pick<AnswerV2, 'summary' | 'citations' | 'interpretation' | 'application' | 'boundary' | 'actions' | 'reflection'>
  providerLabel: 'Agnes AI'; promptVersion: string; corpusVersion: string
  status: 'published'; publishedAt: string
}
```

新 v2 的客户端结果固定为 `{requestId, answerV2, provider:'agnes'|'none', persistence:'saved'|'generated'|'not_requested', sessionId, retrySaveAvailable}`。`answerV2` 只来自服务端通过的快照；历史 v1 仅由 `GET /api/ask/{sessionId}` 的 `session` 形状读取。只有实际 `provider='agnes' && degraded=false` 的快照才可带 Agnes 标记；语料不足是明确的 `provider='none'` / `status='insufficient_evidence'`，不是静态章节或其他模型冒充的回答。

`POST /api/ask` 仅接受 `question`、`sourceEntryId`、`volumeId`、`requestId`；客户端绝不能选择 provider、prompt、owner、model、visibility 或 review status。**登录路径**严格创建持久 job 后只返回 `202 {requestId,state:'pending'|'processing'}` 和 `Retry-After`，不在该响应中混入回答。`GET /api/journal/ask-requests/{requestId}` 仅同一会话 owner 可读：pending/processing 返回 `202 {requestId,state,result:null,leaseUntil}`；generated/saved 返回 `200 {requestId,state,result:AskAnswerResponse,leaseUntil}`；failed 返回 `200 {requestId,state:'failed',result:null,failureCode}`，绝不回显原始模型正文。`POST /api/journal/ask-requests/{requestId}/retry-save` 只允许 CSRF 保护的空 body、只接受 owner 的 `generated` job，并且只持久化已验证 snapshot；成功 `200` 直接返回 `AskAnswerResponse` 的 saved 终态，**绝不重新调用模型**。

**匿名路径**明确不创建 job、不写问答/心笺/大厅，仅在同一 HTTP 请求内受可信代理 IP 的 HMAC 预算执行；成功 `200` 返回 `AskAnswerResponse` 且 `persistence:'not_requested'`，刷新即丢失且不能发布大厅。没有代理证明、服务密钥、已批准语料或 Agnes 结果时均明确失败闭合。所有 public/private error 均使用 `{error:{code,message,requestId}}`；匿名和登录两条路径的状态、保存和返回形状不得互相冒充。

## Migration, rollout, and rollback

1. Back up and verify the existing local DaoFlow database before any schema mutation. Apply tracked `011` then `012` to the local database in source order; verify no private rows are deleted.
2. Add one new forward migration after the verified source ledger for answer v2, corpus chunks/review metadata, hall publications/reports/audit, roles/limits and owner-preserving constraints/RLS/RPC. Do not edit historical migrations.
3. Test it against a preserved-data copy with two synthetic accounts. Rollback means switch application release back only if the migration is additive and backward compatible; data-bearing migrations require a verified restore, not ad-hoc `DROP` statements.
4. Production migration and release remain a separately authorized rollout after a clean candidate, backup, restore rehearsal, canary checks and explicit deployment decision. This implementation task does not deploy by implication.

## Evidence rules

No row becomes PASS from build, static fallback, an admin/service-role request, skipped test, or a previous release report. Results are bound to the candidate commit, command, environment, timestamp and synthetic test data label. Real user UAT remains separate after technical independent acceptance.
