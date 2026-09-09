# DaoFlow V2 技术规格独立审查

日期：2026-09-09。审查身份：`/root/independent_plan_review`，未编写规格、未开发产品。

判定：FAIL。通过 PRD 不等于技术规格通过；在以下阻断项关闭前不进入实施计划冻结。

对象：完整读取 `03-DESIGN-AND-TECH-SPEC.md` v1.0。

SHA256：`B64A5838B829C997BF7C246483078F6535FAE6AB18354C8E51E667191BE4E255`。

PRD SHA256：`BF59D204ACD1C26AC9C7D4657EA1E6A3576698C5572ABD79796E8E4623DAE288`。

代码基线：`f3aa69376edd11b0895c8e58fe58274012fa9a1f`。补充读取了 `src/app/api/ask/route.ts`、`supabase/migrations/001_initial_schema.sql` 验证旧会话写入及权限基础。

## 阻断项

### B01 数据库直连操作可绕过关键产品约束

S5 对新表定义 authenticated INSERT/UPDATE/DELETE 和所有者 RLS，但权威字段、CAS、已删除记录不可编辑、已归档卷册不可新增归入等要求主要停留在服务端描述。持有用户 token 的客户端能够直接请求 Supabase REST；所有者 RLS 只验证所有权，不能强制这些状态转换。数据库约束目前仅覆盖部分长度和复合 FK。原始 ask_sessions 的 `for all` 所有者策略还允许用户直接改写 AI 快照，与服务端保存可信结果的边界不完整。

要求：明确选择数据库触发器/列权限或受限 RPC，使 timestamps/version、CAS、归档/回收状态规则及模型输出写保护在数据库 API 下仍成立；对请求暂存和旧 ask_sessions 的权限分别写清。独立测试应包含绕过 Next API 的直接 authenticated Supabase 操作，而非只有两用户交叉访问。

### B02 租约接管缺少过期工作者写入隔离

S6 允许 processing 超过60秒后再次 claim，但没有 attempt generation/claim token，也没有以当前 token 限定 generated/saved 完成写。若原模型响应在接管之后才返回，它可能覆盖新执行的结果。已有 unique(user_id,request_id) 可以限制历史条数，但不能决定哪一次执行有权写结果。

要求：claim 返回唯一 token 或递增 generation，所有更新以 user_id/request_id/token/当前状态条件写；过期执行丢弃迟到结果。最终保存结果与 sessionId 必须事务幂等，保存重试不重新调用模型。补充慢请求、租约接管、原请求迟到的并发测试。

## 已达到要求的部分

- 页面路由、记录/问道入口、卷册筛选、回答和阅读顺序均覆盖 PRD。
- 桌面手机比例、色板、字体、AI 资产清单及压缩目标足够具体，适合分工执行。
- CSS mask 优先及 WebGL 回退有边界；转场超时解锁、减少动态、键盘和性能检查均有明确要求。
- 问道保存失败与生成失败区分，服务端暂存、单独保存重试接口和匿名不保存边界清楚。
- 导出规定所有者隔离、回收/归档内容、快照和超限报错，不允许默默截断。

## 非阻断细化建议

- 导出日期分片应说明按哪个时间字段过滤各类实体，以及关联卷册/来源是否补齐；提供合并分片后无遗漏的用例。
- 明确无 requestId 的旧登录客户端如何生成稳定的新标识，不应反向依赖页面正文 URL。
- Request 表长时间 generated/failed 的回收政策若首版不设，应明确保留而不是自动清空，避免丢失保存重试来源。

修改声明：只新增本审查文件，无产品代码或规格修改；未执行实现测试、部署或视觉成品验收。
