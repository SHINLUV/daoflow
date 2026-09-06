# DaoFlow · 问道

以生活困惑为入口，连接《道德经》原文、简短解读和自我反思的响应式网站。

## 产品与设计资料

完整资料见 [docs 目录](docs/README.md)，包含产品全景、功能与实现边界、设计理念、页面截图、返工思考，以及 PDF 和独立 HTML 阅读版。

## 当前功能

- 困惑输入、主题预览、篇章匹配与解读
- 81 章原文和白话译文阅读
- 每日一句与复制
- 邮箱链接登录及最近 5 条问道记录
- 电脑、手机适配与错误重试

当前问道是单次请求；AI 真实效果与登录后同步的验证边界详见产品资料。

## 本地运行

使用 Node.js 与 npm，先执行 `npm ci`。在本地 `.env.local` 配置以下变量，不要提交真实值：

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- AGNES_API_KEY、AGNES_BASE_URL
- DEEPSEEK_API_KEY、DEEPSEEK_BASE_URL

开发：`npm run dev`

生产预览：`npm run build`，然后 `npm run start -- --hostname 127.0.0.1 --port 3100`

运行历史章节导入脚本前，另外设置 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY 到进程环境；导入凭据仅在服务端使用。

## 维护说明

使用 Next.js、React、Tailwind CSS、Supabase 和兼容 OpenAI 的模型接口。字体许可见 src/app/fonts/Noto-OFL.txt。

此前导入脚本中的硬编码凭据已移除，历史版本中的旧值仍需仓库所有者在服务端撤销或轮换。此次提交未改写 Git 历史。