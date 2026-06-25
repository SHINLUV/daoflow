# DaoFlow 项目主纲（Claude Code 项目上下文文件）

> 使用方式：将本文件粘贴为项目根目录的 `CLAUDE.md`，或在 Claude Code 会话开始时完整粘贴一次。
> 这是项目的唯一真相来源（Single Source of Truth），后续所有执行提示词都假定 Claude Code 已读过此文件。

---

## 0. 项目简介与设计哲学

DaoFlow（问道）是一个《道德经》沉浸式数字阅读空间，不是国学门户网站、不是聊天机器人、不是资料库。

**一句话设计哲学**：不是看见道，是看见自己站在道之中。

**产品哲学（必须在Agent提示词与文案中体现）**：道德经原文是主角，AI只是讲解者，不输出建议性结论，引导用户回到原文获得自己的答案。

---

## 1. 技术栈（最终定稿）

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | Next.js 14 App Router | SSG首屏 + Server Actions/Route Handlers |
| 部署 | Vercel | 边缘网络，零配置 |
| 数据库 | Supabase Postgres + Auth | 自带认证，省去单独搭认证服务 |
| **AI主力** | **Agnes**（`agnes-2.0-flash`） | 免费，OpenAI兼容接口 |
| **AI备用** | **DeepSeek**（`deepseek-chat`） | 低成本兜底 |
| **AI保底** | 本地关键词匹配（无网络依赖） | 永不挂死的最后一层 |
| 动效 | Framer Motion | 云层/太极/文字显形动画 |
| 图标 | Phosphor Icons（线性风格） | 不填色，不加色块背景 |
| 字体 | Source Han Serif（思源宋体） | Light/Regular字重 |

**重要约束**：不使用 Anthropic/Claude API（成本原因，已决策，不再讨论）。

**⚠️ 待确认事项**：Agnes 的 base_url 在不同资料来源中出现两种写法（`https://apihub.agnes-ai.com/v1` 与 `https://api.agnes-ai.com/v1`），Agnes 本身是刚上线的新服务，文档可能变化快。**执行第一个Agnes相关任务前，先访问 platform.agnes-ai.com 控制台确认当前准确的 base_url 和可用模型名**，不要直接信任本文档写的值。

---

## 2. 视觉设计系统

### 2.1 色彩

| 用途 | 色值 |
|---|---|
| 云白（背景基底） | `#F4F5F3` |
| 雾灰（分隔线/次级背景） | `#C9CDC8` |
| 山影灰（辅助文字） | `#7A8079` |
| 远山灰蓝（边框/图标默认色） | `#5B6670` |
| 墨色（正文文字） | `#23262A` |
| 晨光金（唯一点缀色，全站占比≤2%） | `#D4B896` |
| 太极阴 | `#1A1B1E`（带5-8%噪点纹理） |
| 太极阳 | `#F4F5F3`（带5-8%噪点纹理） |

**禁止色**：红色、大面积金色、高饱和度亮色。

### 2.2 字体与间距

- 中文：思源宋体，Light/Regular字重，标题letter-spacing拉大15-20%
- 正文行高：字号×2.2；段落间距：字号×3
- 屏间留白缓冲区：≥100px
- 基础网格：8px

### 2.3 阴影与边框

- 不使用硬投影（box-shadow实体阴影），层次靠半透明叠层+高斯模糊光晕（透明度<15%）
- 边框统一1px发丝线，颜色`#C9CDC8`，透明度≤40%

### 2.4 Screen 1（首屏·问道入口）规格

**结构（从上到下）**：透明导航 → 太极符号 → 中央文案 → 输入框 → 今日一句 → 向下滚动提示

**背景层**：云海+若隐若现山脊，冷色调（黎明灰蓝），**不使用暖色铺满整屏，不放置完整可辨认人物插画细节**。

**太极符号**：
- 尺寸：屏幕高度35-40%，垂直居中偏上
- 透明度：75-85%（清晰可辨，仍带雾气感，非纯实色图标）
- 边缘：4-8px高斯模糊羽化，阴阳分界线保留基本S曲线但不是锐利矢量线
- **【v2.1】保留**传统阴阳点（两仪）：黑侧浅点、白侧深点，这是太极符号的核心构成要素，不再要求去除
- **禁止**：背后太阳光盘
- 动效：自旋转周期12秒（非匀速，呼吸式）+ 明暗呼吸周期6秒

