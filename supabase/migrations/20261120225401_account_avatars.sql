-- Per-agent avatar selection and server-owned custom image uploads.
-- The bucket has public READ access for selected profile pictures.
-- No anonymous or authenticated uploads are granted; only the Worker service key writes.
alter table public.agents add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('archive-avatars', 'archive-avatars', true, 150000, array['image/jpeg']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
