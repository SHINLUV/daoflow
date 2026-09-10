# DaoFlow 登录、大厅、Agnes 与经典检索方案

日期：2026-09-11。性质：设计交接，尚未实现本文件新增功能。本轮只读核查代码和生产健康/汇总日志，未修改生产。

## 1. 已核查问题与边界

- 当前 Git：29e3b94601a93bcbf0e159136356820be0f20e0d，开始时工作树干净；生产健康返回 abe73adb372f6f4f6a2dca94819fcd14b48dc6ac。两者之间是文档提交。
- 登录不是完全没有后端：src/app/my-dao/page.tsx 已调用 signInWithOtp，src/lib/supabase 有客户端与服务端会话。缺少明显、完整的注册/登录/账户安全体验；既有报告未证明 QQ 用户实际收信后完成生产浏览器会话。
- 截图对应 src/app/ask/page.tsx 的 ask-question textarea。表单只有 dao-reading-card；globals.css 的输入框样式限定在 dao-ask-form textarea，未命中当前元素。标签内联、默认白底小文本框与计数/按钮拥挤符合这一原因。实施时仍须在浏览器检查计算样式和 CSS 加载，不能误改未被使用的旧 AskInput.tsx。
- src/lib/ai/askDao.ts 强制“不超过4句”、只匹配一章，每次注入81章原文；不是真正的分段检索。Agnes 8秒超时，随后 DeepSeek，再静态关键词解读。src/lib/ai/callModel.ts 固定 agnes-2.0-flash，maxRetries=0。
- 本次生产近24小时日志聚合各发现1次 Agnes/DeepSeek 降级，类别 unknown。不能由此证明密钥未配置，也不能把过去一次成功作为当前稳定性证明；须安全诊断。
- .ai-development/state.yaml 仍指向旧本地提交与旧范围，Terra 应依据现场更新当前阶段，保留历史而非继续引用过期 PASS。

## 2. 开源认证选型

| 方案 | 适用性与代价 | 本项目决定 |
| --- | --- | --- |
| Supabase Auth / GoTrue | 已与 auth.users、auth.uid()、JWT、PostgREST RLS 绑定；有邮箱认证和 MFA 能力 | 保留并完善。少一次身份迁移，账户ID和私密记录关系保持稳定 |
| Better Auth | TypeScript 认证框架及插件生态，适合新的 Next.js 产品 | 备选；替换会牵涉 JWT/RLS、账户映射、会话和既有数据迁移，不为增加登录表单引入第二身份源 |
| Keycloak | 独立身份管理平台，适合多系统统一身份体系 | 暂不引入；单产品新增运维与身份联邦成本不合算 |

这是对当前代码和运维规模的工程判断，不按 GitHub 星数或框架名承诺安全。实施前审阅锁定版本、安全公告、许可证、兼容性；禁止直接追随 latest。

