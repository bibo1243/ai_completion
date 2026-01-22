-- Create table for storing schedule snapshots (short URL support)
create table if not exists public.schedule_snapshots (
  id uuid not null default uuid_generate_v4(),
  created_by uuid null default auth.uid(), -- user who created the snapshot
  data jsonb not null, -- The entire state (tasks + tags + date)
  title text null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  constraint schedule_snapshots_pkey primary key (id)
);

-- Enable RLS
alter table public.schedule_snapshots enable row level security;

-- Policies

-- Public read access (anyone with the link/ID can view)
create policy "Public can view snapshots" 
on public.schedule_snapshots for select 
using (true);

-- Authenticated insert access
create policy "Authenticated users can create snapshots" 
on public.schedule_snapshots for insert 
with check (auth.role() = 'authenticated');

-- Optional: Allow users to delete their own snapshots
create policy "Users can delete their own snapshots" 
on public.schedule_snapshots for delete 
using (auth.uid() = created_by);
