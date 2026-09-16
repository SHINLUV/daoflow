# Agnes API 与格式独立验收

验收角色：未参与开发的 `independent_reacceptance`

候选：`42ae7401dbf44eb147e1a840db98c8b0fef30fdb`

结论：**PASS（仅限 Agnes API/回答格式生产切片）**

## 代码与测试

- 上一轮 `0a02faf` 的两个阻断用例已重现并关闭：空格/标点归一化后必须返回 approved evidence 连续原文切片；伪造前缀、后缀或中间省略号片段必须整体拒绝。
- `answerV2` 与 `generateAnswerV2` 定向测试 22/22；全量测试 224 passed、14 skipped；TypeScript、ESLint、47/47 页面生产构建通过。
- `opencc-js` 精确锁定 `1.4.2`；只用于定位繁简体对应位置，不替代 source-offset 证明。
- 独立虚拟时钟确认 60 秒单次预算、15 秒退避、140 秒总预算确实容纳两个完整尝试；最大 jitter 仍小于总预算；上游 `Retry-After` 优先；401/403 不重试；最多两次；失败保持 `provider:none/model:null`。

## 生产运行

- 两次 `/api/health` 均 HTTP 200，release 精确匹配候选。
- 远端 HEAD、master、feature ref 均为候选；current release、app 镜像和 ask-worker 镜像均绑定候选，两个容器 running/healthy。
- 独立创建匿名会话和 CSRF 后，仅提交一次虚构普通问题：HTTP 200，约 10.97 秒，`provider=agnes`，`answerV2.status=answer`，3 条 citation，2 条非空行动；summary、interpretation、application、boundary、reflection 全部非空。
- 没有接受 503、静态答案、其他模型或管理员请求作为通过证据；没有读取用户私有数据，也没有输出 Cookie、CSRF、密钥或完整回答正文。

## 验收边界

此 PASS 不代表 DaoFlow 全产品、真实邮箱认证、双账户 RLS、大厅工作流、完整质量题集或业务 UAT 通过。工作树受版本控制部分与 index 干净；仅保留既有未跟踪 `.superpowers/`，验收员未读取或修改该目录。