**顶部导航**：纯文字，无背景色块，`DaoFlow` + `问道 经典 主题 老子与道 我的道`，14px量级，70%透明度，hover时下划线300ms过渡

**中央文案**：
```
此刻，
你遇到了什么？
```
56px量级，行高1.4，墨色，淡入动效800ms（位移2px）

**输入框**：
- 宽度屏宽40-50%，最小480px，高度56-64px，圆角28-32px
- Placeholder：`写下你的困惑，问道智慧`
- 聚焦态边框变为晨光金 `#D4B896`

**今日一句**：
```
今日一句
知足不辱，知止不殆。
—— 《道德经·第四十四章》
```
14px量级，山影灰色，按日期种子选取

**动效时间表**：

| 元素 | 动效 | 时长/周期 |
|---|---|---|
| 云层 | 横向漂移 | 25-35秒/层，非匀速 |
| 山脊 | 透明度渐变显隐 | 显1.5秒/隐4秒，间隔7-15秒不规律 |
| 太极 | 自旋转+呼吸明暗 | 旋转12秒/呼吸6秒 |
| 中央文案 | 淡入+位移 | 800ms，加载后0.5秒触发 |
| 输入框 | 淡入 | 600ms，加载后0.8秒触发 |
| 今日一句 | 淡入 | 600ms，加载后1.2秒触发 |

### 2.5 Screen 2（主题地图）规格

用户滚动后触发，过渡：上移800ms，云雾短暂增厚再消散。

**内容**（6个主题，保留这些命名）：

| 主题 | 副标题 |
|---|---|
| 焦虑与情绪 | 如何面对内心的不安 |
| 关系与边界 | 如何建立健康的关系 |
| 选择与决策 | 如何做出明智的选择 |
| 事业与创业 | 如何在工作中找到方向 |
| 成长与自我 | 如何成为更好的自己 |
| 无为与有为 | 如何平衡行动与等待 |

**呈现方式（关键约束）**：纯文字列表（2-3列），1px发丝线分隔，**禁止**卡片背景色块、禁止投影、禁止圆形图标背景。若用图标，必须是单色线条图标（Phosphor Icons风格），不填色不加背景。每项间留白≥32px，整体留白占比≥60%。

### 2.6 反模式检查清单（每个视觉PR必须对照）

- [ ] 出现红色（非功能性错误提示）
- [ ] 出现完整写实人物插画细节
- [ ] 太极背后有太阳光盘，或边缘是锐利矢量线、没有羽化雾气感
- [ ] 出现亭台楼阁/灯笼/桃花/仙鹤/印章
- [ ] 主题卡片用圆形色块背景+插画图标
- [ ] 卡片带明显box-shadow投影
- [ ] 首屏出现多个同等权重的交互入口
- [ ] 背景是完整暖色调写实风景画

---

## 3. 数据库设计（完整SQL）

```sql
-- ===== 内容数据（低写入） =====
create table chapters (
  id smallint primary key,              -- 1-81
  original_text text not null,
  vernacular_text text not null,
  chapter_theme_tags text[],            -- 如 ['焦虑与情绪']
  preset_interpretation text not null   -- 本地降级用的预存通用解读
);

create table themes (
  id text primary key,                  -- 'anxiety', 'relationship'...
  name text not null,
  subtitle text not null,
  display_order smallint
);

create table daily_quotes (
  date date primary key,
  chapter_id smallint references chapters(id)
);

-- 本地保底降级用的关键词映射表
create table keyword_chapter_map (
  keyword text primary key,
  chapter_ids smallint[]
);

-- ===== 用户数据（高写入，需RLS隔离） =====
create table users (
  id uuid primary key references auth.users(id),
  display_name text,
  created_at timestamptz default now()
);

create table ask_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  question text not null,
  matched_chapter_id smallint references chapters(id),
  ai_response text not null,
  follow_up_question text,
  ai_provider text,                     -- 'agnes' | 'deepseek' | 'local_fallback'
  degraded boolean default false,
  fallback_reason text,                 -- 'timeout' | 'rate_limited' | 'format_error' | null
  created_at timestamptz default now()
);

create table favorites (
  user_id uuid references users(id),
  chapter_id smallint references chapters(id),
  created_at timestamptz default now(),
  primary key (user_id, chapter_id)
);

-- RLS策略示例
alter table users enable row level security;
alter table ask_sessions enable row level security;
alter table favorites enable row level security;

create policy "用户只能读写自己的数据" on ask_sessions
  for all using (auth.uid() = user_id);
create policy "用户只能读写自己的收藏" on favorites
  for all using (auth.uid() = user_id);
```

