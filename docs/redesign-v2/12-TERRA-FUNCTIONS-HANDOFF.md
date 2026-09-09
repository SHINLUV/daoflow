# Terra 功能补全与真实测试交接

2026-09-10，用户要求暂停当前开发，改交Terra。工作目录D:\DAOFLOW。本文是功能交接，不是验收通过声明。

## 冻结快照

- Git HEAD：c23e4ae（文档提交）；上一个已验收切屏产品提交f114fc9。必须重新读取git status/diff，不能覆盖WIP。
- `.env.local`已保存用户提供的Agnes密钥且git check-ignore确认忽略；禁止打印、复制进报告/前端/Git或长期记忆。不要再使用技能文档中的旧示例密钥。
- 真实网站POST /api/ask已验证一次新密钥：provider=agnes、degraded=false、matchedChapter=22、约8858ms；persistence=not_requested。这是匿名模型路径证明，不是登录保存闭环证明。
- Docker Desktop Linux daemon已启动，但本项目首次镜像拉取未完成。按用户交接要求停止了已核对的supabase start CLI进程36624；没有删除镜像/卷、没有停Docker daemon或操作其他项目容器。DAOFLOW Supabase容器尚未启动。不要把配置端口当可用服务。
- Docker启动时其他项目容器依原restart policy自动恢复；严禁操作这些无关ERP/quotation容器。
- 本地3200预览是否仍运行须重新检查；曾启用的是未注入Supabase的旧构建。配置NEXT_PUBLIC变量后必须重新构建，不要拿旧构建验证登录。

## 未提交工作

- `src/components/v2/journal/JournalEditor.tsx`：正在补稳定创建UUID、未保存导航确认、登录前草稿恢复、冲突加载、记录转问道对话框；尚未build/浏览器验证，须逐项审查。
- `supabase/config.toml`：本地Auth改3200，保留3100回调，禁用缺失seed.sql自动执行；实际容器尚未核验。
- `supabase/migrations/005_ask_links.sql`：补journal_entries(user_id,id)唯一约束以支持同用户复合FK；静态缺陷已证实，尚未真实迁移。若发现任何目标已执行过旧迁移，不得无脑覆盖历史，改用增量兼容迁移。
- `scripts/local-session.ps1`：读取忽略.env.local，解析本地Supabase状态并注入进程环境，支持Build/Start/Command；仅WithoutDatabase Start实际用过，数据库分支待测。
- `scripts/verify-local-functions.mjs`：已node --check；真实业务断言未跑。默认不调用模型，`--ask`才跑真实Agnes保存/并发幂等；不得把默认PARTIAL算全通过。
- `docs/redesign-v2/evidence/FUNCTIONS/`：API准备说明、环境说明，不是PASS证据。
- 目录补全代理已被要求停写；交接时重新git status确认JournalLibrary/VolumeDetail/journal.module.css是否有新增WIP，不以本清单替代实时检查。

## 可直接给Terra的任务

你担任总控，在D:\DAOFLOW接续DaoFlow V2。现阶段前端方向已确定，本轮目标是补齐功能、接通真实依赖并完成独立测试，不重做界面，不停留于规划，不执行生产部署或远程迁移。

首先完整阅读本交接、00-HANDOFF.md、01-PRD.md、03-DESIGN-AND-TECH-SPEC.md、05-IMPLEMENTATION-PLAN.md、06-TRACEABILITY.md、07-INDEPENDENT-ACCEPTANCE.md、08-TERRA-MASTER-PROMPT.md、最新独立报告及.ai-development/state.yaml。以实时Git与代码核实历史结论：视觉PASS不代表功能PASS，旧BLOCKED/FAIL必须保留。

T00先核对HEAD、脏工作区、本地服务、镜像/卷、环境变量存在性与迁移历史；禁止输出密钥。继承未提交代码先审查再验证，不reset、不覆盖、不把未测代码标完成。形成需求→UI→API→DB→测试→运行证据矩阵及任务卡。

