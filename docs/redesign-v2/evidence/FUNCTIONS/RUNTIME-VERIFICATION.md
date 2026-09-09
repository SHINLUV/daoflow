# DaoFlow V2 本地运行验证记录

日期：2026-09-10（Asia/Shanghai）  
候选提交：`084224d`（后续证据/文档提交前）  
范围：仅 `D:\DAOFLOW` 的本地 Next、隔离 Local Supabase、Mailpit 与虚构验收内容；无生产部署、远程迁移或业务 UAT。

## 环境与迁移

- Local Supabase 已运行在 loopback；迁移清单实测为 `001` 至 `010`，其中 `007`、`008`、`009`、`010` 均通过 `supabase db push --local` 前向应用。
- 没有执行数据库 reset、远程链接/迁移，也没有停止、删除或修改无关容器。
- 幂等基础内容导入实测：81章、6主题、43关键词映射、365每日一句。
- 本地应用以 `scripts/local-session.ps1 -Action Build` 构建，并在 `http://127.0.0.1:3200` 运行。该启动器只在进程环境中注入本地数据库凭据和忽略的 Agnes 配置，不打印或写入密钥。

## 真实 API、数据库和 Agnes 结果

命令：

```powershell
.\scripts\local-session.ps1 -Action Command -Command node -CommandArguments @('scripts/verify-local-functions.mjs','--ask')
```

结果：**PASS**。脚本创建两个虚构本地 Auth 账户；service role 仅用于受控初始化，业务请求使用各自真实 JWT/cookie。

- 心笺创建/读取/编辑、同 ID 幂等、并发 CAS 一胜一冲突、中文搜索、游标分页、回收/恢复/永久删除均通过。
- 卷册关联/改名/归档、偏好、收藏去重/批注/取消、导出附件和日期边界均通过。
- 两账户对私有行的读取、修改、关联、搜索、导出均隔离；直接 DML 与 service-only `claim_ask_request` RPC 被 authenticated JWT 拒绝。
- 真实 Agnes 使用虚构问题完成并发 `202`/`200`、同 requestId 回放、不同内容 `409`、服务端保存、仅重试保存、卷内时间线、搜索与导出。结果为 `provider=agnes` 且 `degraded=false`。

## 浏览器闭环

- 用 Mailpit 的真实邮件 UI 点击魔法链接后，回到 `127.0.0.1:3200`；刷新后会话仍在，退出后回到登录页。
- 心笺建立、编辑、刷新持久化；回收后明确显示不可编辑/不可转问道；恢复成功；另一条虚构记录经确认对话框永久删除。
- 卷册建立、改名、归档（仍可阅读和移出）、恢复、移出记录均实际操作。卷内时间线同时显示心笺与保存的问道。
- 从心笺转问道先展示可编辑待发送问题；501字记录明确要求用户自行提炼，完整正文未进入 URL 或自动发送。
- 经典目录显示81章；整章收藏、批注保存并刷新、取消收藏均完成。连续片段收藏仍待最终独立浏览器复验。
- 搜索命中、无结果、清空和日期范围 JSON 下载均完成；下载内容包含心笺、卷册、问道关联和 Agnes 元数据。
- 320、390、768、1440、1920 宽度已拍摄；Tab 可到达导航，动态效果开关可关闭。

## 返工历史

1. `/ask` 的 `useSearchParams` 缺少 Suspense，生产构建无法产生 `prerender-manifest.json`。修复并提交：`11d83d0`。
2. 真实 ask 预检曾返回 `503 ASK_CLAIM_UNCERTAIN`。诊断为 009 中返回表列名与未限定 `request_id` 冲突（PostgreSQL `42702`）。未改写已执行迁移；新增前向 `010_ask_claim_column_qualification.sql`，修复后整段真实 Agnes 验证 PASS，提交：`0c832ff`。
3. 魔法链接回调在 `next start` 下把 IP loopback 归一到 localhost，导致重定向同源不一致。只允许两个显式 loopback Host 的安全恢复，真实 Mailpit 流程复验 PASS，提交：`084224d`。

## 视觉与录屏文件

- [桌面：心笺编辑后刷新](desktop-journal-edit-refresh.png)
- [桌面：卷内心笺与问道混合时间线](desktop-volume-mixed-timeline.png)
- [320 宽度](mobile-320.png)、[390 宽度](mobile-390.png)、[768 宽度](tablet-768.png)、[1440 宽度](desktop-1440.png)、[1920 宽度](desktop-1920.png)
- `browser-ask-save*.webm`：从真实 Agnes 提问到已保存问道出现在卷内时间线的浏览器录屏分段。

## 不作为通过依据的项目

- 14 个依赖专用外部 model-fixture 的条件跳过测试保持跳过，未用于本记录的 PASS。
- 本记录不是独立验收；下一步必须由未参与开发或本轮静态复核的全新验收者在干净候选上复测。
- 真实用户业务 UAT、生产部署和生产可用性仍为 **NOT_EXECUTED**。
