# DaoFlow V2 Round 4 独立超时复验

## 结论

**总体：FAIL。** 候选提交 `f9067d9302c88096487527e6da554efa720a33c4` 已修复并通过了受控的超时文案复验，也通过了“仅重试保存不再调用模型”的真实浏览器复验；但是，恢复正常 Agnes 配置后，当前真实本地浏览器请求实际落到 `deepseek`，而非要求的 `agnes`。随后重新执行本项目的真实双账户 API 验证，唯一失败断言正是 `ask actually used non-degraded Agnes model`。按本轮门槛，不能将候选签为总体 PASS。

本验收者未参与实现、Round 2/3 验收或本次修复。除本报告外，未修改产品、迁移、配置、依赖、数据库 schema 或已有报告，也未提交。

## 冻结、范围与环境

| 项目 | 实测结果 |
| --- | --- |
| 候选 | `git rev-parse HEAD` = `f9067d9302c88096487527e6da554efa720a33c4` |
| 初始工作区 | `git status --short` 无输出；`git diff --check` 无输出 |
| 受影响实现 | `src/lib/ai/callModel.ts` 把 `Request timed out.`、`ETIMEDOUT`、abort、deadline 等归为 `TimeoutError`；新增 `src/lib/ai/__tests__/callModel.test.ts` |
| 定向单测 | `npx vitest run src/lib/ai/__tests__/callModel.test.ts`：1 file / 7 tests PASS |
| 浏览器身份 | 使用既有虚构本地账户的真实 Supabase magic-link 会话；本轮在 `/my-dao` 可见已登录态，网络 `auth/v1/user` 为 200。浏览器没有 service_role。 |
| 受控异常夹具 | 仅监听 `127.0.0.1:3310`，只服务虚构问题和 OpenAI-compatible chat-completions；服务端建立的唯一 fixture 是一条虚构、`generated` 未保存问道请求。夹具停止后才恢复正常服务。 |
| 边界 | 未执行生产/远程迁移、数据重置、部署或 push；没有打印、写入或提交 Agnes 密钥。 |

## 逐项复验

| 项目 | 状态 | 实际复现与证据 |
| --- | --- | --- |
| 受控双上游超时分类 | **PASS** | 临时的候选 3200 服务把 Agnes 与 DeepSeek 都指向仅 loopback 的虚构夹具；每个 chat-completion 响应均延迟 12 秒。真实登录浏览器提交虚构 `R4_TIMEOUT` 问题后，夹具收到两次调用：`agnes-2.0-flash` 后约 8.010 秒收到 `deepseek-chat`。页面实际显示“AI 服务本次未能回应，以下是本地经典匹配的降级回应；原因：上游服务超时。”；该浏览器的 `POST /api/ask` 200 响应为 `provider=local_fallback`、`degraded=true`、`fallbackReason=timeout`、`persistence=saved`。快照：`.playwright-cli/page-2026-09-09T19-44-24-958Z.yml`。 |
| 生成成功后仅重试保存 | **PASS** | 使用服务端权限仅建立一条该虚构登录账户拥有的 `generated` 请求，浏览器本身仅携带该用户真实会话。刷新 `/ask` 后实际显示“回答已在服务端生成，但尚未写入历史；可仅重试保存。”和“仅重试保存”按钮。点击后按钮消失；浏览器网络自本次加载起仅有 `POST /api/journal/ask-requests/<requestId>/retry-save` 200，没有新的 `POST /api/ask`；loopback 模型计数点击前后都是 2。快照：`.playwright-cli/page-2026-09-09T19-47-35-747Z.yml`、`.playwright-cli/page-2026-09-09T19-47-57-735Z.yml`。 |
| 恢复正常配置 | **PASS** | 停止临时 3200 与 3310 loopback 夹具，再以 `scripts/local-session.ps1 -Action Start` 恢复正常 3200；`GET /ask` 为 200。 |
| 正常真实 Agnes 保存闭环 | **FAIL** | 正常 3200、真实本地浏览器会话提交虚构 `R4_AGNES_REAL` 问题，`POST /api/ask` 返回 200 并保存，但 UI 明确显示“Agnes 本次未能回应，已明确切换为备用 DeepSeek。”响应元数据是 `provider=deepseek`、`degraded=false`、`persistence=saved`，不满足 `provider=agnes`。紧接着以正常配置执行 `scripts/local-session.ps1 -Action Command -Command node.exe -CommandArguments @('scripts/verify-local-functions.mjs','--ask')`：真实账户/JWT、RLS、并发、保存、导出等此前断言均 PASS，最终 `ask actually used non-degraded Agnes model` 为 FAIL，脚本整体 `status=FAIL`、退出码 1。快照：`.playwright-cli/page-2026-09-09T19-50-00-273Z.yml`。 |

## 可复现失败与返工门槛

在不覆写 `.env.local`、不使用受控 loopback 的正常 3200 服务上，以真实本地 magic-link 用户会话提交任意虚构普通问题。验收要求是回答保存且响应元数据为 `provider=agnes`、`degraded=false`。本轮实测结果是 `provider=deepseek`；同一时点重跑 `verify-local-functions.mjs --ask` 也失败于 Agnes 非降级断言。

返工应先定位实际 Agnes 请求为何降级，不能以 DeepSeek 成功、构建通过或 Round 4 的超时分类 PASS 抵消。修复须形成新干净提交，并由一名未参与该修复的验收者重新执行：受控 12 秒双上游超时、生成后仅重试保存不重调模型，以及正常真实 Agnes 的 `provider=agnes / degraded=false / saved` 闭环。

## 未外推事项

- 本报告不签生产部署、远程数据库迁移或真实用户业务 UAT。
- 受控异常证明超时分类和重试保存边界，不替代正常 Agnes 验收；正常 Agnes 验收在本轮明确失败。
