# DaoFlow V2 · 冻结设计与技术规格

版本 1.0，2026-09-09。依据 01-PRD.md，PRD审查见02。所有下列数字为本方案设计目标，不是已通过测试的结果。实现必须保留 Next.js 14 / React 18 / Tailwind 3 / Framer Motion / Supabase，禁止照抄参考网站改成 Vite 或另起演示站。

## S1 信息架构（R01 R08 R11）
路由：`/`此刻；`/journal`我的卷册；`/journal/entries/[id]`心笺；`/journal/volumes/[id]`一事一卷；`/chapters`经典目录；`/chapters/[id]`原有阅读；`/ask`原有问道结果；`/my-dao`保留登录、退出与旧链接兼容，登录后提供明确进入卷册链接。顶栏仅“此刻 / 我的卷册 / 读经典”，当前项用短朱线与aria-current标示。关于放页尾。

首页严格顺序：紧凑导航 → 山水中“此刻，什么让你挂心？”及编辑器 → 六境选择 → 每日一句与经典目录入口 → 两三行产品说明 → 页尾。首页只有一个编辑器，以“记下此刻 / 问一问道”分段切换；默认记录模式，记与问同等可发现，当前面板只有一个主提交。记录正文最多10000字，问道500字；切换模式分别保留草稿，不截断。六境选择激活问道模式，显示建议句，用户点建议句才填入；已有内容须询问替换或保留。长记录转问道打开问题编辑面板，不直接提交。

登录回访条位于编辑器上方，仅显示真实上次打开的卷册；无历史则不占空间。卷册区tabs为“记录 / 卷册 / 收藏”，记录tab内筛选全部、心笺、问道、回收站。不可把旧最近5条历史当作全部数据。

问道页次序：用户问题h1 → 回应 → 相关章节及原文 → 反思问题 → 继续问道/复制/读原文。通用降级明确标注。读经页次序：卷次与章号h1 → 原文 → 可切换白话 → 我的收藏/批注 → 上下章。原文永远为可信本地章节或数据库章节，不由图片OCR或模型生成。

## S2 视觉执行图则（R02）
概念：宋式青绿山水、古籍册页、纸面文房；丰富但有秩序。禁回到左文右拱形照片、胶囊卡片墙、通用SaaS大渐变、居中巨型旋转太极。题字是品牌纹样，真实任务标题更易读。

色板：纸#F1EBDD，浅纸#F8F4E9，墨#252D29，石青#315E60，石绿#72806A，朱砂#A34536，旧金#AA9060。朱砂集中于主按钮、选择标记、印章；旧金只用于细线，不大面积铺色。正文墨色；石绿不直接用于小字，次级文字使用#526058。普通文字对比至少4.5:1，大字3:1，焦点和控件边界3:1。

1440×900桌面：内容最大1320px，左右60px；12列，24px沟槽；导航高80px。首屏主体约680–740px高，山水横跨全宽后景，远山偏右，左中部留出纸色净区。题字“问道”置右上，120–160px，不覆盖表单。真实标题44–56px，正文16–18px，行高1.8；编辑器宽600–660px，浅宣纸面，边界2–4px小圆角或自然纸边，内部间距24px，正文区至少112px高。操作按钮高48px，朱砂底浅纸字，圆角4px，不用大胶囊。导航与标签14–16px。标题使用本地宋体Regular，长正文用清晰中文sans，字体许可和子集记录在资产清单；不得把所有文字都设为Light。装饰书法仅限“问道”、六个单字，保留可访问文字名称。

390×844手机：边距20px，导航56–64px，不挤成两行细字；三个主导航可在底部固定条高64px+safe-area，正文留足底部padding；品牌顶栏精简。首页标题30–36px，编辑器占满可用宽度，首屏可见模式切换、输入区域和保存/问道按钮。装饰山水缩到上部和边缘，不能把大图插在编辑器与六境之间。输入16px，点击区域至少44×44px。六境为横向可滑动册页列表，露出下一项边缘并保留左右按钮；不劫持整个页面横向滚动。768px转2列内容，1024px以上桌面排版。

