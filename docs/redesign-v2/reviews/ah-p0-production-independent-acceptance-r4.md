# AH-P0 生产环境独立验收 R4

- 验收角色：全新、未参与本轮开发的独立 Agent V
- 验收方式：只读；未修改代码、数据库、生产配置或运行状态
- 验收日期：2026-09-13（Asia/Shanghai）
- 候选提交：`ab067cdca07dba51699b6790332697b7101aa8c1`
- 主生产域名：`https://dao.shinluv.cloud`
- 兼容域名：`https://tanfeng.shinluv.cloud`

## 最终判定

**PARTIAL；完整业务验收仍为 NOT_READY / BLOCKED，不能判全量 PASS。**

候选版本已真实部署，基础 HTTP、静态资源、浏览器页面、反向代理安全门禁、容器健康和正式迁移账本均通过独立只读核验。但可信经典语料尚未完成独立审批且没有任何文档或 chunk，因而真实 Agnes 深度回答、可信 RAG、认证用户完整闭环及大厅发布审核闭环仍未形成可验收证据。

## PASS：已独立验证的事实

### 1. Git 候选与远端分支

- 本地 `HEAD`：`ab067cdca07dba51699b6790332697b7101aa8c1`。
- 远端 `origin/codex/auth-hall-rag-runtime-gates`：同一候选 SHA。
- 远端 `origin/master`：`29e3b94601a93bcbf0e159136356820be0f20e0d`，尚未包含该候选。
- 本地除既有未跟踪工作区内容外，没有发现候选代码的未提交修改；这些既有未跟踪内容未被本次验收触碰。

### 2. 生产 health、核心页面与静态资源

- `https://dao.shinluv.cloud/api/health`：HTTP 200，`release` 精确返回候选 SHA。
- `https://tanfeng.shinluv.cloud/api/health`：HTTP 200，`release` 精确返回候选 SHA。
- 主域名 `/`、`/ask`、`/auth/register`、`/hall`、`/api/auth/session` 均返回 HTTP 200。
- 首页共发现 15 个 CSS/JS 静态资源；抽查 3 个 CSS 与 3 个 JavaScript 资源均返回 HTTP 200，并具有相应内容类型。

### 3. 真实浏览器验收

使用真实浏览器访问生产环境并等待前端完成加载，观察到：

- `/ask`：页面标题为“DaoFlow · 问道”；“你的问题”文本输入区域可设置，显示 `0 /500`，空输入时“问一问道”按钮为禁用状态。水墨配色、排版和输入框边界正常呈现，没有停留在“正在载入问道…”状态。
- `/auth/register`：注册页完成加载，显示邮箱、至少 12 位密码和“发送验证邮件”表单控件。
- `/hall`：匿名大厅完成加载，显示章节/主题筛选，并在当前没有已审核公开记录时显示“这里暂时还没有通过审核的匿名分享。”
- `/journal`：未登录访问时最终显示“请先登录后查看私人记录。”，没有返回任何私人记录。
- 浏览器本次只读检查未捕获到 error 或 warn 控制台日志。

上述结果证明页面与前端资源在生产浏览器中真实运行，但不等同于已完成邮箱验证码、登录后持久化或双用户隔离 UAT。

### 4. Caddy 防伪造转发头门禁

针对 `POST /api/auth/sign-out` 进行无会话、无 CSRF cookie 的只读安全探测：

- `Origin: https://dao.shinluv.cloud`，同时伪造传入 `X-Forwarded-Host: evil.example`、`X-Forwarded-Proto: http`：返回 HTTP 403，错误码 `CSRF_REJECTED`。
- `Origin: https://evil.example`：返回 HTTP 403，错误码 `ORIGIN_REJECTED`。

这证明生产反向代理没有信任客户端伪造的转发来源；同源请求进入 CSRF 门禁，跨源请求先被 Origin 门禁拒绝。

### 5. 容器镜像与健康状态

