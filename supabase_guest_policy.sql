-- Enable Realtime for tasks table
alter publication supabase_realtime add table tasks;

-- Enable Row Level Security (RLS)
alter table tasks enable row level security;

-- POLICY 1: Allow public READ access to tasks
-- This allows anyone to query tasks. In the app, we filter by user_id.
-- Security Note: This exposes all tasks to anyone who can query the API.
create policy "Allow public read access"
on tasks for select
using ( true );

-- POLICY 2: Allow public INSERT access to tasks
-- This allows anyone to create tasks.
-- Security Note: Anyone can spam tasks.
create policy "Allow public insert access"
on tasks for insert
with check ( true );

-- POLICY 3: Allow public UPDATE access to tasks
-- This allows anyone to edit tasks.
-- Security Note: Anyone can edit any task if they know the ID.
create policy "Allow public update access"
on tasks for update
using ( true );

-- POLICY 4: Allow public DELETE access to tasks (Optional)
create policy "Allow public delete access"
on tasks for delete
using ( true );