六境桌面：六幅高360–420px的窄长画幅一行，选中画幅展开到约两倍宽，其余仍可辨认。小屏不足空间时改3列/横滑，不强行塞六列。每幅固定主题名称、意象字和简短说明；展开区域呈现原文、出处和最多3个可点击问题建议。主题映射：焦虑与情绪/静/静水/16章；关系与边界/和/双岸/8章；选择与决策/择/岔流/44章；事业与创业/行/山径/64章；成长与自我/生/新竹/33章；无为与有为/流/流云/48章。图像风格、纸色、线条密度一致。

卷册页：顶部页名与“新建心笺/新建卷册”，下面分类与搜索；主区用古籍目录样式的行列表，不用每条巨型卡片。卷册可用封面小图+标题+真实条数+最近更新；装饰不能替代状态。卷内以日期分组的时间线呈现心笺与问道，点开可阅读全文，独立路由可刷新。心笺页在纸面编辑器旁提供可选标题、心情、所属卷册，手机收纳为“更多选项”。收藏列表显示原文片段、章号、自己的批注；输入批注不能与原文混淆。

阅读容器最大760px；中文原文22–26px，白话16–18px；手机原文20px，白话16px，正文行高1.9–2.1。长文只用横排。竖排只用于少量短题签。每页只有一个h1；成功、空、错误页同样完整设计。

## S3 美术资产制作（R02）
必须实际制作并检查AI美术资源，不可用emoji、渐变块、未加载图片完成验收。使用可用imagegen技能/工具生成；生成本身由当前任务授权，不购买外部套餐。参考可浏览：CodyHouse https://codyhouse.co/gem/ink-transition-effect ，Codrops https://tympanus.net/codrops/2025/01/22/webgl-shader-techniques-for-dynamic-image-transitions/ ，MotionSites Heritage Grove https://motionsites.ai/?prompt=heritage-grove 。此前Canva账户模板为空、MotionSites免费提示额度为0属于旧观察，使用前确认；不依赖付费解锁。参考只借风格和机制，不直接热链素材作为正式资产。

资产目录`public/daoflow-v2/`；manifest在`docs/redesign-v2/assets/manifest.json`：id、路径、尺寸、字节、sha256、生成工具、prompt、来源/许可、用途、替代文本、审美检查结果。主画先定锚图，后续生成附参考图保持一致。中文UI文字全部HTML，生图禁止文字/水印/界面按钮。

基础生成提示：『为 DaoFlow 东方私人记录与道德经阅读网站制作宋式青绿山水插画。温润宣纸底#F1EBDD，松烟墨，低饱和石青石绿，绢本细纹，松针山石有细腻笔触，薄雾与负空间，博物馆书画册页品质，平面绘画非摄影非3D，无人物大特写，无文字无水印无按钮。画面细节集中边缘，内容区留平静纸色。』

A01首页横画2560×1440：左中45%净区，山势和松树主要在右侧与下边；A02手机竖画1080×1600：上部山峦、左右松枝，中下部净区。A03–A08六境每张768×1280，分别静水/双岸/岔流/山径/新竹/流云，主体下半部，上端给HTML题签。A09纸纹1024方形低对比可平铺；A10印章/书签无字装饰透明图；A11–A13首页远山/近松/雾层，需一致构图与透明边缘，可用生成工具编辑参考图取得。装饰层CSS动画，透明支持和缩放裁切必须检查。若工具不能稳定分层，改一张绘画+程序雾层并记录，不用坏抠图冒充完成。单页首屏图像压缩目标总计≤1.2MB，手机≤600KB；其余懒加载，图片明确宽高或aspect-ratio。

## S4 交互与水墨（R03 R10）
路由转场状态机 idle→covering→navigating→revealing→idle。只拦截同源正常左键内部跳转，修饰键、新标签、下载、外链、锚点走原生。600–900ms总视觉目标；墨从触发区域扩散后换页，不做纯黑屏停顿。导航超过1.5秒展示真实加载提示，5秒内移除遮罩并给可操作错误/重试，绝不永久pointer-events阻塞。并发点击取最后目标或临时禁用并公告，不能重复push。后退/前进不重放全屏动画、不丢滚动位置。初次加载文字与操作直接可用，装饰渐入≤1000ms。

