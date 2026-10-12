-- Keep private media infrastructure reproducible across clean Supabase installs.
-- Each user can access only objects stored under their own auth user ID folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('finance-photos', 'finance-photos', false, 20971520,
   array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif']),
  ('profile-media', 'profile-media', false, 20971520,
   array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif'])
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists pos_finance_photos_select_own on storage.objects;
create policy pos_finance_photos_select_own
on storage.objects for select to authenticated
using (bucket_id = 'finance-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists pos_finance_photos_insert_own on storage.objects;
create policy pos_finance_photos_insert_own
on storage.objects for insert to authenticated
with check (bucket_id = 'finance-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists pos_finance_photos_update_own on storage.objects;
create policy pos_finance_photos_update_own
on storage.objects for update to authenticated
using (bucket_id = 'finance-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'finance-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists pos_finance_photos_delete_own on storage.objects;
create policy pos_finance_photos_delete_own
on storage.objects for delete to authenticated
using (bucket_id = 'finance-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists pos_profile_media_select_own on storage.objects;
create policy pos_profile_media_select_own
on storage.objects for select to authenticated
using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists pos_profile_media_insert_own on storage.objects;
create policy pos_profile_media_insert_own
on storage.objects for insert to authenticated
with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists pos_profile_media_update_own on storage.objects;
create policy pos_profile_media_update_own
on storage.objects for update to authenticated
using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists pos_profile_media_delete_own on storage.objects;
create policy pos_profile_media_delete_own
on storage.objects for delete to authenticated
using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
