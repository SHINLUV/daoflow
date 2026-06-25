# DaoFlow 项目上下文

## 项目简介
DaoFlow（问道）是一个《道德经》沉浸式数字阅读空间。
**设计哲学**: 不是看见道，是看见自己站在道之中。

## 技术栈
- Next.js 14 App Router (TypeScript, Tailwind CSS)
- Supabase (Postgres + Auth)
- AI: Agnes (主力, agnes-2.0-flash) → DeepSeek (备用, deepseek-chat) → 本地关键词 (保底)
- Framer Motion (动效)
- Phosphor Icons (图标)
- 思源宋体 (字体)

## 部署
- 前端: Vercel
- 数据库: Supabase (egunlbfokvqiuwtovoto.supabase.co, ap-southeast-1)
- 开发: localhost:3000

## 环境变量 (已配置)
- AGNES_API_KEY / AGNES_BASE_URL (apihub.agnes-ai.com/v1)
- DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL
- NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY

## 最近改动
2026-06-26:

### 进化循环 #1-#5 (2026-06-26 上轮)
- 每日一句提升为首屏核心钩子 (DailyQuote.tsx)
- 导航 5→3 项精简 (NavBar.tsx)
- 输入前轻量引导词 (AskInput.tsx)
- 动画降速：太极20s/山脊3s+8s (TaijiSymbol.tsx, CloudBackground.tsx)
- 每日一句一键复制分享 (DailyQuote.tsx)

### 进化循环 #6: 「我的道」MVP (2026-06-26 本轮)
- 魔法链接登录：auth/callback/route.ts + /my-dao 页面
- 历史记录 API：GET /api/me/history（最近5条）
- Ask API 关联 user_id：已登录用户自动保存会话
- NavBar "我的道" 链接从 #my-dao 改为 /my-dao

### 视觉 (Screen 1)
- 云海背景: 16:9 水墨宽屏 (bg-ink-mountain.jpg), multiply 混合
- 太极: 纯 SVG 绘制 (TaijiSymbol.tsx), 40vh 尺寸, 75-85% 透明度
- 太极动效: 20s 自旋转 + 6s 呼吸明暗
- 山脊显隐: 3 层随机显隐，显3s/隐8s/间隔7-22s
- 输入框: 半透明毛玻璃 + 3个可点击建议词
- 导航: 透明纯文字 3项 (问道/我的道/关于)

### 核心逻辑
- callModel.ts: Agnes/DeepSeek 统一封装 (超时/429/格式错误)
- parseStructuredResponse.ts: JSON防御解析+Schema校验
- askDao.ts: 三级降级调度器 (Agnes 8s→DeepSeek 10s→本地)
- API: POST /api/ask, GET /api/themes, /api/daily-quote, /api/chapters/:id, /api/me/history
- Auth: Supabase 魔法链接 + 中间件 session 刷新
- 19个单元测试全部通过

## 开发阶段
- [x] M1: 基础设施+数据库+数据导入
- [x] M2: Screen 1 + Screen 2 视觉
- [x] M3: 三级降级调度逻辑
- [x] M4: Supabase Auth + 我的道历史（魔法链接 + 最近5条 + 回看）
- [ ] M5: 阅读页
- [ ] M6: 持续迭代
