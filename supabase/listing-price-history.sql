-- История цен для ЗаНомером. Выполни один раз в Supabase → SQL Editor.
-- Сюда записываются только реальные текущие цены и их последующие изменения.

create table if not exists public.listing_price_history (
  id bigint generated always as identity primary key,
  listing_id text not null,
  price_rub integer not null check (price_rub > 0),
  recorded_at timestamptz not null default now()
);

create index if not exists listing_price_history_listing_recorded_idx
  on public.listing_price_history (listing_id, recorded_at asc);

alter table public.listing_price_history enable row level security;

drop policy if exists "Everyone can read price history" on public.listing_price_history;
create policy "Everyone can read price history"
  on public.listing_price_history for select using (true);

create or replace function public.remember_listing_price()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.price_rub is distinct from old.price_rub then
    insert into public.listing_price_history (listing_id, price_rub)
    values (new.id::text, new.price_rub);
  end if;
  return new;
end;
$$;

drop trigger if exists auto_listings_price_history on public.auto_listings;
create trigger auto_listings_price_history
  after insert or update of price_rub on public.auto_listings
  for each row execute function public.remember_listing_price();

drop trigger if exists partner_listings_price_history on public.partner_listings;
create trigger partner_listings_price_history
  after insert or update of price_rub on public.partner_listings
  for each row execute function public.remember_listing_price();

-- Добавляем начальную точку для уже загруженных объявлений.
insert into public.listing_price_history (listing_id, price_rub, recorded_at)
select id::text, price_rub, created_at from public.auto_listings a
where not exists (
  select 1 from public.listing_price_history h where h.listing_id = a.id::text
);

insert into public.listing_price_history (listing_id, price_rub, recorded_at)
select id::text, price_rub, created_at from public.partner_listings p
where not exists (
  select 1 from public.listing_price_history h where h.listing_id = p.id::text
);
