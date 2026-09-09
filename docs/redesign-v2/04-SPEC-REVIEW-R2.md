# DaoFlow V2 技术规格第二轮独立审查

日期：2026-09-09。审查身份：`/root/independent_plan_review`，未编写规格或产品实现。

判定：PASS（规格层面）。原 `04-SPEC-REVIEW.md` 的 FAIL 完整保留，本结论只适用于本轮文件哈希，不代表实现通过。

本轮完整重读 `03-DESIGN-AND-TECH-SPEC.md`，SHA256：`7D3CC9583B31BA6C1B93217F9A82394012096F9CC5BA2F9DB711B58EFF8EAE7A`。

代码基线：`f3aa69376edd11b0895c8e58fe58274012fa9a1f`。此次未重新运行产品或测试。

## 阻断项闭环

- B01 CLOSED：authenticated 对私人新表和旧 ask_sessions 仅有自身 SELECT；普通业务写入明确收口有限 SECURITY DEFINER RPC。函数要求 auth.uid 非空、拥有者过滤、显式字段、原子版本与状态校验、固定 search_path，并撤销 PUBLIC/anon 执行权限。问道结果由 server-only 模块调用 service_role 专用函数，客户端不能写结果或调用服务写入函数。需要在实现中逐项验证这些要求，不能只检查 RLS 声明存在。
- B02 CLOSED：请求拥有 claim_token 与 generation，接管时原子更换；迟到完成写必须匹配当前 token/generation/state，失去所有权不得写历史。generated 不被租约接管，保存锁行并以 user_id/request_id 唯一约束事务幂等。覆盖了原 FAIL 指出的重复历史和迟到覆盖风险。

新阻断项：无。可进入实施计划编制。

## 验收协议旁审

另完整读取 `07-INDEPENDENT-ACCEPTANCE.md`，SHA256：`B8576D4ACCF33D1A360196C25A6D231DBAF453ED928759ADDB0EA98445B78AFB`。

该协议要求独立上下文、冻结候选、真实操作、身份隔离、失败保留和逐轮复验，原则完整。建议在计划的具体验收用例中显式列出以下项目，避免泛化描述遗漏：

1. 直接 authenticated Supabase 写入被拒绝、只能调用有限用户 RPC，服务专用函数不可执行。
2. 原工作者超过60秒、接管成功、原工作者迟到，最终只有当前世代结果与一条历史；保存重试不调用模型。
3. S4 的 Lighthouse 中位数、CLS 和10次交互长任务要求应纳入可判定检查清单，而非仅五项视觉主观分。
4. 导出日期范围应明确实体过滤字段与关联补齐规则，分片可重组且不静默遗漏；无范围导出必须覆盖全部本人内容。

以上为计划与用例细化建议，不撤销本轮规格 PASS。

修改声明：只新增本 R2 文件。无产品代码/规格/原 FAIL 修改，无部署与真实用户验收。
