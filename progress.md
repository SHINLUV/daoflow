# DaoFlow 开发进度

## 2026-06-22 → 2026-06-23

### 已完成

#### 基础设施
- [x] Next.js 14 + TypeScript + Tailwind 项目
- [x] Supabase 客户端 + Auth middleware
- [x] .env.local 全部配置 (Agnes + DeepSeek + Supabase)
- [x] Supabase 数据库建表 + RLS + 触发器
- [x] 81章完整 JSON 数据
- [x] Seed 脚本 + 校验脚本
- [x] 43组关键词映射
- [x] 6主题导入

#### 核心逻辑
- [x] callModel.ts — Agnes/DeepSeek 统一调用 (超时/429/格式错误)
- [x] parseStructuredResponse.ts — JSON清洗+Schema校验
- [x] askDao.ts — 三级降级调度 (Agnes 8s→DeepSeek 10s→本地)
- [x] 19单元测试通过

#### API
- [x] POST /api/ask
- [x] GET /api/themes (24h缓存)
- [x] GET /api/daily-quote (边缘缓存)
- [x] GET /api/chapters/:id

#### 视觉
- [x] CloudBackground — 真实16:9水墨云海素材
- [x] TaijiSymbol — 02号素材→去底透明PNG(33%半径), 70%屏宽, 背景层
- [x] NavBar — 透明纯文字导航
- [x] AskInput — 半透明毛玻璃(35%常态, backdrop-blur)
- [x] DailyQuote — 客户端fetch
- [x] ScrollHint — 浮动箭头
- [x] ThemeMap — 去卡片化纯文字列表
- [x] /ask 结果页

#### 构建
- [x] 最终构建通过 (0错误)
- [x] 19测试通过
- [x] 开发服务器正常运行

### 待优化
- [ ] 太极图去底精细调整
- [ ] 移动端响应式
- [ ] 云层动效优化

### 待开发
- [ ] M4: Auth + 收藏 + 我的道
- [ ] M5: 阅读页
- [ ] M6: 分享卡片等
