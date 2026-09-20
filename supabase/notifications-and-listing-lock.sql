-- Запусти один раз в Supabase → SQL Editor.
-- 1) Сохраняет важные уведомления в аккаунте, если push задержался.
-- 2) Запрещает владельцу менять номер и цену после публикации.
-- 3) Добавляет описание для полноценной карточки модерации.

alter table public.auto_listings
  add column if not exists seller_comment text;

create or replace function public.lock_listing_core_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.owner_id = auth.uid() and not public.is_auto_moderator() then
    if new.price_rub is distinct from old.price_rub
      or new.plate_left is distinct from old.plate_left
      or new.plate_digits is distinct from old.plate_digits
      or new.plate_right is distinct from old.plate_right
      or new.region is distinct from old.region
      or new.vehicle_type is distinct from old.vehicle_type then
      raise exception 'Номер, регион, тип транспорта и цена не редактируются после размещения';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists auto_listings_lock_core_fields on public.auto_listings;
create trigger auto_listings_lock_core_fields
  before update on public.auto_listings
  for each row execute function public.lock_listing_core_fields();

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('listing-approved', 'search-alert')),
  listing_id uuid not null references public.auto_listings(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists app_notifications_owner_unread_idx
  on public.app_notifications (owner_id, created_at asc)
  where read_at is null;

alter table public.app_notifications enable row level security;

drop policy if exists "Users read own app notifications" on public.app_notifications;
create policy "Users read own app notifications"
  on public.app_notifications for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Users mark own app notifications read" on public.app_notifications;
create policy "Users mark own app notifications read"
  on public.app_notifications for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

grant select, update on public.app_notifications to authenticated;

-- Резервные уведомления для владельца и для сохранённых поисков. Они
-- появятся при следующем запуске приложения, даже если push задержался.
create or replace function public.create_listing_account_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.status = 'active')
     or (tg_op = 'UPDATE' and old.status is distinct from 'active' and new.status = 'active') then
    insert into public.app_notifications (owner_id, kind, listing_id, title, body)
    values (new.owner_id, 'listing-approved', new.id, 'Объявление одобрено', new.plate_left || ' ' || new.plate_digits || ' ' || new.plate_right || ' опубликован в каталоге');

    insert into public.app_notifications (owner_id, kind, listing_id, title, body)
    select distinct a.owner_id, 'search-alert', new.id, 'Подходящий номер появился', new.plate_left || ' ' || new.plate_digits || ' ' || new.plate_right || ' · ' || new.region
    from public.auto_search_alerts a
    where a.enabled = true
      and a.owner_id <> new.owner_id
      and (coalesce(a.left_letter, '') = '' or new.plate_left ilike replace(a.left_letter, '*', '%'))
      and (coalesce(a.right_letters, '') = '' or new.plate_right ilike replace(a.right_letters, '*', '%'))
      and (coalesce(a.digits, '') = '' or new.plate_digits ilike replace(a.digits, '*', '%'))
      and (coalesce(a.vehicle_type, '') = '' or a.vehicle_type = new.vehicle_type)
      and (coalesce(a.price_limit, 0) = 0 or new.price_rub <= a.price_limit)
      and (coalesce(a.region_code, '') = '' or new.region like '%· ' || any(string_to_array(a.region_code, ',')))
      and (coalesce(a.region_code, '') <> '' or coalesce(a.region, 'Все') = 'Все' or new.region like a.region || '%');
  end if;
  return new;
end;
$$;

drop trigger if exists auto_listings_approval_notice on public.auto_listings;
drop trigger if exists auto_listings_account_notifications on public.auto_listings;
create trigger auto_listings_account_notifications
  after insert or update of status on public.auto_listings
  for each row execute function public.create_listing_account_notifications();
