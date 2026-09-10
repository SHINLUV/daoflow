# DaoFlow V2 功能缺口矩阵（本地与生产验证更新）

更新时间：2026-09-11（Asia/Shanghai）。本文件区分实际运行证据、自动验证和仍待用户完成的验收；不把静态页面、构建或条件跳过用例当作完整通过。

| 需求 | 用户入口 | 前端 | API | 数据库 | 自动测试 | 浏览器证据 | 当前状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 登录、会话与私密状态 | `/my-dao`、退出 | 邮件状态/错误、按账户清理私密草稿 | callback、`/api/me/history` | Supabase Auth + 007 RLS | callback、auth 单测；真实 API/RLS 脚本 | Mailpit 收信→点击→`127.0.0.1:3200`回调→刷新仍登录；跨标签草稿回原标签保存、退出清理私密草稿 | **PASS（R2/R3 独立实测）** |
| 心笺、冲突、草稿和回收站 | `/journal/new`、详情、回收站 | 编辑、未保存提醒、409入口、恢复/确认删除 | entries/preferences | 003、008、007 | 真实两 JWT API：CAS、幂等、搜索、回收/恢复/删除 | 建立→编辑→刷新；冲突保留本地稿；回收后禁用问道；恢复及确认永久删除 | **PASS（R2 独立实测）** |
| 卷册与混合时间线 | `/journal`、`/journal/volumes/[id]` | 新建/改名/归档恢复/移入移出 | volumes/timeline | 003、006、008 | 真实 API：分页、关联、归档与隔离 | 建立、改名、归档仍可读/移出、恢复；44 条同时间戳心笺/问道混排分页无漏重 | **PASS（R2/R3 独立实测）** |
| 经典与收藏批注 | `/chapters`、章节页、收藏页 | 81章原文/白话、收藏与批注 | favorites | 004、007 | 真实 API：去重、版本冲突、非法片段、两用户隔离 | 81章目录；整章收藏→批注→刷新→取消；连续片段拖选收藏 | **PASS（R2 独立实测）** |
| 搜索、分页与导出 | `/journal` 搜索/导出折叠区 | 命中、无结果、清空、日期输入与下载 | timeline/export | 006、008、007 | 真实 API：中文检索、游标、日期边界、账户隔离、附件头 | 问道搜索命中、无结果、清空；`[from,to)` JSON 导出与 >5MB 413 错误 | **PASS（R2/R3 独立实测）** |
| 记录转问道 | 心笺“带着这条记录问道” | 先确认/可改写；长记录自主提炼 | ask 请求仅传 ID 关联 | 005、009、010 | ask route/输入单测；真实 API linked 404 | 短记录确认后进入 `/ask`，正文不在 URL；501字记录显示自主提炼提示且未自动发送；回收站禁用 | **PASS（R2 独立实测）** |
| Agnes、保存、202、重试 | `/ask`、问道历史 | 202轮询、保存失败状态、仅重试保存 | ask、ask-request、retry-save | 005、009、010 | 真实 `--ask`：并发 202/200、同 requestId、异内容 409、重试保存、RLS | 真实 Agnes 保存/刷新历史；受控保存失败后“仅重试保存”无第二次模型调用；R6 冷却后真实双 JWT Agnes PASS | **PASS（R2–R6 独立闭环）** |
| 安全与数据隔离 | 所有私密页面/导出 | 未登录状态与非泄露 404 | 所有 journal/ask 路由 | 007 SECURITY DEFINER search_path、RLS、受限 grant | 两真实本地 Auth 用户的 HTTP+PostgREST：读/写/关联/搜索/导出/RPC 拒绝 | 两个真实 Mailpit 账户完成登录；跨账户心笺/问道 URL 无内容泄露 | **PASS（R2/R6 独立实测）** |
| 错误、限流、格式与降级 | ask/保存/登录 | 明确降级文案与重试入口 | callModel/askDao | 不适用 | timeout、429、格式错误和本地降级分类单测；真实 Agnes 成功 | 受控 429、畸形回复和双上游 12 秒超时；超时文案修复后显示“上游服务超时” | **PASS（R3 FAIL 已修复，R4/R5 独立复验）** |
| 响应式、键盘、减少动态 | 全局导航、卷册页 | 既定水墨设计保持 | 不适用 | 不适用 | 旧视觉测试 + 本轮手工快照 | 320/390/768/1440/1920 无横溢出；键盘 Tab/Enter/Arrow/Escape；系统 reduce-motion；十次路由 trace | **PASS（R2/R3 独立实测）** |

