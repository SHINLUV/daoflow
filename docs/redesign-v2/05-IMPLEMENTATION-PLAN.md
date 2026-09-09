# DaoFlow V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. 用户已选择多智能体，不再询问执行模式。

**Goal:** 交付可操作、可持久保存、具有完整古风美术和水墨交互的 DaoFlow V2 本地成品。
**Architecture:** 保留现有Next App Router与Supabase。总控管理共享壳层和有限RPC契约，各开发Agent按用户功能交付UI→API→DB→验证的垂直切片，独立Agent只验收。
**Tech Stack:** Next.js 14、React 18、Tailwind 3、Framer Motion、Supabase Auth/Postgres、Vitest；浏览器测试使用可用Playwright工具，项目自动测试可添加@playwright/test开发依赖。

## Global Constraints
本目录03规格S1–S7全部属于本计划约束。以01中的R01–R11/U01–U11作为覆盖基准；颜色、尺寸、文本、动效时长、字段、错误码直接照03，不让子Agent重新选。新API权威字段只能服务器/受限RPC产生。禁止边做边增加范围。
基线f3aa69376edd11b0895c8e58fe58274012fa9a1f。本轮交接文档会先保留在工作区，Terra T00审查后作文档checkpoint；下列路径均相对D:\DAOFLOW，派单时转成绝对路径。

