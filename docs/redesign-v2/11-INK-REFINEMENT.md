# 切屏水墨精修

用户反馈：现有切屏太单调。日期：2026-09-09。本轮只修改共享转场，不改页面业务或生产部署。

## 动效改动

| Before | After |
| --- | --- |
| 纯色circle扩大/原路缩回 | InkTransition以三层浓淡墨不规则轮廓覆盖，另一处打开窗口显露新页 |
| 纯色满屏 | 墨内青绿山线、细颗粒、随目的页变化的题签和小印 |
| 340ms覆盖+420ms倒放 | 400ms润墨覆盖+480ms破墨显露，正常路由视觉目标880ms，不人为等待加载 |
| 程序跳转复用上次点击位置 | 无指针/键盘跳转从中央开始；有指针则跟随触发区域，靠边位置作安全收敛 |
| 忙碌时可改写目标；错误层全屏吃点击 | 先检查忙碌态再写目标；错误提示以外区域放行，重试直接请求原目标 |
| 忙碌公告仅在慢加载时出现 | covering立即给出role=status文字，位于aria-busy外，显露时清空 |

技能make-interfaces-feel-better影响：将单块动画分层、入退采用不同节奏、一次性转场才用阶段序列，不添加全局transition:all或额外动画依赖。Canvas限制最大1440px宽、无需逐像素噪声、卸载取消rAF；没有使用WebGL或下载第三方动画。

## 工程与证据

候选`5edb927`。构建含lint/类型检查通过；unit38通过/14跳过；生产E2E6通过/3跳过。真实外部认证/私密服务跳过不计通过。

桌面与手机实际录屏：`output/playwright/ink-refine/desktop.webm`、`mobile.webm`。桌面抽帧`contact.png`与`detail.png`为ffmpeg从真实录屏提取，不是模拟画面。页面截图期间加载到旧生产资源曾出现400，重启新构建并刷新后解决；第8章收藏接口503为既有缺数据库配置边界，不伪造成功。

独立新验收者ink_verifier负责真实浏览器及边界复验，结论另见reviews/ink-round-1.md；本文件的工程结果不替代独立判定。旧验收FAIL/返工记录、外部服务BLOCKED、BUSINESS_UAT_PENDING均保持。

## 显露节奏复盘

独立检查指出第一版显露偏急：覆盖与显露共用1.32倍屏幕对角线半径及ease-out，导致显露早期已打开大部分画面。采纳意见：显露单独计算起点到最远屏角的距离并留轮廓覆盖余量，改为smoothstep加减速，480ms内先轻开、再铺开、最后收边。不是单纯加长等待。新候选及复验见后续报告。

最终产品候选`f114fc9`，构建含lint/类型检查再次通过；生产E2E再次6通过/3跳过（11.3秒，output/ink-regression-final）。另补即时role=status公告，置于aria-busy容器外，避免消息被忙碌状态延迟。未以DOM检查冒充真实屏幕阅读器验收。

最终录屏为`output/playwright/ink-refine/desktop-final.webm`与`mobile-final.webm`；`final-detail.png`以12fps抽帧可见小孔、半幅、大幅及边角收束，保留旧录屏供对照。独立针对性复验见`reviews/ink-round-2.md`。
