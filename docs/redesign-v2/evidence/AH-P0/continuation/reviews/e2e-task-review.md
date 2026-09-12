# AH-P0 续跑：E2E 隔离构建与浏览器证据独立审查

审查日期：2026-09-13（Asia/Shanghai）
审查者：独立任务审查 Agent（未参与本任务开发；未修改产品代码或 Git）
审查范围：`next.config.mjs`、`playwright.config.ts`、`playwright.production.config.ts`、`tests/e2e/**`、`browser-e2e.md`。

## 独立复核的事实

- 静态配置复核：未设置 `DAOFLOW_E2E_DIST_DIR` 时，`next.config.mjs` 导出 `distDir=.next`；仅设置为受控精确值 `output/playwright/.next-e2e` 时才导出该隔离目录。因此默认生产构建配置不被 E2E 覆盖。
- 已读取原始 `output/playwright/continuation-full-run-r2.json`：`expected=11`、`skipped=5`、`unexpected=0`、`flaky=0`、`duration=53548.512ms`。递归读取每个 result 得到 11 个 `passed`、5 个 `skipped`，与日志最终 `PLAYWRIGHT_E2E_EXIT=0` 一致。
- `browser-e2e.md` 将 5 个 skip 明确标为 BLOCKED，未计入 11 项通过；对应测试的 `test.skip` 都要求真实的本地 Supabase/BFF/worker/已批准 RAG 夹具，没有改为 mock 或伪造成功。
- 独立运行（仅隔离 Next 开发目录）：`npx playwright test tests/e2e/reading-ask.spec.ts --grep '200% CSS' --workers=1`。结果：退出码 0，JSON `expected=1/skipped=0/unexpected=0/flaky=0`。运行前后仅 `output/playwright/.next-e2e` 时间戳变化，默认 `.next` 时间戳未变；3100 监听在退出后已释放。
- 该场景真实打开本地 Chromium `/ask`，输入中文、Enter 写换行、Tab 使提交按钮获得焦点、按钮进入视口。截图与断言文件存在。没有路由拦截、`route.fulfill` 或静态 HTML 替身。

## 发现

### Critical

无。

### Important

无。隔离 `distDir` 只由 Playwright `webServer` 注入，默认 `.next` 构建路径经静态和实际运行前后对照均未被改写。JSON、日志退出码和测试结果一致。

### Minor

1. `CSS zoom: 2` 是可观察的布局压力测试，但不改变媒体查询使用的 viewport，不能等价证明物理桌面浏览器 200% 缩放或移动系统 IME/软键盘行为。证据文档已准确将其保留为独立 UAT 门禁，不能据此关闭该门禁。

## Spec compliance

**PASS（限本审查范围）**。默认构建隔离、可审计退出码/JSON、skip 不计作 PASS、匿名失败闭合及问道输入的非 mock 浏览器断言均符合本轮 E2E 要求。真实认证、RLS、Agnes、获批语料、worker 与完整持久化闭环仍为明确 BLOCKED，而非通过。

## Code quality

**PASS WITH MINOR NOTE**。配置以精确受控值限制隔离目录，避免默认构建污染；单 worker 和 JSON reporter 提高现场归因。建议保留物理 200% 缩放、系统中文 IME 和软键盘作为单独 UAT 记录，不把 CSS zoom 升格为等价证据。
