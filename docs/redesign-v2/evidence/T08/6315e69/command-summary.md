# T08 · 集成与工程验证证据

候选提交：`6315e69e3944bc1157bf7eb4e8c718acc516d89b`  
本地生产地址：`http://127.0.0.1:3200`  
日期：2026-09-09

## 已执行并通过

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 单元/组件 | PASS | `npm test`：7 files、38 passed、14 skipped |
| 静态检查 | PASS | `npm run lint`：No ESLint warnings or errors |
| 生产构建 | PASS | `npm run build`：20/20 static pages generated |
| 生产浏览器 | PASS_WITH_BLOCKERS | `npm run test:e2e:production -- --workers=1`：6 passed、3 skipped |
| 动效与导航 | PASS | 4 项：墨迹转场、修饰键原生导航、移动输入与无横向溢出、六境选择/减弱动效 |
| 移动性能 | PASS | Lighthouse：87 / 92 / 93，原始 JSON 位于 `output/lighthouse/mobile-font-fallback-{1,2,3}.json` |
| 最终桌面截图 | PASS | `output/acceptance/daoflow-v2-final-desktop-1440x900.png` |
| 最终手机截图 | PASS | `output/acceptance/daoflow-v2-final-mobile-390x844.png` |
| 关键动效录屏 | PASS | `output/playwright-production/visual-motion-DaoFlow-V2-v-1b755-s-and-releases-its-watchdog/video.webm` |

## 明确保留的 BLOCKED

1. Docker Desktop 的 Linux daemon 在本机不可用，因此 Supabase 的隔离启动和迁移 `003`、`004`、`005`、`006` 未实际执行。
2. 当前进程无 Supabase 公共配置、service role 或 OpenAI API Key。真实登录、两用户隔离、RLS、RPC 原子性、持久化刷新、导出数据与模型调用不能以本地降级流程代替。
3. Playwright 的三项已跳过用例明确标有上述前置条件；它们不是通过，也不是失败后的静默跳过。

## 已修复的失败与复验

| 轮次 | 发现 | 处理 | 复验 |
| --- | --- | --- | --- |
| R1 | 生产页面六境装饰图截获顶部“读经典”导航点击 | `5e8dce7` 提高导航堆叠层级、关闭装饰图片/蒙层 pointer events | 生产动效/导航 4/4 通过 |
| R2 | 移动 Lighthouse 72 / 69 / 69，低于 85 | `6315e69` 使用响应式图像质量、非关键图层压缩、系统宋体回退、`sharp` | 87 / 92 / 93，通过 |

Lighthouse 每轮报告均已落盘并解析。Windows Chrome 临时目录清理的 EPERM 发生在报告生成后，作为工具环境限制保留，不将其描述为一次完全零错误的 Lighthouse 进程退出。
