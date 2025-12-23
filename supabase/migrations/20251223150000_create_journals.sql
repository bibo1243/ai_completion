-- Create journals table
create table if not exists public.journals (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null default auth.uid(),
  date date not null,
  content text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  constraint journals_pkey primary key (id),
  constraint journals_user_date_key unique (user_id, date)
);

-- Enable RLS
alter table public.journals enable row level security;

-- Policies
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

-- Also ensure development policy exists if needed (for immediate testing without auth strictness)
create policy "Enable all access to journals" on public.journals for all using (true) with check (true);
