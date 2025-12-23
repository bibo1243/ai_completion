-- Add images column to tasks table if it doesn't exist
alter table public.tasks add column if not exists images text[] default array[]::text[];

-- Create storage bucket for task attachments if it doesn't exist
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- Set up storage policies
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

-- Force schema cache reload for PostgREST
NOTIFY pgrst, 'reload config';
