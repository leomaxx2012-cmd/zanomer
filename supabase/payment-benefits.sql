-- Run after payments.sql. Purchases are credited only when verified as succeeded.
create table if not exists public.listing_promotion_uses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  listing_id uuid not null references public.auto_listings(id),
  kind text not null check (kind in ('highlight', 'hot')),
  created_at timestamptz not null default now()
);
alter table public.listing_promotion_uses enable row level security;
create or replace function public.get_payment_benefits()
returns jsonb language plpgsql security definer set search_path = public as $$
declare highlights integer; hot integer; expiry timestamptz; purchase record;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select coalesce(sum(case service_code when 'highlight_48h' then 1 when 'highlight_pack_5' then 5 when 'plus_month' then 1 else 0 end),0),
         coalesce(sum(case service_code when 'hot_listing' then 1 when 'hot_pack_5' then 5 else 0 end),0)
  into highlights, hot from service_payments where owner_id=auth.uid() and status='succeeded';
  highlights := highlights - (select count(*) from listing_promotion_uses where owner_id=auth.uid() and kind='highlight');
  hot := hot - (select count(*) from listing_promotion_uses where owner_id=auth.uid() and kind='hot');
  for purchase in select paid_at from service_payments where owner_id=auth.uid() and status='succeeded' and service_code='plus_month' order by paid_at loop
    expiry := greatest(coalesce(expiry,purchase.paid_at),purchase.paid_at) + interval '30 days';
  end loop;
  return jsonb_build_object('highlights', highlights, 'hot', hot, 'plus_until', expiry);
end $$;
create or replace function public.apply_listing_promotion(listing uuid, promotion text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare benefits jsonb; item public.auto_listings; expires timestamptz;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  -- Serialize all spending by this account, including simultaneous requests.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into item from auto_listings where id=listing and owner_id=auth.uid() for update;
  if item.id is null or item.status <> 'active' then raise exception 'Listing must be active'; end if;
  benefits := get_payment_benefits();
  if promotion not in ('highlight','hot') or coalesce((benefits->>case when promotion='highlight' then 'highlights' else 'hot' end)::integer,0) < 1 then
    raise exception 'No purchased promotions available';
  end if;
  if item.featured_until >= '9999-01-01'::timestamptz then raise exception 'Already permanently promoted'; end if;
  expires := case when promotion='hot' then '9999-12-31T23:59:59Z'::timestamptz else greatest(now(),coalesce(item.featured_until,now())) + interval '48 hours' end;
  insert into listing_promotion_uses(owner_id,listing_id,kind) values(auth.uid(),listing,promotion);
  perform set_config('app.applying_promotion','yes',true);
  update auto_listings set featured_until=expires where id=listing;
  return expires;
end $$;
create or replace function public.protect_listing_promotion()
returns trigger language plpgsql as $$
begin
  if current_user in ('anon','authenticated') and
     (case when TG_OP='INSERT' then new.featured_until is not null else new.featured_until is distinct from old.featured_until end) then
    raise exception 'Use purchased promotions';
  end if;
  return new;
end $$;
drop trigger if exists protect_listing_promotion on public.auto_listings;
create trigger protect_listing_promotion before insert or update on public.auto_listings for each row execute function public.protect_listing_promotion();
revoke all on function public.get_payment_benefits() from public;
revoke all on function public.apply_listing_promotion(uuid,text) from public;
grant execute on function public.get_payment_benefits() to authenticated;
grant execute on function public.apply_listing_promotion(uuid,text) to authenticated;
