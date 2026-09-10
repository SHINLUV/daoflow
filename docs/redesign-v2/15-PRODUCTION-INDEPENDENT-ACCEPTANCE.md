# DaoFlow V2 生产独立技术验收

验收时间：2026-09-11（Asia/Shanghai）  
验收者：`final_independent_acceptance`（未参与开发，只读复核）  
候选提交：`abe73adb372f6f4f6a2dca94819fcd14b48dc6ac`  
最终域名：`https://tanfeng.shinluv.cloud`  

## 结论

**DEPLOYED_TECHNICALLY_VERIFIED / BLOCKED_USER_ACTION / BUSINESS_UAT_PENDING**

当前提交、远端、腾讯云运行版本、公开页面、数据库迁移、基础内容、隔离 API 验证、真实 Agnes、备份和回滚条件均有可复核技术证据。生产技术部署门禁通过。

不能签署“完整业务验收”：真实 QQ 魔法链接已由生产 SMTP 接受发送，数据库仅保留该 QQ 账户，但本轮没有用户实际点击最新邮件后完成生产登录、刷新保持会话、退出及私密草稿清理的浏览器证据。该项必须由用户操作邮箱后继续验收；用户真实内容和商业可用性仍由用户本人 UAT，不由技术验收者代签。

## 独立复核结果

| 验收项 | 独立观察 | 结论 |
|---|---|---|
| Git 与候选绑定 | 初始检查工作树干净；`master`、`HEAD`、`origin/master` 均为 `abe73adb...`。验收过程中总控更新了 `FUNCTION-GAP-MATRIX.md`，该并发文档改动不属于本候选应用代码。 | PASS（报告绑定 HEAD） |
| 最终域名 | `tanfeng.shinluv.cloud` 与 `dao.shinluv.cloud` DNS A 均为 `101.33.35.39`；两个 `/api/health` 均返回 200 和 `release=abe73adb...`。 | PASS |
| 生产容器 | `app/db/auth/rest/api` 五个 DaoFlow 容器均 healthy；当前 release 链接为 `/opt/daoflow/releases/abe73ad`；应用镜像标签为 `daoflow:abe73adb...`。 | PASS |
| 原站回滚 | `tanfeng-personal-site` 仍以旧镜像运行且 healthy，没有删除旧容器或数据。 | PASS |
| ERP 不受影响 | `https://tanfengerp-test.shinluv.cloud` 返回 HTTP 200；共享 Caddy 仍在运行。 | PASS |
| 单元测试 | 独立执行 `npm test -- --run`：18 files passed；117 passed、14 skipped。跳过项不计作通过。 | PASS_WITH_SKIPS |
| lint | 独立执行 `npm run lint`：0 warning、0 error。 | PASS |
| production build | 独立执行 `npm run build`：完成 20/20 静态页生成并以退出码 0 结束。 | PASS |
| 最终域名公开 E2E | 正确设置 `DAOFLOW_PRODUCTION_BASE_URL` 与数据库标志后执行：6 passed、6 skipped。通过项覆盖匿名收藏状态、匿名问道草稿不入 URL、水墨导航、修饰键、减少动态、390px 横向溢出和六境交互；6 条认证夹具用例明确跳过，不计作生产认证浏览器通过。 | PASS_WITH_SKIPS |
| 数据库迁移 | `daoflow_ops.schema_migrations` 有 001–012 共 12 条；服务器当前 release 中 12 个迁移文件 SHA-256 与账本逐项一致。迁移 005 的同用户复合关联已实际用于后续验证。 | PASS |
| 基础经典 | `public.chapters` 实际计数为 81。 | PASS |
| 测试账号清理 | `auth.users=1`、`functions-%` 测试账号=0、QQ 账号=1；恢复临时数据库残留=0。未输出邮箱或任何凭据。 | PASS |
| 真实 Agnes 与私密功能 | `production-function-verification-with-agnes.json`：runId `c8c5c656-6560-4c67-867b-a717866874aa`，118/118 PASS，明确断言非降级 Agnes；同时覆盖两名真实 Auth 用户密码登录/JWT、RLS/直接写拒绝、心笺 CAS 与幂等、回收恢复、卷册、收藏批注、分页搜索、导出隔离、并发 202/200、requestId 异内容 409、仅重试保存不重新生成、时间线/搜索/导出含保存回答。 | PASS（API/DB 技术闭环） |
| 备份 | 定时器 active + enabled；最新清理后备份 `daoflow-20260910T183211Z.dump` 为 root:root、0600，`pg_restore -l` 可列出 392 项。已有恢复演练记录为 12 个迁移、81 章、1 个账号，临时库随后删除；本验收另核实残留为 0。 | PASS |
| QQ 魔法链接生产会话 | SMTP 请求成功与账户存在只能证明“已发送/已建用户”。当前没有可采信的用户点击回调、刷新仍登录、退出后私密状态清理证据；QQ 邮箱页仍处于用户扫码登录边界。 | **BLOCKED_USER_ACTION** |
| 真实业务 UAT | 未使用用户私人内容做验收，也未由用户本人确认业务可用性。 | **BUSINESS_UAT_PENDING** |

