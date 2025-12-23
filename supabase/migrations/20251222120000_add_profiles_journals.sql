-- Create profiles table
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  preferences jsonb default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for profiles
alter table public.profiles enable row level security;

create policy "Users can view their own profile" 
on public.profiles for select 
using (auth.uid() = id);

create policy "Users can update their own profile" 
on public.profiles for update 
using (auth.uid() = id);

create policy "Users can insert their own profile" 
on public.profiles for insert 
with check (auth.uid() = id);

-- Create journals table
create table if not exists public.journals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  date date not null,
  content text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, date)
);

-- Enable RLS for journals
alter table public.journals enable row level security;

create policy "Users can view their own journals" 
on public.journals for select 
using (auth.uid() = user_id);

create policy "Users can insert their own journals" 
on public.journals for insert 
with check (auth.uid() = user_id);

create policy "Users can update their own journals" 
on public.journals for update 
using (auth.uid() = user_id);

create policy "Users can delete their own journals" 
on public.journals for delete 
using (auth.uid() = user_id);

-- Add realtime for journals
alter publication supabase_realtime add table public.journals;

-- Add indexes
create index if not exists journals_user_id_date_idx on public.journals (user_id, date);
create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists tasks_parent_id_idx on public.tasks (parent_id);
