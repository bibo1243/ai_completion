-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Ensure Tables Exist
create table if not exists public.tags (
  id uuid not null default uuid_generate_v4() primary key
);

create table if not exists public.tasks (
  id uuid not null default uuid_generate_v4() primary key
);

-- 3. Add Columns to 'tags' (Safe to run multiple times)
alter table public.tags add column if not exists user_id uuid not null default auth.uid();
alter table public.tags add column if not exists name text;
alter table public.tags add column if not exists parent_id uuid;
alter table public.tags add column if not exists color text;
alter table public.tags add column if not exists created_at timestamp with time zone default timezone('utc'::text, now()) not null;

-- 4. Add Columns to 'tasks' (Safe to run multiple times)
alter table public.tasks add column if not exists user_id uuid not null default auth.uid();
alter table public.tasks add column if not exists title text;
alter table public.tasks add column if not exists description text;
alter table public.tasks add column if not exists status text default 'inbox';
alter table public.tasks add column if not exists parent_id uuid;
alter table public.tasks add column if not exists start_date timestamp with time zone;
alter table public.tasks add column if not exists due_date timestamp with time zone;
alter table public.tasks add column if not exists is_project boolean default false;
alter table public.tasks add column if not exists tags text[] default array[]::text[];
alter table public.tasks add column if not exists color text default 'blue';
alter table public.tasks add column if not exists created_at timestamp with time zone default timezone('utc'::text, now()) not null;
alter table public.tasks add column if not exists completed_at timestamp with time zone;
alter table public.tasks add column if not exists order_index numeric default 0;

-- 5. Enable RLS
alter table public.tags enable row level security;
alter table public.tasks enable row level security;

-- 6. Policies (Drop and Recreate to ensure correctness)
drop policy if exists "Users can view their own tags" on public.tags;
create policy "Users can view their own tags" on public.tags for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own tags" on public.tags;
create policy "Users can insert their own tags" on public.tags for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own tags" on public.tags;
create policy "Users can update their own tags" on public.tags for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own tags" on public.tags;
create policy "Users can delete their own tags" on public.tags for delete using (auth.uid() = user_id);

drop policy if exists "Users can view their own tasks" on public.tasks;
create policy "Users can view their own tasks" on public.tasks for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own tasks" on public.tasks;
create policy "Users can insert their own tasks" on public.tasks for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own tasks" on public.tasks;
create policy "Users can update their own tasks" on public.tasks for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own tasks" on public.tasks;
create policy "Users can delete their own tasks" on public.tasks for delete using (auth.uid() = user_id);

-- 7. Realtime
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.tags;
