-- ЗаНомером: статусы объявлений партнёрских Telegram-каналов.
-- Объявления со статусом archived не удаляются, а скрываются из каталога.

create table if not exists public.partner_listing_statuses (
  source_url text primary key,
  status text not null default 'active' check (status in ('active', 'archived')),
  archive_reason text,
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partner_listing_statuses enable row level security;

create policy "Everyone can read partner listing statuses"
  on public.partner_listing_statuses for select
  using (true);

insert into public.partner_listing_statuses (source_url)
values
  ('https://t.me/runomer/71791'),
  ('https://t.me/runomer/71792'),
  ('https://t.me/runomer/71793'),
  ('https://t.me/runomer/71795'),
  ('https://t.me/runomer/71796'),
  ('https://t.me/runomer/71797'),
  ('https://t.me/runomer/71798'),
  ('https://t.me/runomer/71801'),
  ('https://t.me/runomer/71802'),
  ('https://t.me/runomer/71803'),
  ('https://t.me/runomer/71804'),
  ('https://t.me/runomer/71805'),
  ('https://t.me/runomer/71806'),
  ('https://t.me/runomer/71807'),
  ('https://t.me/runomer/71808')
on conflict (source_url) do nothing;