## 生产 verifier 证据边界

- `output/production-function-verification.json`：SHA-256 `8c68df50638e2a5af1223a645909d919cf5ef19d90c57e9458a47befbb0cc8d3`，98 PASS / 1 非 PASS，总体 PARTIAL；其 Agnes 分支未执行，不能单独用于全通过声明。
- `output/production-function-verification-with-agnes.json`：SHA-256 `57eabd237152062bafc5c990224f494ec134c563fce558cbc50047c80dfec8cb`，118/118 PASS，总体 PASS。
- 两份 verifier 均绑定源提交 `5b1e664...`。其后提交仅涉及 Auth 删除级联迁移、相关测试和备份脚本执行位；当前 HEAD 的 117 项单元测试、12 个生产迁移及最终运行版本已分别复核。API verifier 不能替代 QQ 魔法链接真实浏览器会话。
- 现有五张生产响应式截图位于 `output/production-acceptance/screenshots/`（320、390、768、1440、1920）；本轮最终域名 Playwright 另生成公开流程视频。没有创建“完整登录闭环录屏”，故不作此声明。

## 原始失败与返工历史（保留）

1. **CRLF 迁移失败**：首次上传的 shell/迁移换行导致执行失败，且当时尚未完成业务迁移。提交 `7c6cbf4` 增加 Linux 换行约束后重新发布，最终 001–012 账本与 release 文件一致。原失败不删除。
2. **SMTP Docker DNS 失败**：首次 QQ magic-link 请求因 Auth 仅在内部网络无法解析/访问外部 SMTP 而失败。提交 `25fd578` 为 Auth 增加受控出口与允许的邮件外部主机后，发送请求返回 200。该修复仍不等于用户已点击邮件。
3. **Agnes 429**：生产首轮匿名调用实际触发 429 并显示 `local_fallback/degraded=true`，没有冒充 Agnes 成功。冷却后单次真实调用恢复为 `provider=agnes/degraded=false`；完整生产 verifier 随后 118/118 PASS。
4. **首次生产 E2E 标志遗漏**：第一次生产 E2E 因未设置数据库配置标志而出现与目标环境不一致的结果；补齐标志后得到 6 passed / 6 skipped。独立验收本轮还曾误用 `DAOFLOW_E2E_BASE_URL`，导致回落至 `127.0.0.1:3200` 并产生 7 个连接拒绝；核对配置后改用 `DAOFLOW_PRODUCTION_BASE_URL`，复跑为 6 passed / 6 skipped。两次错误调用均不算产品 PASS，也未覆盖其记录。
5. **测试账号清理的两层 FK 缺陷**：首次删除测试 Auth 用户被 `public.users` 外键阻挡，提交 `7554e88` 将 profile 外键改为级联；复测又暴露下游账户依赖，提交 `7a259c8` 统一所有权级联和可选关联置空。最终真实计数为测试账号 0、QQ 账号 1。
6. **备份脚本执行位**：systemd 首次运行暴露脚本未保留可执行位；提交 `abe73ad` 修正为 100755。最新备份生成并可列目录。
7. **恢复验证权限、角色与查询引用**：早期恢复读取曾被 0600 权限拒绝，随后以受控 `sudo cat` 读取；使用 `postgres` 查询又遇到 vault 权限，改由 `supabase_admin` 完成。最终恢复核验还保留 shell/SQL 引号错误记录，纠正引用后才采信 `12|81|1`，并确认临时库残留 0。

## 未关闭门禁与复验步骤

唯一外部动作门禁是 QQ 邮件点击：用户在 QQ 邮箱打开最新 DaoFlow 登录邮件并点击链接后，验收者需在 `https://tanfeng.shinluv.cloud/my-dao` 依次核对账户可见、刷新仍登录、预登录草稿回原标签恢复、跨标签提示、退出后 owner-scoped 私密草稿和会话清理。完成前状态必须保持 `BLOCKED_USER_ACTION`。

之后由用户本人用非敏感或自有测试内容完成业务 UAT。技术 PASS 不代表生产商业承诺、真实内容效果或业务签字。
