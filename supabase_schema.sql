-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create tags table
create table public.tags (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null default auth.uid(),
  name text not null,
  parent_id uuid null,
  color text null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  constraint tags_pkey primary key (id)
);

-- Create tasks table
create table public.tasks (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null default auth.uid(),
  title text not null,
  description text null,
  status text not null default 'inbox',
  parent_id uuid null,
  start_date timestamp with time zone null,
  due_date timestamp with time zone null,
  is_project boolean default false,
  tags text[] default array[]::text[],
  color text default 'blue',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone null,
  order_index numeric default 0,
  images text[] default array[]::text[],
  
  constraint tasks_pkey primary key (id)
);

-- Enable Row Level Security (RLS)
alter table public.tags enable row level security;
alter table public.tasks enable row level security;

-- Create Policies for tags
create policy "Users can view their own tags" 
on public.tags for select 
using (auth.uid() = user_id);

create policy "Users can insert their own tags" 
on public.tags for insert 
with check (auth.uid() = user_id);

create policy "Users can update their own tags" 
on public.tags for update 
using (auth.uid() = user_id);

create policy "Users can delete their own tags" 
on public.tags for delete 
using (auth.uid() = user_id);

-- Create Policies for tasks
create policy "Users can view their own tasks" 
on public.tasks for select 
using (auth.uid() = user_id);

create policy "Users can insert their own tasks" 
on public.tasks for insert 
with check (auth.uid() = user_id);

create policy "Users can update their own tasks" 
on public.tasks for update 
using (auth.uid() = user_id);

create policy "Users can delete their own tasks" 
on public.tasks for delete 
using (auth.uid() = user_id);

-- Create Realtime publication (Optional, for live updates)
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.tags;

-- Storage setup for attachments
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload"
on storage.objects for insert
with check ( bucket_id = 'attachments' and auth.role() = 'authenticated' );

create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'attachments' );

create policy "Authenticated users can update"
on storage.objects for update
with check ( bucket_id = 'attachments' and auth.role() = 'authenticated' );

create policy "Authenticated users can delete"
on storage.objects for delete
using ( bucket_id = 'attachments' and auth.role() = 'authenticated' );