实现优先CSS mask配噪声纹理/序列遮罩，若质感不达标才在独立转场组件使用WebGL；不得照搬旧jQuery或16000px大sprite。每次离场释放动画/监听器/WebGL资源。路由能力由共享MotionProvider提供，页面Agent不得各建一套。

局部：六境350–500ms画幅展开、图像墨化切换、题签显形；hover仅预览，click/Enter/Space才选择。纸面focus边线180ms；保存pending文本，服务器成功后160–240ms落印并状态公告；失败保留内容。读经下一章250–350ms纸页轻移，不等待全屏墨染。背景最多三层，远山移动≤8px、近松≤16px，雾30s缓动；仅fine pointer启用视差，输入聚焦暂停视差。减少动态偏好禁视差/雾/墨染，使用≤100ms淡入或无动画；支持全局“动态效果”开关，存非私密偏好。

性能验收：本机1440与390生产预览，Chrome性能记录10次六境/路由动作，非网络原因无>200ms长任务；若失败降低动效复杂度并重测。Lighthouse手机模式本地3次记录中位数，性能目标≥85，CLS≤0.1，记录机器与工具版本，不把本地分数称生产SLA。键盘全流程、焦点迁移、Escape关闭面板、prefers-reduced-motion均实测。

## S5 数据与信任边界（R04–R10）
使用原Supabase auth.users身份，经服务端auth.getUser取得user.id，写入body禁止user_id/created_at等权威字段。普通业务使用带用户会话的anon客户端+RLS，不使用service role绕过。旧users表和ask_sessions保留，新表owner直接引用auth.users。auth callback next只接受站内以单斜线开头路径，拒绝//、协议、反斜线等逃逸，验证交换成功后跳转。配置缺失：中间件允许公共页/本地经典，私密API返回503；不得建立假用户。

迁移按003基础记录卷册、004收藏、005问道关联顺序，先在隔离本地Supabase执行、验证旧种子数据与登录触发器，再增量演练。禁止自动对远程生产库应用。不改写001/002历史迁移。

新表：
- journal_volumes：id uuid PK(客户端生成用于创建重试)，user_id uuid NOT NULL，title varchar(60) NOT NULL非空，archived_at nullable，created_at/updated_at timestamptz服务端，version int默认1。unique(user_id,id)。
- journal_entries：id uuid PK，user_id NOT NULL，volume_id nullable，title varchar(60) nullable，body text检查trim长度1..10000，mood可选六枚举，deleted_at nullable，created_at/updated_at，version。复合FK(user_id,volume_id)→volumes(user_id,id)，禁止跨用户关联。
- journal_favorites：id uuid PK，user_id NOT NULL，chapter_id 1..81，excerpt text非空，note text≤2000，created_at/updated_at，version；unique(user_id,chapter_id,excerpt)。服务端验证excerpt确为可信章节原文的连续子串，整章收藏存整章原文。旧favorites整章条目按可信原文幂等导入，原表保留不破坏旧代码。
- ask_sessions增request_id nullable UUID、source_entry_id nullable UUID、volume_id nullable UUID；unique(user_id,request_id)，unique(user_id,id)，复合FK拥有者一致；新增source_entry_id的删除行为只置空source_entry_id，不置空user_id。PG版本若不支持部分SET NULL则用受限事务函数先清关联后删记录。关联卷册以生成时选择快照为准，后续移记录不自动移动问道。
- journal_preferences：user_id PK，last_volume_id nullable，updated_at；同所有者复合FK。只在实际打开拥有的卷册后写入，缺失或归档则首页不展示继续条。

所有新表ENABLE RLS，SELECT USING(auth.uid()=user_id)。authenticated只获自身SELECT，REVOKE直接INSERT/UPDATE/DELETE，anon无私密表权限。写操作统一经明确列出字段的受限RPC：create_entry、patch_entry、purge_entry、create_volume、patch_volume、create_favorite、patch_favorite、delete_favorite、set_journal_preferences。RPC为SECURITY DEFINER且固定search_path=public,pg_temp，REVOKE PUBLIC/anon EXECUTE，仅authenticated可执行；每个函数首先取auth.uid，拒绝NULL，所有查询明确owner过滤；服务端同样auth.getUser；不接受user_id/时间戳，原子检查version、归档/回收状态、字数、原文片段、同所有者FK，服务端生成created_at/updated_at并version+1。不得用通用任意表名/JSON更新RPC。内部RPC禁止客户端修改模型快照。旧ask_sessions同步撤销authenticated直接写权限并保留自身SELECT，旧/api/ask写路径在005一起改为服务端专用受限写入；验证旧浏览器没有依赖直接写。请求查询显式限定user_id；他人ID返回404避免泄漏。私人内容不进日志/URL/analytics，日志只记录requestId、错误码、耗时。日期DB UTC、界面按用户时区显示。

