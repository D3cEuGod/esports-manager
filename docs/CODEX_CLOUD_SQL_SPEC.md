# Codex 规格：修复 Supabase 云存档权限（v2.1.15）

## 背景（已查实）
- 线上请求 `GET /rest/v1/user_saves` 返回 `{"code":"42501","message":"permission denied for table user_saves"}`。
  表存在，但没有对 API 角色授予表级权限（新版 Supabase 项目不会再自动给 public 新表授权）。
- 前端 `src/cloud.js` 的 `syncOnLaunch` 把 `42501 / PGRST205 / 42P01` 映射为“云端存档接口不可用，进度已存本地”，这就是用户看到的提示。
- `supabase/schema.sql` 第 24–27 行语法错误：
  `drop policy if exists "Users can update own save"` 后面直接接 `on ... for update using ...`，缺少分号和 `create policy`。
  整段脚本在 SQL Editor 中会整体失败，因此 update 策略从未创建。

## 要做的事
1. 新建 `supabase/migrations/20261128_user_saves_grants.sql`（可重复执行），内容至少包含：
   ```sql
   -- 只给已登录用户表权限，游客 anon 不可访问
   revoke all on table public.user_saves from anon;
   grant select, insert, update, delete on table public.user_saves to authenticated;

   alter table public.user_saves enable row level security;

   drop policy if exists "Users can read own save" on public.user_saves;
   create policy "Users can read own save" on public.user_saves
     for select to authenticated using (auth.uid() = user_id);

   drop policy if exists "Users can insert own save" on public.user_saves;
   create policy "Users can insert own save" on public.user_saves
     for insert to authenticated with check (auth.uid() = user_id);

   drop policy if exists "Users can update own save" on public.user_saves;
   create policy "Users can update own save" on public.user_saves
     for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

   drop policy if exists "Users can delete own save" on public.user_saves;
   create policy "Users can delete own save" on public.user_saves
     for delete to authenticated using (auth.uid() = user_id);

   notify pgrst, 'reload schema';
   ```
2. 修好 `supabase/schema.sql`：修正 update 策略语法，并把第 1 条里的 grant/revoke 合进去，使“新建项目一次跑完即可用”。
3. README 第 25 行附近补一句：已有项目只需运行 migrations 下的文件。

## 前端依赖的行为（不要改变）
- `cloud.js` 的写入方式：首次 `POST ...?on_conflict=user_id` + `Prefer: resolution=ignore-duplicates,return=representation`；
  之后 `PATCH ...?user_id=eq.<uid>&updated_at=eq.<observed>` + `return=representation`，靠返回空数组判断并发冲突。
  因此 authenticated 必须同时有 INSERT、UPDATE、SELECT（return=representation 需要 SELECT）。
- 字段：`user_id uuid PK`、`save_data jsonb`、`summary jsonb`、`updated_at timestamptz`，不要改名。

## 验收
- 用 anon key、不带登录令牌请求 `GET /rest/v1/user_saves`：应返回 401/42501（游客不可读）。
- 登录后（带 `Authorization: Bearer <access_token>`）GET 返回 `[]` 或自己那一行；POST/PATCH 成功返回一行。
- 迁移文件连续运行两次都不报错。

## 运行
Codex 只负责写文件；由用户（或 Claude 在用户确认后）复制到 Supabase Dashboard → SQL Editor 运行。
