-- ЗаНомером: история оплат услуг. Выполнить один раз в Supabase SQL Editor.
create table if not exists public.service_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'yookassa',
  provider_payment_id text unique,
  service_code text not null check (service_code in ('plus_month', 'highlight_48h', 'highlight_pack_5', 'hot_listing', 'hot_pack_5')),
  amount_kopecks integer not null check (amount_kopecks > 0),
  currency text not null default 'RUB',
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'canceled')),
  confirmation_url text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists service_payments_owner_created_idx on public.service_payments (owner_id, created_at desc);
alter table public.service_payments enable row level security;

drop policy if exists "Users view own service payments" on public.service_payments;
create policy "Users view own service payments"
  on public.service_payments for select to authenticated using (owner_id = auth.uid());