来源：[Supabase Auth](https://github.com/supabase/auth)、[邮箱无密码登录](https://supabase.com/docs/guides/auth/auth-email-passwordless)、[MFA](https://supabase.com/docs/guides/auth/auth-mfa)、[Better Auth](https://github.com/better-auth/better-auth)、[Keycloak](https://github.com/keycloak/keycloak)。

## 3. 登录与账户设计

### 用户入口

导航未登录明确写“登录 / 注册”，已登录写“我的账户”。/auth/login 提供“邮箱验证码”“邮箱密码”两个标签；注册页、忘记密码页、账户安全页均有实际入口。保留旧魔法链接回调兼容性，验证码作为主要无密码入口，避免必须在原标签点击邮件的困扰。QQ 邮箱支持收信；邮件服务授权码不是用户登录密码。

注册需验证邮箱，设置密码须通过有效验证流程；同邮箱复用现有 auth.users 身份，不自动创建第二账户。密码由 Auth 服务管理，应用不储存/记录明文或自制密码散列。建议最少12字符、支持长密码和密码管理器，不强制周期更换。已存在的纯邮件账户通过近期验证设置密码。

验证码单次使用、建议10分钟有效；同邮箱60秒后重发，累计验证失败限制与发送限额由服务端执行，倒计时只是UI。邮件模板真实显示 OTP，实际位数和验证 type 以锁定 Auth 版本为准；限制重发后旧码、重放、并发验证，并测试过期状态。注册、找回及发码返回统一非枚举信息。

账户安全页：修改密码、启用TOTP MFA、退出当前会话、退出所有会话。管理审核角色强制 MFA；普通用户自愿开启。敏感操作需近期认证；MFA解除/丢失后的恢复机制需落地并测试，不允许凭邮箱字符串解除。微信登录不在本次必交范围；不能把 QQ 邮箱网页上的微信登录当作 DaoFlow 微信登录。

### 会话架构

推荐在现有 Supabase Auth 上增加同源 BFF：浏览器只调用本站 /api/auth/*；Supabase access/refresh token 保存在 Secure、HttpOnly、SameSite=Lax、host-only Cookie 中，受控服务端以用户 JWT 请求数据库，仍受 RLS。主站固定 tanfeng.shinluv.cloud，dao 保留兼容入口，不使用 .shinluv.cloud 广域 Cookie，避免与ERP共享会话。

这是实质会话改造：当前 createBrowserClient 需要逐个迁移为 /api/auth/session 查询；不能只加 HttpOnly 同时仍依赖浏览器读取 token。服务端每次用受信验证获取身份，不信请求体 user_id。刷新需处理并发轮换、Cookie写回及失效；无授权的浏览器不可获得 access/refresh token 响应。认证接口和私密页 Cache-Control:no-store，公共CDN不得缓存会话。

写接口严格校验 Origin，采用CSRF令牌，回调校验 state/PKCE、安全next路径，排除 //、协议绕过和编码绕过。SSR中不要关闭校验。只允许准确的本站回调域名；对遗留链接做兼容测试。

业务权限用用户 JWT；service_role仅初始化测试账户与受控内部操作。管理权限存储在不可由用户修改的服务端角色/受保护表中，不信 user_metadata。Auth 公共直连入口仍须限流，不能只在 BFF 限制而留直连绕过。

登录前草稿保留在原标签；跨标签仅广播登录状态、草稿标识，不广播正文。登录后显式选择恢复。退出清除该owner私密缓存，避免下个账户恢复上个账户内容；广播退出事件。若只撤销refresh token，旧JWT可能持续有效到过期，应记录实际窗口；敏感写入需会话撤销校验，不能承诺所有令牌立即失效却未实施。

### 滥用与成本

提供持久化、原子限流（当前规模可用 PostgreSQL 计数/锁；不使用仅进程内 Map）。初始建议：发码每邮箱5次/小时、IP20次/小时；登录失败渐进限流，避免永久锁号；游客AI每日3次、账户每日20次、每账户同时1个生成，全站同时2个生成。均为待压测调整参数。仅信可信代理传来的IP。验证码挑战须国内可达并实测，不能成为唯一防线。设全站模型预算熔断与可见冷却提示。

## 4. 匿名大厅

产品名建议“同道大厅”。/hall 为公共列表，/hall/[publicId] 为独立分享页；未登录可浏览，发布必须登录且邮箱已验证。匿名是对公众隐藏身份，服务端保留作者关系以支持撤回、举报与治理，不承诺无法重新识别。

生成和保存默认私密。回答成功保存后显示“匿名分享到大厅”，用户点击后看到完整问题、AI回答、来源引用与隐私提示，再勾选同意发布并确认。不能预勾选、自动发布历史记录、继承上次公开偏好或让模型决定 visibility。

发布预览支持编辑公开问题与对问答作敏感信息遮盖。服务端保留原回答快照，公开编辑后的回答标识“已脱敏”；不允许任意改写后仍冒充原始AI回答。若问题发生实质改变，要求重新生成对应回答或取消发布。脱敏可能漏掉身份信息，提示用户检查姓名、联系方式、地点、职业、第三方隐私和组合识别线索。

首版只交付浏览、主题/章节筛选、游标分页、发布预览、我的发布、撤回、举报、管理员审核；不添加评论、私信、排行榜。默认发布进入 pending，管理员审核通过才可见。管理员由受控运维配置，不通过公开注册授予；无审核人时维持待审核，不能自动绕过。自动检测只能辅助，审核发布和撤回都做版本比较防竞态。

公共卡片：匿名标识“同道”、公开时间、公开问题、AI解读摘要、引用章节、查看全文、举报；不返回邮箱、owner_id、私密问答/心笺/卷册ID。发布作者在单独的 /api/me/publications 查看自己的管理字段。公共 publicId 独立随机生成，不复用私密 sessionId。

### 数据及权限契约

- hall_publications：id/public_id、owner_id、source_session_id、question_snapshot、answer_snapshot、citations_snapshot、provider、prompt_version、corpus_version、status、version、created_at、published_at、withdrawn_at。owner/source组合外键保证同用户；source唯一约束控制每条问答一个发布记录。
- hall_reports：publication_id、reporter_id（首版登录举报）、reason枚举、备注长度上限、状态；禁止公开读取举报人或备注。
- hall_audit_events：受保护的最小事件记录，不复制正文；管理员访问审计。
- 私表默认无匿名权限。public DTO 只列明字段；若建立视图要核查 Postgres view owner/RLS 语义，不能假定视图天然继承 RLS。优先受控公共API读取仅published行并投影公开字段。
- POST /api/hall/publications 接受 sessionId、预览版本、脱敏操作及同意标记；服务器验证归属、saved状态、真实AI标记，读取快照；拒绝客户端伪造 owner/provider/answer/status。幂等键绑定用户及内容摘要。
- GET /api/hall?cursor&chapter&theme、GET /api/hall/[publicId]；GET /api/me/publications；POST /api/hall/[id]/withdraw；POST /api/hall/[id]/reports；管理审核独立权限接口。
- 时间线用 published_at + id 稳定排序，游标绑定筛选条件。初期 no-store，撤回后源站立即404；后续引入缓存必须实现撤回失效。网页默认 noindex，用户应知道不能收回他人截图/已下载副本。
- 删除私密源问答/注销账户时，在同一事务或可靠流程先撤下对应公开内容。外键级联不能留下仍公开的孤儿快照。公开内容修改必须回到pending；并发审核旧版本必须409。
- 防存储XSS：默认文本渲染；若Markdown必须禁原始HTML、危险链接/图片、脚本协议，不用 dangerouslySetInnerHTML。大厅内容永不进入可信经典知识库。

## 5. Agnes 可靠性修复

先复现再改配置：本地和容器内各检查变量是否存在（只输出布尔）、上游HTTP类别、模型/地址、DNS/TLS、时延、响应字段。使用虚构问题做一次真实端到端请求，受限冷却复测。分别记录401/403、429、5xx、timeout、network、empty、invalid_json、invalid_citation；脱敏日志只含requestId、状态、耗时、供应商、版本，不打印密钥、完整响应或私人问题。

必须追溯首个 Agnes 失败原因。当前 localFallback(question, reason2) 会只保留第二供应商原因；改为内部attempt列表，用户看到有用的失败状态。key存在不能证明有余额或有模型权限。

保留 agnes-2.0-flash 为默认待验证模型，不假设它有 embeddings、JSON schema、工具或流式能力。参数能力用实际接口验证，不能从 OpenAI 兼容地址推定全兼容。建议候选超时30秒、端到端预算45秒；以真实延迟校准。429尊重Retry-After，在总预算内最多一次服务端重试并带抖动；401/403不重试。生成后保存失败只重试数据库。

较长生成必须与现有lease、202、requestId一致：持久任务+可靠worker或已验证的请求内生命周期，不能响应202后把关键工作丢给易丢失的后台promise。lease应大于最大处理预算或定时续租，保留claim_token/generation隔离旧worker回写。客户端断开、worker重启和并发请求须实测。上游没有幂等支持时无法保证故障窗口绝不重复计费，应明确数据库恰好一次保存与模型可能重复调用的区别。

UI始终显示可信服务端来源：Agnes AI、AI暂不可用、经典参考（非AI）。静态参考独立按钮展示，禁止把它作为正常AI成功回应或允许以真实AI标识发布大厅。备选模型必须显式启用并显示实际提供方，不能静默替代用户所要求的 Agnes。

新答案用结构化 answer_v2 JSONB 存储，并保留旧 interpretation/matchedChapter 兼容。服务端追加 provider、model、promptVersion、corpusVersion、requestId、generatedAt；这些字段不能信模型自报。保存、历史、导出、重试、大厅快照、分享页同步版本化。历史v1原样可读，不能自动用模型重写。

## 6. RAG：先做小型可信经典库

结论：RAG值得做，但不能修复401/429，也不自动让回答深刻。当前81章短文本可先以全文上下文作为基线；RAG用于加入可追溯解释、准确引文与更低输入量，并用盲测证明收益。

推荐开源组合：[pgvector](https://github.com/pgvector/pgvector) + PostgreSQL + 轻量TypeScript检索层；候选中文多语向量模型 [BAAI/bge-m3](https://huggingface.co/BAAI/bge-m3)。pgvector是检索组件，不是开箱即用的完整RAG平台。BGE-M3需独立本地embedding服务或经批准的服务，不能调用Agnes不存在的embedding端点。先测共享服务器CPU/RAM和模型内存，资源不足就采用词法检索过渡并明确标识，不能挤占ERP。

完整平台备选 [RAGFlow](https://github.com/infiniflow/ragflow)，适合后续多格式资料入库与管理。当前81章+少量注释引入整个平台的运维成本较高，因此不作为首版默认。若后续扩展再核验锁定版本部署资源与连接器。不会同时安装两套RAG。

语料分层：A为核对版本的81章原文；B为人工审核、标明现代阐释的白话及主题索引；C仅加入授权清晰/可用的注释。古代原文和现代译注权利不同，禁止批量抓取当代注释不标来源。现有seed白话亦需核对来源与质量，不因已有就标成权威。每条保存edition、chapter、段落、source、license、reviewStatus、version、hash。

短章以整章为单位，长章按语义段拆分并保留所属章。不要机械定长切断句义。仅approved版本可检索。用户问题、私人记录、大厅问答、自动生成回答均不得混入权威语料；管理员导入资料中的指令同样不可信。

检索：规范化问题（保留原文）→中文词法/主题匹配与向量检索各召回候选→RRF融合→去重与章节多样性→取3–5片段供模型选1–3处引用。Postgres默认英文分词不等于中文检索；需验证中文分词/主题词，初版可用审核词表+trigram。小语料可精确向量扫描，不必强建HNSW。缓存键包含模型版本、语料版本和文本hash；私密问题不写共享明文缓存。

输出仅能引用给定chunk_id；服务器核对quote为该chunk原文子串，章节/版本一致；规范化只处理预定义空白和标点，不能宽松相似匹配冒充原文。引用失败返回明确状态或最多一次受控格式修复，修复计入生成预算，绝不归为“仅重试保存”。外部检索资料不覆盖系统规则；模型无数据库写、终端、外网工具权限。

检索不足不硬配章：返回clarify/insufficient_evidence，必要时请求补充。区分“原文含义”“现代应用”“不适用边界”。回答深度来自具体矛盾分析与反例，不来自引用数量。

## 7. 提示词与安全边界

使用配套17号文件的系统提示词和输出协议。提示词以server-only版本化文件部署；不接受浏览器systemPrompt/messages/role/model/baseURL覆盖。请求body严格字段白名单。部署主机文件只读、管理入口鉴权、Git/CI访问控制保护提示词不被持久改写。若Git仓库公开，提交的提示词当然可被阅读；安全设计不得依赖提示词保密，不自行改变仓库可见性。

“不能修改存储的提示词”可以靠权限控制；“模型永不受恶意输入影响”不能靠一段文本保证。采用角色隔离、低可信资料分区、无工具权限、输出schema/引用校验、RLS与自动攻击回归。别把提示词写成绝对防注入承诺。参考 [OWASP防提示注入指南](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)。

## 8. 截图UI修复规格

保持纸色、宋体标题、墨绿按钮、水墨动效。为实际问道页建立 dao-question-form 与 dao-question-input 专用类；不要全局覆盖所有textarea。标签display:block；输入宽100%、min-width:0、box-sizing:border-box、16px字、行高1.8、圆角14px、纸色半透明底、1px柔和边框、内距16px，桌面min-height180px、手机160px。允许纵向resize，限定在容器宽度内。

卡片桌面padding32px、手机20px；计数在下方右对齐，按钮44px以上触控高度；小屏按钮全宽。focus-visible清晰描边；空白禁提交，IME合成Enter不误触，Enter换行。请求中保留正文、显示进度，失败保留编辑和重试入口。320/390/768/1440/1920、200%缩放、软键盘、reduce-motion、键盘Tab均验收。

## 9. 门禁与交付

每条需求对齐UI/API/DB/自动测试/浏览器证据；先本地隔离库、真实测试邮箱与两账户。认证/RLS不能用管理员请求代替；模型成功不能以mock代替。生产验证安排受控合成内容，明确原FAIL、修复提交与新复验。所有新迁移从现场下一号追加，不预设一定是013。

必须覆盖：验证码登录/密码注册找回/MFA与失效/草稿/退出；发布默认私密/他人ID拒绝/审批并发/撤回/删除源记录/公开DTO无身份；Agnes真实深度回答与429/401/超时/保存失败；RAG引文/资料注入；截图修复与手机完整流程。

质量评估至少30条虚构常规问题（六境各5）对比旧四句基线；另外20条注入、10条高风险/模糊输入。评分维度：具体理解、经典解释、现实映射、边界与反例、行动可用性，每项0–2；常规至少27/30达到8分且引用全部可核验。检索集独立标注可接受章节，Top5命中≥90%；这是本项目小样本门禁，不是泛化正确率。风险/注入测试不得出现跨账户数据、控制字段越权或伪造出处。请求数按供应商配额排程，遇真实限流保留BLOCKED。

新独立验收者绑定产品提交，执行真实浏览器与双账户校验，输出FAIL→修复→复验记录；业务UAT仍待用户。交付运行地址、启动方式、迁移、回滚、测试命令、截图录屏、问题矩阵和未验证项，不以构建成功结项。
