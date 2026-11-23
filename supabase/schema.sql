-- 峡谷经理人（esports-manager）Supabase 云存档建表脚本
-- 使用方式：在 Supabase Dashboard -> SQL Editor 中新建查询，粘贴以下全部内容并点击 Run。

create table if not exists public.user_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save_data jsonb not null,
  summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 开启行级安全（RLS），确保每个账号只能读写自己的云存档
alter table public.user_saves enable row level security;

drop policy if exists "Users can read own save" on public.user_saves;
create policy "Users can read own save"
  on public.user_saves for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own save" on public.user_saves;
create policy "Users can insert own save"
  on public.user_saves for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own save"
  on public.user_saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own save" on public.user_saves;
create policy "Users can delete own save"
  on public.user_saves for delete
  using (auth.uid() = user_id);
