-- Постоянные уведомления о поисках. Они принадлежат пользователю и могут
-- обрабатываться ночным импортом даже когда приложение закрыто.
create table if not exists public.auto_search_alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  left_letter text not null default '',
  right_letters text not null default '',
  digits text not null default '',
  region text not null default 'Все',
  region_code text not null default '',
  vehicle_type text not null default 'car' check (vehicle_type in ('car', 'motorcycle', 'truck')),
  price_limit integer not null default 0 check (price_limit >= 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists auto_search_alerts_unique_search_idx
  on public.auto_search_alerts (owner_id, left_letter, right_letters, digits, region, region_code, vehicle_type, price_limit);
create index if not exists auto_search_alerts_enabled_idx
  on public.auto_search_alerts (enabled) where enabled;

alter table public.auto_search_alerts enable row level security;

drop policy if exists "Users manage their own search alerts" on public.auto_search_alerts;
create policy "Users manage their own search alerts"
  on public.auto_search_alerts for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
