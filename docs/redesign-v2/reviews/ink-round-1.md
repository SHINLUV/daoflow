# 新水墨转场独立验收 R1

验收人：独立子代理 ink_verifier，未参与实现。候选：5edb927baa6a1fdd373711310b4c2fa3c27a1818。日期：2026-09-09，Windows / Chromium headed，真实 Playwright CLI 命名会话 ink-v，本地 http://127.0.0.1:3200。依据冻结规格 S4。未改源码、Git 或服务。

结论：本次切屏基本功能 PASS；视觉建议改进后复看。不是整体 S4 性能、数据库、生产或业务 UAT 验收。

## 已实测

- 1440×900 和 390×844：首页→经典→第 8 章→首页，均正常，结束 idle，无永久遮挡。
- 桌面真实 Enter 激活「此刻」完成导航；手机前进/后退完成，MutationObserver 阶段记录为空，未重放墨染。
- 全局关闭动态后经典→8章正常，阶段数组为空；恢复开关再模拟系统 prefers-reduced-motion: reduce 后8章→首页正常，阶段数组为空。
- 正常一次完整阶段记录：covering 174849.6 → navigating 175250.9 → revealing 175259.9 → idle 175752.3 ms。视觉生命周期约903ms，接近880ms配置加调度开销。
- 快速向「读经典」「我的卷册」连续 dispatchEvent(button:0)，用于有意穿过遮罩触发并发输入测试：到经典，未跳去第二目标，结束 idle。当前策略拒绝忙碌期后续导航。不是两次真实物理鼠标点击证据。
- 受控请求挂起后约5011ms进入 error，overlay pointer-events:none，错误提示包含重试/留在当前页。「留在当前页」实点可关闭提示，并可继续进入经典。

## 视觉判断

独立查看实现者提供的真实录屏抽帧 output/playwright/ink-refine/detail.png：新覆盖边缘可见浓墨、灰绿半透明晕圈及不规则轮廓，内部多层山形可辨，区别旧纯圆缩放。显露使用另一位置向外打开窗口，机制有区别；但显露主视觉过急，15fps抽帧由小孔到几乎全屏只隔一帧，约480ms参数并未形成同长度的可见展开。建议缩小最大展开半径、重新分配缓动，使主显露过程持续更久。这是视觉质量改进意见，不单独判定功能FAIL。

本人截图 output/playwright/ink-v/mobile-ch8.png 是完成态；timeout.png 是故障释放态。desktop-cover.png、desktop-reveal.png、ch8-cover.png、ch8-reveal.png、real-cover.png、real-reveal.png 截图时机偏早或偏晚，未成功固定目标动画阶段，不能按文件名当作阶段证据；视觉动效判断明确依赖上述录屏抽帧，状态时长依赖本人真实浏览器 MutationObserver。

## 限制与边界

- 故障注入最初 route 回调使用 setTimeout 在 CLI 沙箱报 ReferenceError，导致测试请求保持挂起；这是人工测试工具引起的挂起，足以覆盖遮罩超时释放，绝非服务本身真实故障/恢复证据，也未把失败注入称作服务器稳定性验收。
- 未独立记录10次性能trace/Lighthouse、滚动位置恢复、所有修饰键/下载/外链或读经下一章局部动画；不沿用其他代理测试数字。
- 忙碌期虽然 aria-busy 为真，但目的地题签 aria-hidden，直到1.5秒慢提示才出现可朗读文字。建议为拒绝并发导航策略提供及时可读的状态公告，以更完整满足 S4「临时禁用并公告」。本次未用屏幕阅读器实测，不宣称辅助技术验收通过。
- 控制台存在请求失败，需按本地未登录接口与人工挂起分类，未归因为转场实现。

命令入口：npx --yes --package @playwright/cli playwright-cli -s=ink-v；使用 open/resize/snapshot/run-code/eval/screenshot。run-code用于系统媒体仿真、阶段观测、请求挂起及精确时序，未创建 Playwright 测试套件。
