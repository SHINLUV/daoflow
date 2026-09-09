# DaoFlow V2 需求追踪

以下代码、测试、运行证据为计划目标；当前实施状态全部NOT_EXECUTED。完成后用真实绝对路径/测试名/commit替换目标，不能由文档存在推断PASS。

| 需求/UAT | 规格 | 任务 | 代码目标 | 自动检查目标 | 运行证据目标 | 状态 |
|---|---|---|---|---|---|---|
| R01/U01 | S1 S2 | T01 T02 T08 | app/page; NavBar; home/NowExperience | visual-motion.spec | 首屏两模式与导航截图 | NOT_EXECUTED |
| R02/U02 | S2 S3 | T02 T08 T09 | public/daoflow-v2; home/shared styles | 资产加载/尺寸/对比检查 | 5宽度截图+视觉评分 | NOT_EXECUTED |
| R03/U03 | S4 | T05 T08 T09 | motion/InkTransition MotionProvider PageTurn | visual-motion.spec | 六境/转场/键盘/reduce录屏 | NOT_EXECUTED |
| R04/U04 | S5 S6 S7 | T03 | entries路由/lib/003 | entries.integration.test | 保存刷新编辑回收恢复 | NOT_EXECUTED |
| R05/U05 | S5 S6 | T06 | volumes路由/lib/003 | volumes-export.integration.test | 归卷移出归档 | NOT_EXECUTED |
| R06/U06 | S5 S6 S7 | T07 | ask route/page/requests/005 | ask-persistence.integration.test | 记录转问道保存重试 | NOT_EXECUTED |
| R07/U07 | S5 S6 | T04 | chapters/favorites/004 | favorites.integration.test | 片段收藏批注刷新取消 | NOT_EXECUTED |
| R08/U08 | S1 S5 S6 | T06 T08 | journal/timeline/preferences | volumes-export.integration.test | 超20条搜索翻页回访 | NOT_EXECUTED |
| R09/U09 | S5 S6 S7 | T03 T04 T06 T07 T09 | RLS/RPC/auth/export/003–005 | 两用户直接DB+API+RPC越权测试 | 导出核对/误删恢复/永久删范围 | NOT_EXECUTED |
| R10/U10 | S4 S5 S6 S7 | T01 T03 T05 T07 T08 | middleware/callback/状态UI | auth-redirect/故障集成/E2E | 断网401/409/503/跨标签/缺配置 | NOT_EXECUTED |
| R11/U11 | S1 S7 | T01 T04 T07 | chapters/ask/ai | 原AI tests+reading-ask | 81章/降级/登录回归 | NOT_EXECUTED |

需求每行细分子场景在实际测试报告记录，不允许一个成功截图覆盖整行。实施后追加sourceCommit、环境、时间、reviewer、历史FAIL路径。计划完整性不等于产品实现PASS。
