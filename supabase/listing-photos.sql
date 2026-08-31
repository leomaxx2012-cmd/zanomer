-- Фото пользовательских объявлений. Выполни один раз в Supabase → SQL Editor.

alter table public.auto_listings
  add column if not exists photo_url text;

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone views listing photos" on storage.objects;
create policy "Anyone views listing photos"
  on storage.objects for select using (bucket_id = 'listing-photos');

drop policy if exists "Users upload their own listing photos" on storage.objects;
create policy "Users upload their own listing photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update their own listing photos" on storage.objects;
create policy "Users update their own listing photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete their own listing photos" on storage.objects;
create policy "Users delete their own listing photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
