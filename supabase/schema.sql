-- ЗаНомером: выполни этот файл в Supabase → SQL Editor → New query → Run.
-- В таблицу попадают только объявления, которые владельцы добавляют сами.

create table if not exists public.auto_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  plate_left text not null check (char_length(plate_left) = 1),
  plate_digits text not null check (plate_digits ~ '^[0-9]{3}$'),
  plate_right text not null check (char_length(plate_right) = 2),
  region text not null,
  vehicle_type text not null default 'car' check (vehicle_type in ('car', 'motorcycle', 'truck')),
  price_rub integer not null check (price_rub > 0),
  featured_until timestamptz,
  status text not null default 'active' check (status in ('active', 'archived', 'moderation')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.auto_listings add column if not exists featured_until timestamptz;

create index if not exists auto_listings_active_created_idx
  on public.auto_listings (status, created_at desc);
create index if not exists auto_listings_active_price_idx
  on public.auto_listings (status, price_rub);
create index if not exists auto_listings_plate_idx
  on public.auto_listings (plate_left, plate_digits, plate_right);

alter table public.auto_listings enable row level security;

create policy "Everyone can read active listings"
  on public.auto_listings for select
  using (status = 'active' or owner_id = auth.uid());

create policy "Users add only their listings"
  on public.auto_listings for insert to authenticated
  with check (owner_id = auth.uid());

create policy "Users edit only their listings"
  on public.auto_listings for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Users delete only their listings"
  on public.auto_listings for delete to authenticated
  using (owner_id = auth.uid());

-- Публичные имена пользователей. Индекс запрещает дубли даже при
-- одновременной регистрации двух людей.
create table if not exists public.auto_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(trim(username)) between 2 and 32),
  created_at timestamptz not null default now()
);

create unique index if not exists auto_profiles_username_unique_idx
  on public.auto_profiles (lower(username));

alter table public.auto_profiles enable row level security;

create policy "Everyone can check usernames"
  on public.auto_profiles for select
  using (true);

create policy "Users create only their profile"
  on public.auto_profiles for insert to authenticated
  with check (id = auth.uid());

create policy "Users edit only their profile"
  on public.auto_profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
