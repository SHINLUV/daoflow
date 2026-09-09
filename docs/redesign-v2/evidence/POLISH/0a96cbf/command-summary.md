# 视觉精修工程证据与返工记录

日期：2026-09-09。仅本地生产预览 http://127.0.0.1:3200；未生产部署或远程迁移。

## 提交

- `2692452`：六境交互画廊，桌面六画单行、手机横滑与前后按钮、键盘切换。
- `888565b`：首页纸笺与题字、轻视差、经典对开、视口进入、移动导航和动态开关。
- `0a96cbf4ce98c2116ab8812495ce93f0a21bb0fa`：PV-01重复建议取消后不响应修复；同时保留独立首轮FAIL报告。

## 工程检查

- `npm test`：修复后重新执行，7文件通过，38通过、14跳过（外部条件相关）；跳过不计通过。
- `npm run build`：修复后重新执行成功，含lint与TypeScript检查；首页First Load JS 179 kB。
- `npm run lint`：视觉集成阶段独立执行通过；最终构建亦通过lint。
- `npm run test:e2e:production -- --workers=1 --output=output/polish-regression-rework`：修复后6通过、3跳过，9.1秒。3项真实认证/持久化用例保持跳过，不计通过。
- 三次移动Lighthouse在`888565b`执行，86/86/86分，CLS均为0。原始报告：`output/playwright/polish-performance/mobile-{1,2,3}.json`。没有把它冒充后续修复提交的新性能运行。

## 实际浏览器证据

- 独立桌面截图：`output/playwright/polish-v/home-1440.png`。
- 独立手机截图：`output/playwright/polish-v/home-390.png`。
- 六境与经典截图：同目录`realms-1440.png`、`realms-390.png`、`classic-1440.png`、`chapter8-390.png`。
- 实际浏览器动效录屏：`output/playwright/polish-tour.webm`。内容为首页、画廊展开/键盘切换、建议输入、转问道；不是模型真实回答或已保存私密记录的证明。
- 独立验收首轮：`docs/redesign-v2/reviews/polish-round-1.md`，FAIL，PV-01可复现，禁止覆盖。

## PV-01复盘

建议原先只用字符串作为React状态。同一字符串再次选择没有状态变化，编辑器effect不重新运行；Escape或保留原文后再次选择同一建议因此失效。修复为文本加单调递增revision，每次用户选择都产生新事件，保持原始文本与模式草稿分离，不用清空编辑器或重新挂载规避问题。独立复验要求两种取消方式各重复三次，再确认替换及记录草稿隔离。

## 未验证边界

真实Supabase/Auth/RLS/RPC/双账户持久化及真实模型调用仍受既有外部条件阻断，本轮不声称通过。BUSINESS_UAT_PENDING。此文不替代独立验收结论。
