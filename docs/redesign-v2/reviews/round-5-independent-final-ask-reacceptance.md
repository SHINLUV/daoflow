# DaoFlow V2 Round 5 最终问道独立复验

## 结论

**总体：EXTERNAL_BLOCKED，不能签 PASS，也不是本轮发现的实现 FAIL。**

候选 `e55514bfba24ffa5766dc0ea829296fb6e50d111` 在本轮所有可控的问道边界，以及一次正常的真实 Agnes 浏览器保存闭环中均通过：超时被准确标识，重试保存没有重调模型，正常浏览器请求实际为 `provider=agnes`、`degraded=false`、`persistence=saved`，并可在刷新后的历史中读取。

但紧接着用两个真实本地 Auth/JWT 账户执行既有的完整 API 验证脚本时，唯一失败断言是 `ask actually used non-degraded Agnes model`；受控读取该次孤立测试账户刚保存的会话元数据为 `provider=deepseek`、`degraded=false`、`fallbackReason=null`。这不是 Agnes 成功的替代证明。夹具已停、正常服务已恢复，且本轮不再重复真实供应商调用以规避可能的限流/上游不稳定。故该外部依赖门槛本轮为 **EXTERNAL_BLOCKED**；不得把 DeepSeek 结果签作 Agnes PASS，也不应把同一候选的浏览器 Agnes 成功伪报为实现缺陷。

本验收者未参与实现、Round 1--4 审阅或修复。除本报告外，未修改产品、迁移、依赖、配置、schema 或既有报告；未提交。

## 候选、资料与环境

| 项目 | 实测 |
| --- | --- |
| sourceCommit | `e55514bfba24ffa5766dc0ea829296fb6e50d111` |
| 初始工作区 | `git status --short` 无输出；`git diff --check` 无输出。 |
| 规格资料 SHA-256 | `01-PRD.md` `BF59D204ACD1C26AC9C7D4657EA1E6A3576698C5572ABD79796E8E4623DAE288`; `03-DESIGN-AND-TECH-SPEC.md` `7D3CC9583B31BA6C1B93217F9A82394012096F9CC5BA2F9DB711B58EFF8EAE7A`; `07-INDEPENDENT-ACCEPTANCE.md` `B8576D4ACCF33D1A360196C25A6D231DBAF453ED928759ADDB0EA98445B78AFB`. |
| 前轮报告 SHA-256 | Round 3 `F7C7B10DBA033DE69F42953D5F53C11898F2BB3608A2CA08A6E752702876F887`; Round 4 `6A8CE755E520F0A786CF554B3C817C7D33D1C1E050A6CD46F234B36286CAC8CA`. |
| 运行环境 | `127.0.0.1:3200` 正常 Next production server、loopback Local Supabase、Mailpit。所有浏览器内容和账户均为虚构验收数据；浏览器仅使用真实 magic-link 会话，未使用 `service_role`。 |
| 凭据与边界 | 未输出、截图、写入或提交 Agnes 密钥/JWT。`service_role` 仅在本机为 R5 的虚构 `generated` 请求和脚本 Auth fixture 初始化，所有 UI 和业务权限断言均走用户会话/JWT。未做生产/远程迁移、部署、reset 或 push。 |

## 自主实测

| 项目 | 结果 | 可观察证据 |
| --- | --- | --- |
| 受控双上游 12 秒超时 | **PASS** | 临时 OpenAI-compatible fixture 只监听 `127.0.0.1:3310`；临时 3200 将 Agnes 和 DeepSeek 都显式指向它。真实 magic-link 浏览器提交虚构 `R5_TIMEOUT` 后，fixture 调用数为 2。页面实际显示“AI 服务本次未能回应，以下是本地经典匹配的降级回应；原因：上游服务超时。”；`POST /api/ask` 的实际元数据为 `provider=local_fallback`、`degraded=true`、`fallbackReason=timeout`、`persistence=saved`。浏览器快照：`.playwright-cli/page-2026-09-09T20-09-52-647Z.yml`。 |
| 生成后失败的仅保存重试 | **PASS** | 仅用服务端权限为同一虚构用户建立一个 `generated` 结果；浏览器重载后实际显示“回答已在服务端生成，但尚未写入历史；可仅重试保存。”和“仅重试保存”。点击后提示和按钮消失，网络自载入起只有 `POST /api/journal/ask-requests/<id>/retry-save` 200，没有新的 `POST /api/ask`；fixture 计数仍为 2。快照：`.playwright-cli/page-2026-09-09T20-13-39-649Z.yml`、`.playwright-cli/page-2026-09-09T20-14-07-074Z.yml`。 |
| 夹具清理和正常服务恢复 | **PASS** | 明确核实并停止临时 3200 与 3310 listener；随后以 `scripts/local-session.ps1 -Action Start` 恢复用户 `.env.local` 的正常 3200。恢复后 `GET /ask` 为 200，3310 无 listener。停夹具后等待至少 72 秒，期间未发送真实 Agnes 请求。 |
| 正常真实 Agnes 浏览器闭环 | **PASS** | 冷却后提交一次虚构普通问题，`POST /api/ask` 为 200，响应元数据为 `provider=agnes`、`degraded=false`、`fallbackReason=null`、`persistence=saved`、`retrySaveAvailable=false`。页面显示回答；进入“我的道”后记录实际出现，刷新该页后仍出现并可展开读取。快照：`.playwright-cli/page-2026-09-09T20-17-15-509Z.yml`、`.playwright-cli/page-2026-09-09T20-19-39-486Z.yml`、`.playwright-cli/page-2026-09-09T20-20-04-125Z.yml`。 |
| 双真实 JWT API / RLS / Ask 脚本 | **EXTERNAL_BLOCKED** | 正常服务上运行 `./scripts/local-session.ps1 -Action Command -Command node -CommandArguments @('scripts/verify-local-functions.mjs','--ask')`。直到真实模型断言前，匿名 401、两个真实 Auth/JWT、跨账户读写关联拒绝、CAS、幂等、分页、收藏、私有表/RPC 权限、真实问道并发 `202/200` 和保存均为 PASS；唯一失败是 `ask actually used non-degraded Agnes model`。只读核对该脚本本次虚构账户的保存会话确认 `deepseek/non-degraded/null`。该供应商降级不满足本轮 Agnes 门槛；不以此签 PASS，也不重发请求。 |

## 复验范围说明

- 已独立复验 Round 3 原 FAIL 的超时分类，并实际观察到修复后的用户可见文案和 `timeout` 元数据。
- 已独立复验 Round 4 所要求的“仅重试保存不重新调用模型”以及正常真实 Agnes 浏览器结果；该正常闭环实际成功。
- API 脚本中的 `service_role` 仅创建两个隔离的本地虚构测试用户；随后的业务 HTTP/PostgREST/RLS 均以各自真实 JWT 运行，未用管理员请求证明业务权限。
- 本轮不扩展为生产、远程迁移、真实用户 UAT。`BUSINESS_UAT_PENDING` 仍然有效。

## 需要的后续复验

在确认 Agnes 可稳定接受下一次虚构请求后，保持 3310 未监听且正常 `.env.local` 3200 已运行，重新执行一次完整 `verify-local-functions.mjs --ask`。只有其 `ask actually used non-degraded Agnes model` 也通过，且报告保留本轮 `EXTERNAL_BLOCKED` 原始记录时，才可由一名新的独立验收者将这条外部依赖门槛改签为 PASS。

