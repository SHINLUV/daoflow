# 新水墨转场独立针对性复验 R2

候选 f114fc9caa02105b057ad3f435393f7704b22439；2026-09-09；独立 ink_verifier 未参与实现；Windows Chromium headed / Playwright CLI ink-v / http://127.0.0.1:3200。已 reload 重启后的新服务，核验本地 HEAD。R1 原文保留。

结论：本次两项修正及桌面/手机转场冒烟 PASS。

1. 及时公告：本人真实浏览器 MutationObserver 在 covering 开始即读到 role=status 文本「正在前往此刻，请稍候再选择其他页面。」，其 closest('[aria-busy=true]') 为 false；navigating 保留文字，revealing 与 idle 清空。满足此前建议的即时 DOM 公告位置；没有宣称实测屏幕阅读器播报。
2. 显露节奏：独立检查新录屏抽帧 output/playwright/ink-refine/final-detail.png（实现者提供，12fps），第三行可清晰区分全墨→小孔→中幅→大幅→边角残墨，随后完整经典页。相较 R1 小孔后几乎立即全开的观感，展开过程已有多个清晰阶段；轮廓晕圈与新页面逐渐显露更容易辨认，改进成立。此项证据来源为提供的真实录屏抽帧，不冒称本人录制或逐帧完整视频播放。
3. 桌面1440×900经典→首页结束 idle。本人阶段实测 covering 25400.4 → navigating 25809.6 → revealing 25867.6 → idle 26353.1 ms（揭示阶段约485.5ms，整体约952.7ms，包括本地导航/调度开销；不能称精确880ms或严格≤900ms）。
4. 手机390×844首页→经典→第8章→首页正常，末态 pathname=/、phase=idle、status文字为空，没有残留遮挡。完成态截图 output/playwright/ink-v/r2-mobile-home.png。

本轮未重复R1故障/开关/reduce全套，不扩大成完整S4、性能、生产或业务验收。源码审阅确认显露使用窗口覆盖距离及smoothstep分配进度；图像质感仍属程序轮廓/晕圈与山形，未声称真实流体模拟或摄影级墨迹。