更新必须CAS：where id+user_id+version匹配，version+1，updated_at服务端；不匹配返回409与当前版本，客户端提供保留本地草稿/加载远端内容，禁止静默覆盖。创建用客户端UUID，重试同UUID同body返回原记录，不同body返回409。移动归卷验证卷未归档/记录未删除；归档后允许查看和移出，不允许新增归入。回收站记录禁止编辑/问道，恢复后才可操作。软删、恢复都是带version更新；永久删只允许已deleted记录，通过事务清来源关联再删，不删独立ask_sessions。

索引：entries(user_id,created_at desc,id desc)，entries(user_id,volume_id,created_at,id)，volumes(user_id,updated_at desc,id)，favorites(user_id,created_at desc,id)。列表稳定cursor=(created_at,id)，默认20最大50，查询关键词trim≤100，搜索title/body参数化且用户隔离。统一时间线合并entry和ask，稳定排序created_at,id,type；后续翻页不以updated_at作排序键，更新条目不重复出现在列表尾。

## S6 API契约与前端类型（R04–R10）
所有成功JSON，日期ISO，UUID字符串；错误统一`{error:{code,message},requestId}`，400非法、401未登录、404不存在/无权限、409冲突、503依赖不可用、500内部失败。保留旧/api/ask响应字段和旧history.sessions；新增API不采用旧字符串error约定，前端兼容原接口错误。

```ts
type Mood='calm'|'uneasy'|'sad'|'angry'|'hopeful'|'mixed';
type Entry={id:string;title:string|null;body:string;mood:Mood|null;volumeId:string|null;version:number;createdAt:string;updatedAt:string;deletedAt:string|null};
type Page<T>={items:T[];nextCursor:string|null};
type CreateEntry={id:string;body:string;title?:string;mood?:Mood|null;volumeId?:string|null};
type PatchEntry={version:number;body?:string;title?:string|null;mood?:Mood|null;volumeId?:string|null;deleted?:boolean};
```

GET/POST `/api/journal/entries`：GET filter=active|trash&q&cursor，POST CreateEntry；GET/PATCH/DELETE `/api/journal/entries/[id]`：PATCH PatchEntry，DELETE仅已回收记录并body{version}。GET/POST `/api/journal/volumes`：创建{id,title}；GET/PATCH `/api/journal/volumes/[id]`：PATCH{version,title?,archived?}；GET `/api/journal/volumes/[id]/timeline?cursor`返回type=entry|ask联合时间线。

GET/POST `/api/journal/favorites`：创建{id,chapterId,excerpt,note?}；PATCH/DELETE `/api/journal/favorites/[id]`：更新{version,note}，删{version}。GET `/api/journal/timeline?kind=all|entry|ask&q&cursor`，仅active记录+自身ask；回收站用entries API。GET `/api/journal/export`导出{schemaVersion:1,exportedAt,entries,volumes,favorites,askSessions,preferences}，包含回收站和归档项，不含token；服务端单一repeatable-read快照RPC，分用户，最大5MB超过返回明确413并指导分批日期导出（GET接受from/to ISO，含起不含止，响应标明范围），不默默截断。GET/PATCH `/api/journal/preferences`，PATCH{lastVolumeId}。

记录转问道：URL只带entryId，不带正文；登录读本人entry，在本地问题编辑面板形成question，POST `/api/ask`新增可选sourceEntryId、volumeId、requestId。先验证source与volume权限再调用模型；旧客户端仅question照常可用。保存失败返回回答和meta.persistence='failed'，无库ID；saved仅真实写入成功；匿名为not_requested。

