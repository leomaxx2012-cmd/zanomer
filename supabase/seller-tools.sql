-- Additional seller tools; existing listings and access policies stay intact.
begin;
alter table public.auto_listings add column if not exists sale_details jsonb not null default '{}'::jsonb;
alter table public.auto_listings add column if not exists photo_urls text[] not null default '{}';
alter table public.auto_listings drop constraint if exists auto_listings_sale_details_check;
alter table public.auto_listings add constraint auto_listings_sale_details_check check (
 jsonb_typeof(sale_details)='object' and char_length(coalesce(sale_details->>'city',''))<=80
 and coalesce(sale_details->>'storage','unspecified') in ('unspecified','vehicle','storage')
 and coalesce(sale_details->>'transfer','discuss') in ('discuss','sellerVehicle','buyerVehicle')
 and coalesce(sale_details->>'sellerType','private') in ('private','dealer')
 and (not sale_details ? 'negotiable' or jsonb_typeof(sale_details->'negotiable')='boolean')
 and cardinality(photo_urls)<=6
);
-- A different price is a separate offer; identical offers of one owner conflict.
drop index if exists public.auto_listings_unique_pending_or_active_plate_idx;
create unique index auto_listings_unique_pending_or_active_plate_idx
 on public.auto_listings(owner_id,plate_left,plate_digits,plate_right,region,vehicle_type,price_rub)
 where status in ('active','moderation');
create table if not exists public.listing_view_counts(
 listing_id uuid primary key references public.auto_listings(id) on delete cascade,
 opens bigint not null default 0 check(opens>=0)
);
alter table public.listing_view_counts enable row level security;
create or replace function public.record_listing_open(target uuid) returns void
language sql security definer set search_path=public as $$
 insert into public.listing_view_counts(listing_id,opens)
 select id,1 from public.auto_listings where id=target and status='active'
 on conflict(listing_id) do update set opens=listing_view_counts.opens+1;
$$;
revoke all on function public.record_listing_open(uuid) from public;
grant execute on function public.record_listing_open(uuid) to anon,authenticated;
create or replace function public.my_listing_open_counts() returns table(listing_id uuid,opens bigint)
language sql stable security definer set search_path=public as $$
 select a.id,coalesce(v.opens,0) from public.auto_listings a
 left join public.listing_view_counts v on v.listing_id=a.id where a.owner_id=auth.uid();
$$;
revoke all on function public.my_listing_open_counts() from public, anon;
grant execute on function public.my_listing_open_counts() to authenticated;
-- Core number data remain immutable for owners. A price change goes back to review.
create or replace function public.lock_listing_core_fields() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if old.owner_id=auth.uid() and not public.is_auto_moderator() then
  if new.plate_left is distinct from old.plate_left or new.plate_digits is distinct from old.plate_digits
    or new.plate_right is distinct from old.plate_right or new.region is distinct from old.region
    or new.vehicle_type is distinct from old.vehicle_type then raise exception 'Номер, регион и тип транспорта не редактируются после размещения';end if;
  if new.price_rub is distinct from old.price_rub and new.status<>'moderation' then
    raise exception 'Изменение цены требует повторной проверки объявления';end if;
 end if;return new;
end;$$;
commit;
select 'seller_tools_ready' as result;

