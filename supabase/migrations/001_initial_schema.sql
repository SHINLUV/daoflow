-- ========================================
-- DaoFlow 初始数据库迁移
-- 版本: 001_initial_schema
-- 说明: 建表 + RLS策略 + 种子数据
-- 请在 Supabase SQL Editor 中执行此文件
-- ========================================

-- ===== 内容数据表（低写入） =====

-- 81章原文与解读
create table chapters (
  id smallint primary key,              -- 1-81
  original_text text not null,
  vernacular_text text not null,
  chapter_theme_tags text[],            -- 如 '{焦虑与情绪, 无为与有为}'
  preset_interpretation text not null,  -- 本地降级用的预存通用解读
  created_at timestamptz default now()
);

-- 6大主题定义
create table themes (
  id text primary key,                  -- 'anxiety', 'relationship'...
  name text not null,
  subtitle text not null,
  display_order smallint
);

-- 每日一句
create table daily_quotes (
  date date primary key,
  chapter_id smallint references chapters(id)
);

-- 本地保底降级用的关键词映射表
create table keyword_chapter_map (
  keyword text primary key,
  chapter_ids smallint[]
);

-- ===== 用户数据表（高写入，需RLS隔离） =====

-- 用户档案（关联 Supabase Auth）
create table users (
  id uuid primary key references auth.users(id),
  display_name text,
  created_at timestamptz default now()
);

-- 问道会话记录
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

-- 收藏
create table favorites (
  user_id uuid references users(id),
  chapter_id smallint references chapters(id),
  created_at timestamptz default now(),
  primary key (user_id, chapter_id)
);

-- ===== 索引 =====
create index idx_ask_sessions_user_id on ask_sessions(user_id);
create index idx_ask_sessions_created_at on ask_sessions(created_at desc);
create index idx_favorites_user_id on favorites(user_id);

-- ===== RLS 策略 =====
alter table users enable row level security;
alter table ask_sessions enable row level security;
alter table favorites enable row level security;

-- 用户只能读写自己的 ask_sessions
create policy "用户只能读写自己的问道记录" on ask_sessions
  for all using (auth.uid() = user_id);

-- 用户只能读写自己的收藏
create policy "用户只能读写自己的收藏" on favorites
  for all using (auth.uid() = user_id);

-- 用户只能读写自己的档案
create policy "用户只能读写自己的档案" on users
  for all using (auth.uid() = id);

-- 内容表（chapters, themes, daily_quotes, keyword_chapter_map）为公开只读
-- 不需要 RLS，任何人均可读取

-- ===== 触发器：新用户注册自动创建 users 记录 =====
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', '问道者'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
