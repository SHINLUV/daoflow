# DaoFlow V2 · Terra 开发交接入口

日期2026-09-09。用户已确认：古风高级视觉、水墨转场、AI界面资产、强交互、记录/问道并列、一事一卷、经典收藏；本轮交付是详细开发与设计指令包，产品代码尚未执行V2。

## 阅读顺序
1. [产品需求](01-PRD.md) / [独立需求审查](02-PRD-REVIEW.md)
2. [详细视觉与技术规格](03-DESIGN-AND-TECH-SPEC.md) / [首轮FAIL](04-SPEC-REVIEW.md) / [复审](04-SPEC-REVIEW-R2.md)
3. [开发分工与任务T00–T10](05-IMPLEMENTATION-PLAN.md)
4. [需求追踪R01–R11](06-TRACEABILITY.md)
5. [独立验收和返工规则](07-INDEPENDENT-ACCEPTANCE.md)
6. [可直接粘贴的Terra总提示词](08-TERRA-MASTER-PROMPT.md)
7. [执行包独立审查](09-PLAN-REVIEW.md)
8. 项目根目录`.ai-development/state.yaml`

## 交接事实
原代码基线：f3aa69376edd11b0895c8e58fe58274012fa9a1f。本轮只新增规格、计划、审查、状态文件；不安装项目依赖、不改业务代码、不启动成品、不推送、不部署。下一位Terra须T00检查HEAD、dirty tree与文档hash，按指定文件提交规划锚点，不能清理掉交接包。

旧CLAUDE.md与新版有冲突，01已明确替代关系：采用朱砂印与AI册页插画、记录/问道并列，回答页先回应，阅读页先原文。旧文件不删除以保留历史；Terra可以在T00给旧文件添加“设计已由V2替代”入口，但不能再按旧限制返工新设计。

## 对用户的交付边界
“设计成型”是Terra执行的最终目标：完整可操作本地产品和独立验收证据；当前文件包不是已完成产品。人工UAT未发生，状态不能写生产可用。公共GitHub仓库中不得上传私人记录和测试凭据。缺Supabase环境/模型/生图工具时记录受影响链路，完成其他独立工作后明确交接。

## 首轮审查发现及修正
独立规格审查第一轮指出：直接Supabase写可能绕过CAS/状态规则；问道超时接管缺少旧worker隔离。新版已规定受限RPC、权威结果服务端写入、claim_token/generation校验与唯一历史事务。原FAIL保留，第二轮报告绑定修订规格hash。未来实施验证仍必须实测这些边界。
