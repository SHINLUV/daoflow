# DaoFlow V2 Round 6 独立 Agnes 外部门禁恢复验收

## 结论

**总体：PASS（仅关闭 Round 5 遗留的外部 Agnes 稳定性门禁）。**

候选 `65e3e6b8ccf1a9b55162106c7c7a69cee1e692bc` 在新的、干净的独立验收环境中，通过了冷却后的**唯一一次**完整真实本地 API/数据库/RLS/Agnes 验证。脚本最终 `status: PASS`，其中 `ask actually used non-degraded Agnes model` 明确为 PASS；脚本的真实问道链路同时验证了生成完成、服务端保存、卷册时间线、搜索、导出、幂等、重试保存与跨账户隔离。依据该断言的实现定义，本次真实响应为 `provider=agnes`、`degraded=false` 且保存成功；DeepSeek 或本地降级均不构成本结论。

Round 5 的 `EXTERNAL_BLOCKED` 原始报告完整保留；它记录的是当时单次外部供应商结果不稳定，不是被本报告覆盖或删除的历史。本报告仅以冷却后的新、独立实测关闭该项外部门禁。

本验收者未参与实现，也未参与 Round 1--5 的开发、修复或审阅。除本文件外，未修改产品、配置、迁移、schema、依赖或任何已有报告；未提交、未部署、未执行重置或远程迁移。

## 候选与运行现场

| 检查项 | 独立实测结果 |
| --- | --- |
| 绑定提交 | `git rev-parse HEAD` 为 `65e3e6b8ccf1a9b55162106c7c7a69cee1e692bc`，与指定候选一致。 |
| 初始工作区 | `git status --short` 无输出。 |
| 正常应用服务 | `127.0.0.1:3200` 为本项目 `next start --hostname 127.0.0.1 --port 3200` 进程监听；页面根路径在验收前后均返回 HTTP 200。 |
| 临时夹具隔离 | 验收前后均核验 `127.0.0.1:3310` 没有 listener。未将 Agnes 或 DeepSeek 指向任何本地夹具。 |
| 密钥与测试边界 | 未打印、保存、截图或提交 Agnes 密钥、JWT 或 service_role 值。所有生成内容均为脚本虚构验收数据；脚本仅以受控服务端初始化两个本地虚构 Auth 用户，业务/RLS 断言使用其真实用户 JWT。 |

## 冷却与唯一供应商调用

1. 在确认 3200 正常、3310 未监听后，连续静默等待三段各 60 秒，合计至少 180 秒；该时间内未向应用或真实 Agnes 发出请求。
2. 冷却后只执行一次：

   ```powershell
   ./scripts/local-session.ps1 -Action Command -Command node -CommandArguments @('scripts/verify-local-functions.mjs','--ask')
   ```

3. 输出确认本机私有 Agnes 配置和本地数据库可用（无值泄漏），`sourceCommit` 与候选一致，环境为 `loopback-local-real-auth-http-postgrest`，最终 `status: PASS`。
4. 真实问道部分依次通过并未重发供应商请求：并发 `202/200` 完成、持久化幂等重放、`ask actually used non-degraded Agnes model`、已拥有来源/卷册关联、仅重试保存保持同一会话、跨账户查询/重试拒绝、问答进入卷册时间线、问答搜索、带来源链接的导出及账户隔离。
5. 脚本完成后轻量复核：3200 仍监听并返回 HTTP 200；3310 仍无 listener；Git 工作区仍干净（本报告写入前）。

## 范围与保留项

- 本轮只复验 Round 5 的外部 Agnes 门禁，不重新声称覆盖 Round 1--5 已有的浏览器、超时、保存重试或完整产品验收范围。
- 未将 DeepSeek 响应、关键词静态降级或管理员请求视为 Agnes、用户权限或业务成功的替代证据。
- 未扩展为生产部署、远程迁移或真实用户验收；`BUSINESS_UAT_PENDING` 仍应保留，待产品负责人实际业务 UAT。

