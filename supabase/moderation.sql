-- Модерация ЗаНомером. Выполни один раз в Supabase → SQL Editor.
-- Новые объявления всегда идут на проверку; активировать их может только модератор.

alter table public.auto_listings
  add column if not exists moderation_note text,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references auth.users(id);

create table if not exists public.auto_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.auto_moderators enable row level security;

create or replace function public.is_auto_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.auto_moderators where user_id = auth.uid());
$$;

-- Один владелец не может продублировать свой же номер, но разные люди могут
-- публиковать один и тот же номер как отдельные предложения.
drop index if exists public.auto_listings_unique_pending_or_active_plate_idx;
create unique index if not exists auto_listings_unique_pending_or_active_plate_idx
  on public.auto_listings (owner_id, plate_left, plate_digits, plate_right, region)
  where status in ('active', 'moderation');

drop policy if exists "Users add only their listings" on public.auto_listings;
drop policy if exists "Users submit listings for moderation" on public.auto_listings;
create policy "Users submit listings for moderation"
  on public.auto_listings for insert to authenticated
  with check (owner_id = auth.uid() and status = 'moderation');

drop policy if exists "Users edit only their listings" on public.auto_listings;
drop policy if exists "Users edit only pending or archived listings" on public.auto_listings;
create policy "Users edit only pending or archived listings"
  on public.auto_listings for update to authenticated
  using (owner_id = auth.uid() and status in ('active', 'moderation', 'archived'))
  with check (owner_id = auth.uid() and status in ('moderation', 'archived'));

drop policy if exists "Moderators can review all listings" on public.auto_listings;
create policy "Moderators can review all listings"
  on public.auto_listings for all to authenticated
  using (public.is_auto_moderator())
  with check (public.is_auto_moderator());

drop policy if exists "Moderators can see their role" on public.auto_moderators;
create policy "Moderators can see their role"
  on public.auto_moderators for select to authenticated
  using (user_id = auth.uid());

-- Вызывать из защищённой админ-панели или SQL Editor.
create or replace function public.review_auto_listing(
  listing uuid,
  new_status text,
  note text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_auto_moderator() then
    raise exception 'Недостаточно прав для модерации';
  end if;
  if new_status not in ('active', 'archived') then
    raise exception 'Разрешены только статусы active или archived';
  end if;
  update public.auto_listings
  set status = new_status,
      moderation_note = nullif(trim(note), ''),
      moderated_at = now(),
      moderated_by = auth.uid(),
      updated_at = now()
  where id = listing;
end;
$$;

-- Один раз добавь свой аккаунт в модераторы, подставив свою почту:
-- insert into public.auto_moderators (user_id)
-- select id from auth.users where email = 'твой-email@example.com'
-- on conflict do nothing;
