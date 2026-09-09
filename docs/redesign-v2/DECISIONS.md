# DaoFlow V2 · 实施决策与环境账本

## D-001：V2 设计取代旧视觉约束

日期：2026-09-09。依据已通过的 `01-PRD.md`、`03-DESIGN-AND-TECH-SPEC.md` 与用户确认，本轮 V2 采用宋式青绿山水、纸色 `#F1EBDD`、朱砂 `#A34536`、AI 册页美术、记录与问道并列、回答优先于原文的阅读顺序。根目录旧 `CLAUDE.md` 仅保留为历史背景，不能覆盖此决策。

## D-002：T00 环境与验证边界

日期：2026-09-09。交接基线为 `f3aa69376edd11b0895c8e58fe58274012fa9a1f`；交接包哈希与 `02`、`04-R2`、`09` 中锁定的有效哈希一致，旧 `04-SPEC-REVIEW.md` FAIL 原样保留。

- Node `v24.14.0`、npm `11.9.0`、Docker `29.5.3` 可用；本机未发现 Supabase CLI。
- 不输出密钥值。`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 与 `OPENAI_API_KEY` 在当前进程均未配置。
- `npm ci` 初次未完整落盘，第二次前台安装成功。继承基线的 Vitest 为 2 个文件、19 项通过；lint 通过；生产构建因旧 `/my-dao` 在缺失 Supabase 公共配置时创建客户端而失败。该失败由 T01 修复，不能标为 V2 已验证。
- Docker 存在不等于本地 Supabase/Auth 测试环境已启动。所有真实认证、RLS、RPC 与迁移闭环在建立隔离环境前均为 `NOT_EXECUTED`，不得以 mock 代替。

## D-003：并行协作与 Git

日期：2026-09-09。A/B/C 可按 `05-IMPLEMENTATION-PLAN.md` 并行，只写各自专属路径；总控独占共享文件、依赖、迁移顺序、Git 暂存与提交。开发 Agent 禁止操作 Git 索引。所有持久化功能都必须以受限 RPC 与真实 Auth/RLS 为前提；配置缺失时保留本地经典与首页，并把私密操作明确标为不可用。

## D-004：T08 工程验证与性能返工

日期：2026-09-09。候选提交为 `6315e69e3944bc1157bf7eb4e8c718acc516d89b`。生产启动地址为 `http://127.0.0.1:3200`；未进行部署或远程迁移。

- 首轮生产浏览器验收发现 P1：六境卡片的装饰图片在生产层叠上下文中截获顶部导航点击。已于 `5e8dce7` 把顶部导航置于独立更高层级，并令六境的图片和蒙层不接收指针事件；修复后 4 项动效/导航浏览器用例通过。
- 首轮移动 Lighthouse 为 72 / 69 / 69，未达到规格的 85，原始报告保留在 `output/lighthouse/mobile-1.json` 至 `mobile-3.json`。返工把移动首图改走响应式图像优化、降低非关键山水层质量，并移除了阻塞首绘的 442KB 本地全字库；系统宋体回退在当前 Windows 浏览器中保持宋式视觉。`sharp` 已加入生产依赖。
- 返工后的三轮移动 Lighthouse 为 87 / 92 / 93，报告为 `output/lighthouse/mobile-font-fallback-1.json` 至 `mobile-font-fallback-3.json`。Lighthouse 在报告落盘后因 Windows 临时目录清理抛出 EPERM；该清理错误不能误写为命令零错误退出，但 JSON 报告可被解析，测量值已记录。
- 候选提交已通过 `npm test`（38 passed，14 skipped）、`npm run lint`、`npm run build`、生产 Playwright（6 passed，3 skipped）。3 项跳过均明确要求隔离 Supabase 与双测试账户，仍不可替代真实 Auth/RLS/RPC/迁移验收。