## 并行和文件所有权
| Agent | 专属路径 | 共享路径规则 |
|---|---|---|
| 总控Terra | src/app/page.tsx、layout.tsx、globals.css、src/app/my-dao/page.tsx、src/components/NavBar.tsx、Footer.tsx；src/components/v2/shared/**；src/lib/journal/contracts.ts；src/middleware.ts；src/app/auth/callback/route.ts；package*.json；测试配置；tests/fixtures/**；docs/redesign-v2/**；.ai-development/** | 独占Git、依赖安装、迁移执行和集成；其他Agent提交文字请求 |
| A视觉交互 | src/components/v2/home/**；src/components/v2/motion/**；public/daoflow-v2/**；tests/e2e/visual-motion.spec.ts | 新CSS用同目录module.css，不改globals；资产manifest交总控落盘 |
| B记录卷册 | src/app/journal/**；src/app/api/journal/entries/**、volumes/**、timeline/**、preferences/**、export/**；src/components/v2/journal/**；src/lib/journal/entries.ts、volumes.ts、export.ts；supabase/migrations/003_journal.sql；tests/journal/**；tests/e2e/journal.spec.ts | 不改收藏/问道和共享contracts |
| C经典问道 | src/app/chapters/**；src/app/ask/page.tsx；src/app/api/ask/route.ts；src/app/api/journal/favorites/**、ask-requests/**；src/components/v2/reading/**；src/lib/journal/favorites.ts、ask-requests.ts；src/lib/ai/**；supabase/migrations/004_favorites.sql、005_ask_links.sql；tests/reading/**；tests/e2e/reading-ask.spec.ts | 和B通过冻结契约，不写B迁移；模型逻辑只修03指定问题 |
| 独立验收V | docs/redesign-v2/reviews/**、evidence/** | 无产品写权限、无Git集成权限；不兼任A/B/C |

所有代理共享工作区；并行期间禁止git commit/add/stash/reset/checkout，禁止删除别人的文件。结束波次时全部停写，由总控逐文件暂存/提交。若文件冲突，暂停冲突文件的任务，其他任务继续。不能以“开很多Agent”代替接口同步。

波次：T00总控 → T01总控 → 同时A:T02、B:T03、C:T04 → 同时A:T05、B:T06、C:T07 → T08总控整合 → T09新独立V → 缺陷定向返工→T09复验 → T10交付。RLS/收藏真实集成依赖003→004→005顺序，在迁移未集成前C可开发UI和单元，但不能声称DB通过。

## T00 交接、环境与契约冻结（总控；R10，T01前置）
文件：修改本目录状态/DECISIONS.md、必要.gitignore；新建tests/fixtures/README.md、supabase/config.toml（仅本地Supabase需要时）。
- [ ] 读取00–08及最新审查，核对文档hash、git status、HEAD。旧FAIL保留。发现当前HEAD变化，检查相关diff，不直接回退。
- [ ] `node --version`、`npm --version`、`git status --short`；`npm ci`后`npx vitest run`、`npm run build`、`npm run lint`记录继承结果，不虚报修复前全绿。若环境缺变量导致失败，归T01配置降级修复。
- [ ] 检查本地Docker/Supabase可用性；仅隔离本地init/start/reset，不能连接远程执行reset。记录测试项目URL、库名及虚构数据标签，不记录secret。检查环境变量仅输出是否存在。
- [ ] 新建docs/redesign-v2/DECISIONS.md记录旧规则替代、测试环境、分工；对新的交接文档做指定文件commit作为回滚锚点。无权限/环境问题写BLOCKED并指向受影响任务，继续可做部分。
退出：环境边界清楚、文档审查有效，next任务明确；不把检查旧代码当作V2验收。

## T01 可运行壳层与共享契约（总控；R01 R10 R11）
文件：共享清单；新增src/components/v2/shared/{PaperPanel,PrimaryButton,StatusMessage,AppShell}.tsx和shared.module.css；src/lib/journal/contracts.ts；tests/journal/auth-redirect.test.ts。my-dao保留登录，登录callback修next与错误处理。
接口：AppShell({children,active:'now'|'journal'|'reading'})；PaperPanel({children,className?})；PrimaryButton原生button props；StatusMessage({kind:'loading'|'success'|'error'|'empty',children})；contracts按03S6导出Entry/Mood/Page/CreateEntry/PatchEntry，另定义Volume/Favorite/TimelineItem以及ApiError供B/C消费。
- [ ] 写跳转验证纯函数safeNext(path:string|null):string，默认/journal，测试外部URL、//evil、反斜线、正常/journal路径。示例断言如下。
```ts
expect(safeNext('https://evil.example')).toBe('/journal');
expect(safeNext('//evil.example')).toBe('/journal');
expect(safeNext('/journal')).toBe('/journal');
```
- [ ] 修公共页缺配置容错、认证错误可恢复，建立tokens和三个导航。只保留一套共享壳层，首页接入留给T08但临时真实功能可运行。
- [ ] 将错误契约、类型与组件props交A/B/C；冻结共享文件。配置npx playwright test所需webServer为127.0.0.1独占端口、禁止prod baseURL；所有测试使用测试账户。
- [ ] `npx vitest run tests/journal/auth-redirect.test.ts`预期全通过；缺Supabase配置打开首页和本地经典不500；私密API503；callback错误不误称登录成功。`npm run build`通过后提交。
回滚：还原此slice指定文件的反向补丁/回退提交，不删除用户文件。

## T02 AI美术与首屏交互成型（A；R01 R02，依赖T01）
文件：home/{NowExperience,EntryModeSwitcher,SixRealms,DailyReading}.tsx、home.module.css，全部A01–A13资产；测试visual-motion的首屏部分。
接口：NowExperience({onSaveDraft:(draft:CreateEntry)=>Promise<void>,onAsk:(question:string)=>void,saveState,authState})；SixRealms({onChooseQuestion:(question:string)=>void})；回访条由总控注入真实Volume|null。
- [ ] 按03S3生成锚图并检查构图，生成手机/六境变体，不复用同一幅图伪装六主题。实际查看每张图并记录prompt和hash。
- [ ] 实现03S2尺寸，图片无字，模式切换各保留草稿。登录未知/未登录状态明确；保存回调成功后才显示成功。
- [ ] 六境点击展开、建议预填、覆盖已有内容提示。写首屏浏览器断言：390宽下编辑器主按钮boundingBox底部≤844（底部导航安全区另留空间），页面scrollWidth≤innerWidth，所有主图naturalWidth>0。
- [ ] 截1440×900和390×844实际页面，检查标题断行与纸面清晰；提交文件交总控，先不争用Git。可用回调夹具验证外观但证据标UI fixture。
退出：资产齐全+真实组件，无假数据保存宣称。资产工具不可用则该项BLOCKED，不能用已有照片算通过。

## T03 心笺持久化垂直闭环（B；R04 R09 R10，依赖T01）
文件：003迁移、entries API/lib、journal/entries/[id]、JournalEditor组件、tests/journal/entries.integration.test.ts、journal.spec.ts。
消费CreateEntry/PatchEntry；POST返回{entry:Entry}，PATCH返回{entry:Entry}；列表Page<Entry>。
- [ ] 建003中的volumes/entries/preferences基础与RLS/RPC，先落实记录保存/读取/编辑/软删/恢复/永久删所需事务；volume界面在T06。数据库禁止直接写，所有owner/CAS状态由RPC保证。
- [ ] 两真实认证用户夹具，测试A的记录B读404、B不能调用RPC关联A、A过期version409、同id同payload创建重试返回同条、不同payload409。
```ts
// 测试夹具httpA/httpB分别使用本地真实登录cookie，禁止mock或service-role业务请求。
const created = await httpA.post('/api/journal/entries', {id: fixtureId,body:'今天和同事聊了工作安排'});
expect(created.status).toBe(201);
expect((await httpB.get(`/api/journal/entries/${fixtureId}`)).status).toBe(404);
expect((await httpA.patch(`/api/journal/entries/${fixtureId}`,{version:0,body:'冲突'})).status).toBe(409);
```
- [ ] 实现API字段校验和编辑UI、401/409/503提示、未保存确认、草稿会话隔离；登录回原标签恢复。
- [ ] 浏览器保存→刷新→编辑→回收→恢复→永久删除，核验数据库和UI一致；断网不清输入；退出清理草稿。永久删除询问明确目标。
- [ ] `npx vitest run tests/journal/entries.integration.test.ts`和`npx playwright test tests/e2e/journal.spec.ts`，环境不具备记BLOCKED。写迁移演练和证据后交总控提交。

## T04 经典目录、收藏和批注（C；R07 R11，依赖T01，DB验证等003）
文件：chapters目录/详情、favorites API/lib、004迁移、reading组件、tests/reading/favorites.integration.test.ts、reading-ask.spec.ts阅读部分。
接口Favorite={id,chapterId,excerpt,note,version,createdAt,updatedAt}，GET Page<Favorite>；整章和片段统一收藏；POST重复同内容返回原项，不覆盖已有note。
- [ ] 读真实chapters.json和旧favorites表，004将旧整章收藏幂等迁移到新表，旧数据不删除。确保UUID默认、unique、原文验证、RLS与受限RPC。
- [ ] 经典目录1–81，点击直接进入对应章；详情保留原文/译文切换、复制、上下章；加入整章收藏、选中片段收藏、修改note、取消收藏。
- [ ] 测试非法chapter/非原文excerpt400、重复收藏不重复、跨用户404、编辑version409、旧收藏迁移后可见。
- [ ] 运行对应integration与浏览器测试；截图桌面手机阅读，不让背景纹理降低正文对比。外部库缺失不影响原本地阅读。

## T05 水墨与六境动态（A；R03，依赖T02）
文件：motion/{InkTransition,MotionProvider,PageTurn}.tsx、motion.module.css；visual-motion.spec.ts。消费共享导航接口，由总控接AppShell。
接口useDaoNavigation().navigate(href:string)；MotionProvider({children})；PageTurn({chapterId,children})。状态与时长按03S4。
- [ ] 实现覆盖/导航/揭示状态、异常看门狗、减少动态、卸载清理；修饰键原生，后退不重复墨染。
- [ ] 实现六境mask过渡、纸页翻章和保存落印组件（由B传真实success）。动画可关闭；输入focus暂停视差。
- [ ] 浏览器连续点击10次、快速返回、故意导航错误、网络慢、键盘、reduce motion，验证无遮罩残留和重复提交。录制实际关键路径，不能用宣传视频代替。
- [ ] 性能记录按03S4；不足就减少层数而非删掉核心换境。交总控接入后再跑集成动作。

## T06 一事一卷、列表搜索、导出（B；R05 R08 R09，依赖T03，timeline ask类型等T07）
文件：B剩余专属路由/组件/lib，新增supabase/migrations/006_journal_queries.sql归B专属；T03已应用003以后绝不能重写003，所有补充在006，测试总控按003→004→005→006应用；tests/journal/volumes-export.integration.test.ts。
- [ ] 卷册新建、rename、archive/restore、归入/移出条目，RPC检查owner、version、归档状态。列表分页20、created_at+id稳定，搜索仅本人。真实lastVolumeId回访条，不随机假数据。
- [ ] timeline同时支持entry|ask，T07未到时ask读取旧会话只读；整合005字段后验证关联。归档卷可读和移出，禁止新增归入。
- [ ] export单快照、本人数据完整、from/to规则、超限413；浏览器下载JSON后解析核对记录、回收、收藏、历史与来源关联数量。
- [ ] 分范围导出：entries/favorites/askSessions按created_at含起不含止过滤；所有引用到的volumes和source entries即使在范围外也作为关联补齐包含，并标记includedAsReference=true；preferences全量本人单行。卷册本身范围内created_at的条目也纳入。导出头记录filter范围，跨分片以type+id去重；本版为当前快照导出而非增量同步，不承诺恢复已永久删除内容。测试范围外来源仍可解释、同一记录跨片去重、无范围所有本人数据完整。
- [ ] 两用户各>25条、相同时间戳、归档卷、回收条目夹具；验证翻页无重复遗漏和导出不含对方。`npx vitest run tests/journal/volumes-export.integration.test.ts`，相关journal E2E。
- [ ] 交总控集成收藏tab（C数据接口）与全部问道，记录真实端到端证据。

## T07 记录转问道与可靠关联（C；R06 R09 R10 R11，依赖T03）
文件：005迁移、ask接口/页面、ask-requests lib/API、askDao、tests/reading/ask-persistence.integration.test.ts、reading-ask.spec.ts。
- [ ] 按03S6建受限服务写函数和请求状态/claim token/generation，server-only模块隔离service role，验证权限后才调用模型；旧ask body兼容。
- [ ] 记录转问道用entryId读取，>500字明确编辑，输入不在URL；先回应再原文；saved/failed/not_requested状态真实。保存重试只读服务端generated结果，不重新调用模型。
- [ ] 修真实经典上下文注入和fallback出处，保留provider降级标记，不擅自变供应商。
- [ ] 数据库并发测试：同request仅一个历史；旧token完成写0行；generated重试保存不调模型；他人source或volume在模型调用前被拒绝；匿名不云保存；结果暂存失败可复制但不报已保存。
- [ ] 用真实authenticated token直连Supabase REST尝试INSERT/UPDATE/DELETE私人表和ask_sessions应拒绝；执行服务专用RPC应拒绝。数据库测试将原lease设为过期再接管，原token迟到写入0行，当前token最终仅一条历史；此为可控租约夹具，报告标明非真实等待60秒。
- [ ] `npx vitest run src/lib/ai/__tests__ tests/reading/ask-persistence.integration.test.ts`；本地真实Auth/DB+可控模型夹具只验证保存边界，真实模型调用另列，不混写。浏览器记录→编辑问题→回应→卷内找回→刷新。

## T08 总控集成与工程检查（总控；全部R，依赖T02–T07）
文件：共享入口、所有者交接的必要集成、06追踪、evidence。
- [ ] 合并A首页回调到B保存和C问道；整合MotionProvider、导航、footer、收藏tab、lastVolume；确保所有页面同一tokens。
- [ ] 全部Agent停写，审查diff和秘钥引用；指定文件分slice提交，记录每slice hash。生产构建启动独占127.0.0.1端口，README写清启动命令、缺配置行为。
- [ ] `npm run lint`、`npx vitest run`、`npm run build`、`npx playwright test`。如果集成测试需要显式环境，提供npm script和执行说明，不能让环境缺失静默跳过后称全绿。
- [ ] 按07全部关键路径运行，320/390/768/1440/1920截图与录屏；manifest逐个文件hash核对；UI无“内部验收/待接入/Mock”等开发占位。
- [ ] 生产预览执行3次同配置Lighthouse手机测量，保存原始结果与中位数性能≥85、CLS≤0.1判定；录制10次切换性能trace并核对非网络长任务≤200ms。阈值失败应优化并重测，不能用视觉评分覆盖。
- [ ] 每R绑定code+test+runtime+commit，形成候选commit并冻结；仅工程自检PASS可派T09，不把自检称独立验收。

## T09 独立验收与返工（新V，依赖T08）
- [ ] 新上下文读取07，自行验证候选干净与hash；执行U01–U11，功能逐R判定、视觉五维评分与证据。
- [ ] V只写reviews/round-N.md与evidence，给PASS/FAIL/BLOCKED。FAIL列具体负责人、文件/组件、期望/实际、复验步骤。
- [ ] 总控按缺陷分给A/B/C；修复新commit、重跑影响验证、新独立轮次。原FAIL不改名不覆盖；不能为得分删需求。
退出：技术独立PASS，或所有可做内容完成但外部链路明确BLOCKED；后者不得称完整验收完成。

## T10 可见成品交付（总控）
- [ ] 打开可访问本地成品，给桌面/手机截图与动效录屏链接；路径必须绝对。
- [ ] 交付运行说明、各slice commit、最新验收、旧FAIL与返工复盘、资产清单、未完成/外部阻断。源代码清楚可恢复。
- [ ] 用户实际体验后再记录UAT，未发生写BUSINESS_UAT_PENDING。不得主动生产部署或远端迁移。

## 证据结构
`docs/redesign-v2/evidence/<slice>/<sourceCommit>/`放命令摘要、浏览器截图/录屏、数据标签与timestamp；大量临时日志/依赖不入Git。测试全部使用虚构日记，导出实测文件脱敏后记录。每slice更新状态：任务、依赖、owner、commit、验证、阻断、下一步。挂起后先核对HEAD和状态继续，不能从头重建或把未完成写成PASS。