- `daoflow-app-1`：镜像 `daoflow:ab067cdca07dba51699b6790332697b7101aa8c1`，running、healthy、重启次数 0。
- `daoflow-ask-worker-1`：同一候选镜像，running、healthy、重启次数 0。
- DB、Auth、REST、API 容器均为 running、healthy，重启次数 0。
- worker 心跳文件存在，检查时年龄约 535ms。
- app 容器内 `AGNES_API_KEY`、`AGNES_BASE_URL`、`DAOFLOW_CORPUS_VERSION`、`DAOFLOW_ASK_WORKER_TOKEN` 均存在；未读取或输出任何密钥值。

容器健康和空 worker 心跳只证明部署与调度链路存活，不证明真实模型生成成功。

### 6. 正式迁移与当前数据

- `daoflow_ops.schema_migrations` 共记录 16 条正式迁移。
- 001 至 015 以及 `20260911053348_hall_execute_and_published_cursor.sql` 均有账本记录。
- 数据库账本 SHA256 与服务器当前发布目录中的 16 个迁移文件逐项一致。
- 当前生产计数：
  - `auth.users = 1`
  - `public.users = 1`
  - `public.chapters = 81`
  - `public.journal_entries = 0`
  - `public.journal_volumes = 0`
  - `public.ask_sessions = 0`
  - `public.journal_ask_requests = 0`
  - `public.hall_publications = 0`

这些是验收时刻的真实计数，不把“表存在”或“迁移执行过”替代为真实业务用例通过。

## BLOCKED / NOT_READY：不得冒充通过的门禁

### 1. 可信经典 RAG

- `dao-de-jing-wang-bi-v1` 当前 `review_status = pending`。
- `dao_corpus_documents`：0 条。
- `dao_corpus_chunks`：0 条。
- 没有可供检索和引用校验的已审批 chunk。

因此可信经典 RAG 当前为 **BLOCKED / NOT_READY**。不能以静态章节、空检索、配置存在或代码路径存在冒充可信 RAG 已上线。

### 2. 真实 Agnes 回答

- Agnes 运行配置存在，但本次验收没有观察到任何已完成的真实生产问道任务。
- 当前 corpus 未审批且 chunks 为 0，系统不具备生成“有可信经典证据引用”的回答条件。
- worker 当前只是在零待办任务下维持健康心跳。

因此 Agnes 可靠性与深度回答为 **BLOCKED / NOT_READY**；不得把 mock、构建通过、空 worker 轮询、静态降级或其他模型替代视为真实 Agnes PASS。

### 3. 认证与私人数据完整闭环

本轮没有执行：

- 真实邮箱验证码送达与验证；
- 注册、登录、刷新、登出、找回密码、MFA 的生产闭环；
- 两个真实普通用户之间的 RLS 隔离；
- 私人记录创建、刷新后持久化、导出与删除账户闭环。

生产注册页面可加载、未登录不返回私人记录属于基础门禁 PASS，但完整认证与私人账户 UAT 仍为 **BLOCKED / NOT_READY**。

### 4. 匿名大厅完整闭环

当前大厅没有任何发布记录。本轮未形成“真实 Agnes 回答 → 用户主动脱敏并同意发布 → 审核员审核 → 匿名大厅展示 → 撤回/举报”的真实生产证据，因此大厅完整业务闭环仍为 **BLOCKED / NOT_READY**。

## 审计结论

`ab067cdca07dba51699b6790332697b7101aa8c1` 已作为真实生产候选运行，基础部署和安全运行门禁通过；但完整产品上线验收不能通过。发布说明必须保持以下边界：

- **生产候选部署：PASS**
- **基础页面、静态资源、反向代理来源防伪造、容器健康、迁移账本：PASS**
- **可信经典 RAG：BLOCKED / NOT_READY**
- **真实 Agnes 深度回答：BLOCKED / NOT_READY**
- **认证私人账户完整 UAT：BLOCKED / NOT_READY**
- **匿名大厅发布审核闭环：BLOCKED / NOT_READY**
- **总体：PARTIAL，不得标记为完整功能 PASS**