## 生产环境增量状态

| 需求 | 生产入口 | 生产技术证据 | 尚未验证 | 当前状态 |
| --- | --- | --- | --- | --- |
| 登录与会话 | `https://tanfeng.shinluv.cloud/my-dao` | QQ SMTP 实际发送返回 200；最终域名页面显示邮件已发送；Auth 中仅保留该 QQ 账户 | 用户须在 QQ 邮箱点击最新链接，随后实测刷新会话、跨标签草稿与退出清理 | **BLOCKED_USER_ACTION** |
| 心笺、卷册、收藏、搜索、导出 | 最终域名对应页面 | 生产真实 HTTP、两名真实 Auth 测试用户/JWT、RLS/RPC、分页与导出验证全 PASS；测试用户已清理 | QQ 用户浏览器手动 UAT | **TECHNICAL_PASS / BUSINESS_UAT_PENDING** |
| Agnes 与问答保存 | `/ask`、问答历史 | 生产真实 Agnes 非降级响应；并发 202/200、requestId 幂等、异内容 409、仅重试保存、时间线/搜索/导出闭环 PASS | QQ 用户浏览器手动 UAT | **TECHNICAL_PASS / BUSINESS_UAT_PENDING** |
| 数据与安全 | 所有私密接口 | 生产双 JWT 账户隔离、直接表写拒绝、他人资源 404；12 个前向迁移、81 章；4 个虚构测试账户清零 | 真实用户自行确认业务数据体验 | **TECHNICAL_PASS** |
| 响应式与动效 | 最终域名全站 | 320/390/768/1440/1920 截图；公开生产 E2E 6 passed / 6 条条件跳过；键盘与减少动态用例通过 | 真实设备 UAT | **TECHNICAL_PASS** |
| 运维与回滚 | 腾讯云 `101.33.35.39` | `tanfeng`/`dao` 健康接口均返回提交 `abe73ad`；ERP 200；五个 DaoFlow 容器 healthy；清理后备份恢复计数 12/81/1；旧个人站容器保留 | 持续运行观察和业务 UAT | **DEPLOYED_TECHNICALLY_VERIFIED** |

## 验证边界

- 本地隔离 Supabase 的完整功能验收仍保留；在用户本轮明确授权后，另建立了隔离的腾讯云生产数据栈并仅执行 `001` 至 `012` 前向迁移，没有改写迁移历史或重置数据。
- 基础内容已以幂等 upsert 实测：81章、6主题、43关键词映射、365每日一句。
- `scripts/verify-local-functions.mjs --ask` 在 R6 的 180 秒冷却后，以真实本地 Auth/JWT、Next HTTP、PostgREST 与 Agnes 实测为 **PASS**。默认未带 `--ask` 的运行会明确为 PARTIAL。
- 生产 `--ask` 验证报告为 `output/production-function-verification-with-agnes.json`，覆盖两用户 JWT、RLS、心笺/卷册/收藏/搜索/导出、真实 Agnes、问答保存与重试；公开浏览器条件跳过项没有被计为通过。
- 仍有 14 个需要外部专用 fixture 的条件跳过测试，未被用作通过依据。
- R3 的超时文案 FAIL、R4 的当时 Agnes 降级 FAIL 及 R5 的外部限流 BLOCKED 均在 `reviews/` 原样保留；R6 只在新的冷却后独立实测中关闭 Agnes 门禁。
- 当前已部署并完成技术验证，但 QQ 邮件点击后的真实浏览器会话闭环与用户业务 UAT 尚未发生，不能标记为业务验收完成。
