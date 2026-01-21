-- 1. Enable Realtime for tasks table
-- Note: If you see "relation tasks is already member of publication", it means Realtime is already enabled. You can ignore that error or comment this line.
-- alter publication supabase_realtime add table tasks;

-- 2. Enable Row Level Security (RLS)
alter table tasks enable row level security;

-- 3. Create/Update Policies
-- We drop existing policies first to avoid "policy already exists" errors when re-running.

drop policy if exists "Allow public read access" on tasks;
create policy "Allow public read access"
on tasks for select
using ( true );

drop policy if exists "Allow public insert access" on tasks;
create policy "Allow public insert access"
on tasks for insert
with check ( true );

drop policy if exists "Allow public update access" on tasks;
create policy "Allow public update access"
on tasks for update
using ( true );

drop policy if exists "Allow public delete access" on tasks;
create policy "Allow public delete access"
on tasks for delete
using ( true );