为避免失败重试重新生成，登录请求先创建`journal_ask_requests`：user_id,request_id复合PK、question、source_entry_id、volume_id、state(processing|generated|saved|failed)、result_json nullable、session_id nullable、created_at、lease_until；RLS所有者，客户端不可写result_json。服务端同一次RPC原子claim，requestId同payload并发返回202+Retry-After，异payload409，完成重试返回已有结果。模型结果先写generated，随后事务写ask_sessions并更新saved；失败后POST `/api/journal/ask-requests/[requestId]/retry-save`仅从服务端generated结果重试保存，不接受客户端伪造模型响应。若结果暂存也失败则只能复制当前回答/重新生成并明确说明，不能承诺原回答可重试保存。processing租约60s过期允许重试，不保证模型供应商恰好一次计费。GET该路由仅自身查看状态与结果。历史问道加入timeline，既有NULL user_id匿名数据不暴露。

该请求表属于005迁移；使用服务端专用模块及SUPABASE_SERVICE_ROLE_KEY调用claim_ask_request、complete_ask_request、save_ask_result，函数EXECUTE仅service_role，撤销PUBLIC/anon/authenticated权限。模块先auth.getUser，显式传入已验证user.id，不接受浏览器user_id；只允许操作本人的请求与历史。service_role不进入client bundle。缺此key时记录功能正常；问道仍返回内容但meta.persistence='failed'并明确配置条件，不能称历史保存完成。普通记录业务仅走上述auth.uid RPC。

请求表额外claim_token uuid、generation int默认1。首次claim生成token；只有lease_until过期且state=processing才可原子接管并generation+1、更新token。模型完成写必须where user_id+request_id+claim_token+generation+state='processing'匹配；匹配0行表示旧worker失去所有权，丢弃其结果并读取最新状态，禁止写历史。complete先原子写generated并保存result_json；save_ask_result在事务内锁请求行，若已saved返回session_id，若generated则INSERT ask_sessions ON CONFLICT(user_id,request_id)取得唯一历史id后更新saved。generated不能被lease接管，只可retry-save。所有请求payload按question/sourceEntryId/volumeId固定比较；客户端不能更改生成结果。authenticated对旧ask_sessions和请求表仅自身SELECT，对服务写函数无法EXECUTE。相关RPC还须核验来源与卷册仍属于本人，来源已删除时仅清来源，卷册已归档时保持快照关联但禁止新增选择该归档卷册。

## S7 草稿、迁移与验证（R09 R10 R11）
普通编辑草稿驻内存，离开有未保存提醒。用户点击“登录并保存”后明确说明“将在此浏览器暂存草稿以完成登录”，经该动作同意将草稿存sessionStorage，key含随机draftId，不含正文URL；回到原标签恢复。魔法链接在新标签打开时显示“请回原标签继续保存”，原标签通过focus刷新getUser后恢复保存；不能假称跨标签自动恢复。已登录编辑可用按userId隔离sessionStorage短期恢复，退出清理。保存成功清草稿；页面刷新只恢复本人草稿，不写自动云保存。认证失败、超时不得清除。

先修现有middleware缺环境崩溃与callback跳转验证。askDao把真实本地81章作为上下文，不再用占位文本；fallback根据实际matchedChapter提供一致原文与对应可信预设解释，去掉非《道德经》句子冒充经典的现有fallback；不要更换模型供应商或重写全部AI策略。

验证环境：优先本机隔离Supabase（含Auth和Postgres），用两个测试账户走真实token/cookie；用服务角色种测试账户可以，鉴权测试不能用service role代替用户访问。若Docker/Supabase不可用，标BLOCKED并继续视觉和单元，不以mock当数据库验收。外部模型未配置仍应本地降级完成，个性化真实模型验证单独标记。不得将旧docs中的50项通过等数字沿用为新结果。

每次验收保存source commit、env、时间、命令、测试数据标签、截图/视频路径和结果。至少U01–U11，重点两用户越权读写关联、重复提交、409、断网保存、跨标签登录、回收恢复/永久删除、导出完整性、迁移旧favorites、问道暂存失败/保存失败/重试、长记录转问道、320/390/768/1440/1920宽度、减少动态与键盘。真实UAT待用户试用，技术验收不能代签。
