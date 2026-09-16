# Agnes API 与结构化回答生产验证

日期：2026-09-16（Asia/Shanghai）

生产候选：`42ae7401dbf44eb147e1a840db98c8b0fef30fdb`

范围：Agnes OpenAI-compatible API 调用、answer_v2 格式、可信引用校验、慢响应重试与生产运行。本文不把该切片外推为认证、大厅、双账户 RLS 或业务 UAT 通过。

## 实现边界

- Agnes 使用 `https://apihub.agnes-ai.com/v1` 的 Chat Completions API，模型为 `agnes-2.0-flash`。
- Agnes 请求增加 `response_format: { type: "json_object" }`；DeepSeek 请求未被改写，answer_v2 正常路径也不会降级到 DeepSeek 或静态章节。
- 返回可容忍唯一 JSON 对象外层的说明或 Markdown 围栏，但多个 JSON 对象、未知字段、错误 chunk、错误章节或未获批准的引用均拒绝。
- 模型偶尔把繁体原文转成简体。转换只用于定位；最终返回的 quote 始终由对应 approved evidence 的连续原文切片生成。
- 省略号两侧每一段都必须在同一 evidence 中通过；伪造前缀、后缀或中间段会整体拒绝。
- 单次 Agnes 超时为 60 秒；默认重试退避为 15 秒加少量 jitter；总预算 140 秒，最多两次。有 `Retry-After` 时优先遵守；401/403 不重试。

## 保留的失败与返工

| 候选 | 结果 | 处置 |
| --- | --- | --- |
| `0a02faf345dff1e3f623760abaa0851e06bb8b96` | 独立验收 FAIL | 快速路径没有返回 approved 原文切片；伪造前缀加合法后缀会被错误截断后接受。原 FAIL 未删除。 |
| `1bfadbade57eefd29bfe2214116597b30d3a07d3` | 引用修复独立 PASS；首次生产调用仍 FAIL | 第一次 30 秒 timeout，第二次 429；冷却后又出现空内容后 3 秒重试撞 429。没有把 503、空内容或静态输出计为成功。 |
| `42ae7401dbf44eb147e1a840db98c8b0fef30fdb` | PASS | 将单次预算扩到 60 秒，并把无响应头的重试间隔扩到 15 秒；重新完成工程验证、独立验收和生产调用。 |

## 工程验证

- 定向 AI 测试：34/34 通过。
- 全量 `npm test`：44 个文件，224 passed，14 skipped。14 个既有 skip 没有计作通过。
- `npx tsc --noEmit`：退出码 0。
- `npm run lint`：0 warning，0 error。
- `npm run build`：退出码 0，47/47 静态页生成。
- 独立虚拟时钟复核：两次 timeout 均为 60000ms；标准总耗时 135000ms，最大 jitter 总耗时 135249ms，均在 140000ms 总预算内；`Retry-After=23` 时等待 23000ms；401/403 仅调用一次。

## 生产证据

- `origin/master` 与 `origin/codex/auth-hall-rag-runtime-gates` 均指向完整候选 SHA。
- `/opt/daoflow/current` 指向 `/opt/daoflow/releases/42ae740`。
- `daoflow-app-1` 与 `daoflow-ask-worker-1` 均使用 `daoflow:42ae7401dbf44eb147e1a840db98c8b0fef30fdb`，状态 healthy。
- `GET /api/health` 返回 HTTP 200，`status=ok`，`release` 精确等于候选 SHA。
- 生产迁移账本 18 条；approved corpus version 1、document 1、chunks 81；Auth 用户计数 1。只记录计数和公开语料元数据，未读取私人正文。
- 总控真实匿名调用：HTTP 200，22.44 秒，`provider=agnes`，`answerV2.status=answer`，3 条 citation，2 个 action，所有深度字段非空，`persistence=not_requested`。
- 未参与开发的验收智能体独立调用：HTTP 200，10.97 秒，`provider=agnes`，`answerV2.status=answer`，3 条 citation，2 个非空 action，所有深度字段非空；无 503、无静态或其他模型降级。
- 生产切换前备份：`/opt/daoflow/shared/stack.env.pre-42ae740-20260916T015945Z`；上一个可回退 release 为 `/opt/daoflow/releases/1bfadba`。

## 剩余门禁

本切片只证明真实 Agnes API、结构化格式、批准语料引用和生产运行。真实邮件验证码、MFA、双账户 JWT/RLS、大厅全角色闭环、完整浏览器 E2E、30 题质量评分和业务 UAT 仍按各自证据判定，不能由本报告代签。
