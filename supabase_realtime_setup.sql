-- 1. Realtime Configuration
-- We comment this out since it's already enabled (ERROR: 42710)
-- alter publication supabase_realtime add table tasks;

-- 2. Enable Row Level Security (RLS)
alter table tasks enable row level security;

-- 3. Grant Permissions to Roles
-- This ensures 'anon' (Guest) can actually access the table
grant all on table tasks to anon;
grant all on table tasks to authenticated;
grant all on table tasks to service_role;

-- 4. Reset Policies (The most important part)
-- We drop and recreate policies to ensure clean access rules.

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
