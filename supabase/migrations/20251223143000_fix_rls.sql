-- Drop existing restrictive policies on tags
drop policy if exists "Users can view their own tags" on public.tags;
drop policy if exists "Users can insert their own tags" on public.tags;
drop policy if exists "Users can update their own tags" on public.tags;
drop policy if exists "Users can delete their own tags" on public.tags;

-- Drop existing restrictive policies on tasks (just in case)
drop policy if exists "Users can view their own tasks" on public.tasks;
drop policy if exists "Users can insert their own tasks" on public.tasks;
drop policy if exists "Users can update their own tasks" on public.tasks;
drop policy if exists "Users can delete their own tasks" on public.tasks;

-- Create permissive policies for development (Allow all operations)
create policy "Enable all access to tags" on public.tags for all using (true) with check (true);
create policy "Enable all access to tasks" on public.tasks for all using (true) with check (true);
