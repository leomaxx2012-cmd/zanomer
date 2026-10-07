-- Run after payment-benefits.sql and notifications-and-listing-lock.sql.
-- Favorites may reference either UUID site listings or text partner IDs.
begin;
create table if not exists public.favorite_price_watches (
  owner_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, listing_id)
);
alter table public.favorite_price_watches enable row level security;
drop policy if exists "Read own price watches" on public.favorite_price_watches;
create policy "Read own price watches" on public.favorite_price_watches
  for select to authenticated using (owner_id = auth.uid());
grant select on public.favorite_price_watches to authenticated;

create or replace function public.set_favorite_price_watch(listing text, enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if not enabled then
    delete from favorite_price_watches where owner_id=auth.uid() and listing_id=listing;
    return;
  end if;
  if not exists(select 1 from favorite_price_watches where owner_id=auth.uid() and listing_id=listing)
     and (select count(*) from favorite_price_watches where owner_id=auth.uid()) >= 30 then
    raise exception 'Favorite limit reached';
  end if;
  if not exists(select 1 from auto_listings where id::text=listing and status='active')
     and not exists(select 1 from partner_listings where id=listing and status='active') then
    raise exception 'Listing not available';
  end if;
  insert into favorite_price_watches(owner_id,listing_id) values(auth.uid(),listing) on conflict do nothing;
end $$;
revoke all on function public.set_favorite_price_watch(text,boolean) from public;
grant execute on function public.set_favorite_price_watch(text,boolean) to authenticated;

-- Text IDs are necessary for partner listing notifications.
alter table public.app_notifications drop constraint if exists app_notifications_listing_id_fkey;
alter table public.app_notifications alter column listing_id type text using listing_id::text;
alter table public.app_notifications drop constraint if exists app_notifications_kind_check;
alter table public.app_notifications add constraint app_notifications_kind_check
  check(kind in ('listing-approved','search-alert','price-drop'));

create or replace function public.notify_favorite_price_drop()
returns trigger language plpgsql security definer set search_path=public as $$
declare watcher record; expiry timestamptz; purchase record;
begin
  if new.status <> 'active' or new.price_rub >= old.price_rub then return new; end if;
  for watcher in select owner_id from favorite_price_watches where listing_id=new.id::text loop
    expiry := null;
    for purchase in select paid_at from service_payments where owner_id=watcher.owner_id
      and status='succeeded' and service_code='plus_month' order by paid_at loop
      expiry := greatest(coalesce(expiry,purchase.paid_at),purchase.paid_at)+interval '30 days';
    end loop;
    if expiry > now() then
      insert into app_notifications(owner_id,kind,listing_id,title,body)
      values(watcher.owner_id,'price-drop',new.id::text,'Цена избранного номера снизилась',
        concat_ws(' ',new.plate_left,new.plate_digits,new.plate_right) || ' · ' || new.region ||
        ': ' || old.price_rub || ' ₽ → ' || new.price_rub || ' ₽');
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists auto_favorite_price_drop on public.auto_listings;
create trigger auto_favorite_price_drop after update of price_rub on public.auto_listings
  for each row execute function public.notify_favorite_price_drop();
drop trigger if exists partner_favorite_price_drop on public.partner_listings;
create trigger partner_favorite_price_drop after update of price_rub on public.partner_listings
  for each row execute function public.notify_favorite_price_drop();

-- Repeated verified webhook delivery must not restart an already paid period.
create or replace function public.keep_confirmed_payment_time()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.status='succeeded' and old.paid_at is not null then
    new.status := old.status;
    new.paid_at := old.paid_at;
  end if;
  return new;
end $$;
drop trigger if exists keep_confirmed_payment_time on public.service_payments;
create trigger keep_confirmed_payment_time before update on public.service_payments
  for each row execute function public.keep_confirmed_payment_time();
commit;
