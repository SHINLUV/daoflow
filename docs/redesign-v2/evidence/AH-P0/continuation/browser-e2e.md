# AH-P0 续跑：浏览器 E2E、响应式与动效证据

日期：2026-09-13（Asia/Shanghai）。基线提交：`301139dc672b649a1097dfb698d991eb688813a8`。本记录只说明本地 Chromium 浏览器实际执行结果，不将跳过用例、开发服务器 HTTP 200、构建成功、管理员请求或静态降级写成产品功能通过。

## R3 Playwright 退出码缺口与修复

R3 记录“默认 Playwright 曾启动但没有捕获最终退出码”，因此不接受为 E2E 证据。本轮先复现默认套件；初始 `journal` 用例错误地预期未登录保存会进入 `SUPABASE_UNAVAILABLE`，实际页面在任何私密写入之前即以“请先登录后保存”失败闭合并保留正文。该失败不是服务成功，初次运行也因默认 `next dev` 写共享 `.next` 而不能作为 standalone 候选证据。

修复后的编排：

- `playwright.config.ts` 和生产配置同时使用 `line + json` reporter，JSON 写入可审计文件；默认 `workers: 1`，使涉及将来真实夹具的数据写入保持可归因。
- 默认 `webServer` 传入 `DAOFLOW_E2E_DIST_DIR=output/playwright/.next-e2e`。总控在 `next.config.mjs` 只在该受控变量存在时改用该目录；默认运行仍是 `.next`。完整复验确认隔离目录实际生成，结束后 3100 监听已释放。
- 命令通过 `cmd.exe` 保存 `$ERRORLEVEL` 到日志尾部，而不是依据终端中途输出判断成功。JSON 的 `stats` 与该退出码相互印证。
- 匿名心笺用例改为验证真实的未登录失败闭合和草稿保留，移除了会因是否配置数据库而产生错误语义的 skip；没有替换为 mock。

## 已执行命令与结果

```powershell
$env:DAOFLOW_E2E_JSON_REPORT='output/playwright/continuation-full-run-r2.json'
cmd.exe /d /v:on /c "npx.cmd playwright test --workers=1 > output\playwright\continuation-full-run-r2.log 2>&1 & set code=!errorlevel! & echo PLAYWRIGHT_E2E_EXIT=!code!>> output\playwright\continuation-full-run-r2.log & exit /b !code!"
```

- Playwright JSON：`expected=11`、`skipped=5`、`unexpected=0`、`flaky=0`、`duration=53548.512ms`。
- 日志最终行：`PLAYWRIGHT_E2E_EXIT=0`。
- 实际执行：**11 passed**；明确阻塞：**5 skipped**；失败：**0**。
- JSON：`D:\DAOFLOW\output\playwright\continuation-full-run-r2.json`
- 日志：`D:\DAOFLOW\output\playwright\continuation-full-run-r2.log`
- 隔离 Next 开发产物：`D:\DAOFLOW\output\playwright\.next-e2e\`。

## 已执行的真实浏览器断言

- 未登录心笺填写后，页面在私密写入前提示登录、正文仍在输入框中；没有伪造保存成功。
- 匿名收藏状态、匿名问道的草稿保留和可信代理缺失时的失败闭合。
- `/ask` 在 320、390、768、1440、1920 宽度下输入框与按钮可达、无横向溢出，并实际测量移动端最小高度 `>=160px`、桌面 `>=180px`。
- 390×844 截图：`D:\DAOFLOW\output\playwright\test-results\reading-ask-ask-input-is-l-44447-usable-on-a-narrow-viewport\ask-input-390x844.png`。
- 390×844 下以 CSS `zoom: 2` 实施的可观察 200% 布局压力测试：实际输入中文、Enter 写入换行而未提交、Tab 到提交按钮、按钮滚入可视区。截图：`D:\DAOFLOW\output\playwright\test-results\reading-ask-ask-stays-keyb-bd8ad-inese-text-at-200-CSS-scale\ask-input-200-percent-css-zoom.png`。
- `prefers-reduced-motion: reduce` 与 390×390 低高度视口：输入与按钮均可继续到达。截图：`D:\DAOFLOW\output\playwright\test-results\reading-ask-ask-remains-re-cf3c7-a-constrained-mobile-height\ask-input-390x390-reduced-motion.png`。
- 水墨导航 watchdog、修饰键原生链接、移动主页无横向溢出、六境在 reduced-motion 下仍可交互，均由 `visual-motion.spec.ts` 实际运行。

录屏（均为本地虚构输入，不含账号、Cookie、JWT 或私人正文）：

- `D:\DAOFLOW\output\playwright\test-results\reading-ask-ask-stays-keyb-bd8ad-inese-text-at-200-CSS-scale\video.webm`
- `D:\DAOFLOW\output\playwright\test-results\reading-ask-ask-remains-re-cf3c7-a-constrained-mobile-height\video.webm`
- `D:\DAOFLOW\output\playwright\test-results\visual-motion-DaoFlow-V2-v-02b8d-e-and-reduced-motion-usable\video.webm`

## 明确未通过或未验证的门禁

以下 5 项为环境前置条件缺失导致的 **BLOCKED/skip**，不计入 11 项通过：

1. 合成账户的心笺新建、刷新、编辑、回收、恢复和永久删除：缺少隔离本地 Supabase 认证夹具与 storage state。
2. 合成账户阅读/收藏闭环：缺少真实本地 BFF 会话和 storage state。
3. 三项问道持久化闭环（保存、心笺交接、仅重试保存）：缺少真实本地 BFF 会话、已部署 worker、已批准且可控的 Agnes/RAG 夹具，以及当前账户所属的合成记录。

本轮桌面 Chromium 可以真实验证中文文本输入、普通 Enter 换行、键盘焦点和 `prefers-reduced-motion`。它**不能**等同于物理设备的系统中文 IME 组合态，也不能调用真实移动软键盘；Playwright 也没有可审计的桌面浏览器缩放控制，所以 200% 用 CSS zoom 作为布局压力测试，物理浏览器 200% 缩放仍需独立 UAT。真实邮箱/OTP/MFA、双账户 JWT/RLS、真实 Agnes、可信已批准语料、持久 worker 重启与业务 UAT 仍由对应运行门禁控制。
