-- Create profiles table
create table public.profiles (
  id uuid not null references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  preferences jsonb default '{}'::jsonb,
  updated_at timestamp with time zone,
  
  constraint profiles_pkey primary key (id)
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
create table public.journals (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null default auth.uid(),
  date date not null,
  content text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  constraint journals_pkey primary key (id)
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

-- Enable Realtime
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.journals;

-- Function to handle new user signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