---

## 4. API设计

```
POST /api/ask
  body: { question: string }
  → {
      matchedChapter, originalText, interpretation,
      followUpQuestion, sessionId,
      meta: { provider: 'agnes'|'deepseek'|'local_fallback', degraded: boolean }
    }

GET  /api/chapters/:id
  → { originalText, vernacularText, prevId, nextId }

GET  /api/themes
  → 6个主题列表（可缓存24h）

GET  /api/daily-quote
  → 今日一句（可边缘缓存到当天结束）

GET  /api/me/history
  → 我的道·问道记录（需鉴权）

POST /api/favorites          body: { chapterId }
DELETE /api/favorites/:chapterId
```

---

## 5. Agent与三级降级链设计（核心逻辑）

### 5.1 调用链路

```
askDao(question)
  │
  ├─ 第一级：Agnes (agnes-2.0-flash)，timeout=8s
  │    成功且通过Schema校验 → 返回，provider='agnes'
  │    超时/429/格式错误 → 记录原因，进入第二级
  │
  ├─ 第二级：DeepSeek (deepseek-chat)，timeout=10s
  │    成功且通过Schema校验 → 返回，provider='deepseek'
  │    超时/429/格式错误 → 记录原因，进入第三级
  │
  └─ 第三级：本地关键词匹配，无网络调用
       keywordMatch(question) → 命中chapter → 返回该章预存解读
       provider='local_fallback', degraded=true
```

**关键原则**：每一级不重试，失败即向下一级降级，控制总延迟上限（建议总预算≤20秒），避免用户长时间等待。

### 5.2 统一调用封装（约束Claude Code如何实现）

- 三个供应商共用一套调用代码，只切换 `base_url` / `api_key` / `model`，统一通过 `openai` SDK 调用（Agnes与DeepSeek均兼容OpenAI Chat Completions格式）
- System Prompt 内嵌81章全文（约3万字）+ 严格要求"只返回JSON，不要markdown代码块包裹，不要任何前后说明文字"
- 返回后做防御性清洗：先尝试 `JSON.parse`，失败则去除可能存在的 ```json 包裹再重新解析
- Schema校验：`matched_chapter` 必须是1-81之间的整数，否则视为格式错误，触发降级
- 期望输出JSON结构：
```json
{
  "matched_chapter": 44,
  "interpretation": "不超过4句的白话解读",
  "follow_up_question": "引导反思的反问句"
}
```

### 5.3 Agent System Prompt 要点（写入实际Prompt时必须包含）

- 角色设定：你是《道德经》的讲解者，不是心理咨询师，不输出建议性结论
- 任务：根据用户的困惑，从81章中匹配最相关的一章，给出不超过4句的白话解读，并提出一个引导用户自我反思的反问句
- 输出格式：严格只返回上述JSON结构，不要任何其他文字

### 5.4 本地保底数据示例（需扩充，仅供参考起点）

```sql
insert into keyword_chapter_map (keyword, chapter_ids) values
  ('迷茫', ARRAY[33,71]),
  ('焦虑', ARRAY[44,46]),
  ('选择', ARRAY[64,2]),
  ('辞职', ARRAY[64,9]),
  ('关系', ARRAY[8,66]),
  ('自责', ARRAY[8,33]),
  ('害怕失败', ARRAY[9,44]),
  ('不知道怎么办', ARRAY[64,33]);
```

⚠️ 此表内容需要结合《道德经》实际内容人工扩充审核后才能上线，AI辅助生成草稿可以，但发布前必须人工过一遍语义匹配是否合理。

---

## 6. 环境变量清单

```
AGNES_API_KEY=
AGNES_BASE_URL=          # 上线前在platform.agnes-ai.com确认准确值
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

所有Key必须存在环境变量/Vercel环境配置中，不得硬编码进代码。

---

## 7. 开发阶段拆解

| 阶段 | 目标 |
|---|---|
| M1 | 基础设施+建表+81章数据导入+本地关键词映射表（保底功能最先做） |
| M2 | Screen 1 + Screen 2 视觉还原 |
| M3 | 三级降级调度逻辑（先写骨架测试，再接真实Agnes/DeepSeek） |
| M4 | Supabase Auth + 收藏 + 我的道历史 |
| M5 | 阅读页（待专门设计稿产出后执行） |
| M6 | 持续迭代：分享卡片、主题深度内容等 |