模型仅使用用户配置的Agnes key，从服务端AGNES_API_KEY读取；现有base URL为https://apihub.agnes-ai.com/v1，模型agnes-2.0-flash。需实际核验模型可用性与结构输出，保留真实超时/格式/限流处理。静态关键词降级必须明确标识，不能冒充AI成功。不要将私人真实内容用于联调，使用虚构数据。

建立隔离本地Supabase，核验001–006迁移与seed，81章/6主题等基础内容完整。只使用项目自己的容器/卷，不操作其他项目；首次拉镜像可续传。无授权不得重置已有库、删卷、迁移远程。Auth redirect对应本地实际端口；NEXT_PUBLIC配置变更后重新build。魔法链接用本地测试邮箱完成真实登录，不加开发免登录后门。

并行分工：A负责Auth、数据库/权限验证需求与API；B负责心笺、卷册、搜索、回收站、导出UI及数据闭环；C负责Agnes、收藏批注、记录转问道、保存与重试。总控管理共享文件/接口/依赖/迁移/Git，每个文件唯一负责人，共享文件变更经总控整合。完成后另起全新、未参与开发的独立验收者，不能让开发者自行宣布独立通过。

按完整用户流程补齐：
1. 登录/退出、刷新后会话、失败提示、登录前草稿、跨标签返回与账户切换清理；无密码UI不得靠密码API测试代替真实魔法链接浏览器验收。
2. 心笺新建/编辑/心情/归卷、刷新持久化、重复保存幂等、双端409冲突处理、失败保留原文、离开提醒；回收站入口/恢复/二次确认永久删除，删除只针对虚构验收数据。
3. 卷册创建/改名/归档/恢复、移入/移出、数量准确、心笺与问道混合时间线及稳定分页；归档禁止新增关联但允许读取/移出。
4. 经典目录81章、原文/白话、整章和连续片段收藏、去重、批注编辑、取消收藏与刷新持久化。
5. 真实搜索记录/问道、分页、清空、空结果和失败区分；日期范围JSON导出，核对内容完整性、账户边界及大导出错误。接口存在但没有UI入口视为未完成。
6. 普通AI提问及记录转问道：先让用户确认问题再发送，超过500字的记录由用户提炼，不静默截断、不把正文放URL；来源和卷册关联准确，禁止回收记录转问道。
7. 登录提问真实Agnes生成→服务端暂存→保存历史→卷内时间线→刷新可见。requestId复用与并发/202查询、不同payload冲突、生成成功但保存失败、仅重试保存不重复调模型，前端必须提供可操作入口。当前AskPage存在每次提交新UUID、202后仅提示、重试保存入口缺失等待核实缺口。
8. 安全：真实两用户JWT验证读/写/关联/搜索/导出隔离；禁止anon写基础内容，service_role不进入浏览器，SECURITY DEFINER固定search_path且校验权限。不能用管理员请求代替用户权限证明。

测试顺序：快速unit/lint/build→真实依赖/API/DB→真实浏览器桌面和手机→新独立验收。已有skip/空测试和mock只能说明未验证，必须补成真实断言或明确BLOCKED，严禁删断言、跳过失败用例来换绿色结果。浏览器必须覆盖注册/魔法链接登录、完整保存链、异常回退、刷新、搜索导出、两账户、键盘、320/390/768/1440/1920响应式。模型fixture仅用于可控异常，单独标识，正常路径必须真实Agnes。

每个完整功能切片验证后单独提交，显式stage自己的文件，禁止git add -A混入密钥/WIP。独立验收绑定干净产品提交，报告注明身份、真实操作、数据、时间、sourceCommit、证据和未测边界。发现FAIL交回负责人修复，新提交后复验，保留每轮原FAIL与复盘；不能用视觉分数抵消功能缺陷。

持续推进到本地完整可操作及独立技术验收完成。缺外部条件先完成不依赖它的工作；只在确需用户选择/凭证/新增授权时提问，准确说明阻断。最终交付运行地址、启动方法、本地测试邮箱说明、逐项功能矩阵、测试命令和真实结果、桌面/手机截图、关键闭环录屏、Git提交、独立报告及返工记录。真实用户UAT仍需用户本人，不代签商业/生产可用；不部署生产或执行远程生产迁移。
