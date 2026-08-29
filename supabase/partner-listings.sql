-- Партнёрские объявления ЗаНомером.
-- Источники добавляются только после явного согласия их владельцев.

create table if not exists public.partner_listings (
  id text primary key,
  plate_left text not null check (char_length(plate_left) = 1),
  plate_digits text not null check (plate_digits ~ '^[0-9]{3}$'),
  plate_right text not null check (char_length(plate_right) = 2),
  region text not null,
  vehicle_type text not null default 'car' check (vehicle_type in ('car', 'motorcycle', 'truck')),
  price_rub integer not null check (price_rub > 0),
  tag text,
  source_name text not null,
  source_url text not null,
  featured_until timestamptz,
  status text not null default 'active' check (status in ('active', 'archived')),
  archive_reason text,
  created_at timestamptz not null default now(),
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partner_listings add column if not exists featured_until timestamptz;

create index if not exists partner_listings_active_created_idx
  on public.partner_listings (status, created_at desc);

alter table public.partner_listings enable row level security;

create policy "Everyone can read active partner listings"
  on public.partner_listings for select
  using (status = 'active');

-- Новые объявления из разрешённых партнёрских источников.
insert into public.partner_listings
  (id, plate_left, plate_digits, plate_right, region, price_rub, tag, source_name, source_url)
values
  ('runomer-71808-x150kx550', 'Х', '150', 'КХ', 'Московская область · 550', 100000, 'Зеркальный', 'Красивые номера на авто', 'https://t.me/runomer/71808'),
  ('runomer-71808-e242ey550', 'Е', '242', 'ЕУ', 'Московская область · 550', 30000, 'Зеркальный', 'Красивые номера на авто', 'https://t.me/runomer/71808'),
  ('runomer-71808-n272vx550', 'Н', '272', 'ВХ', 'Московская область · 550', 30000, 'Зеркальный', 'Красивые номера на авто', 'https://t.me/runomer/71808'),
  ('runomer-71808-t363kr550', 'Т', '363', 'КР', 'Московская область · 550', 25000, 'Ровный', 'Красивые номера на авто', 'https://t.me/runomer/71808'),
  ('runomer-71808-r393ve550', 'Р', '393', 'ВЕ', 'Московская область · 550', 25000, 'Ровный', 'Красивые номера на авто', 'https://t.me/runomer/71808'),
  ('runomer-71808-r474ka550', 'Р', '474', 'КА', 'Московская область · 550', 25000, 'Ровный', 'Красивые номера на авто', 'https://t.me/runomer/71808'),
  ('runomer-71808-k626eh550', 'К', '626', 'ЕХ', 'Московская область · 550', 25000, 'Зеркальный', 'Красивые номера на авто', 'https://t.me/runomer/71808'),
  ('runomer-71808-o686ah250', 'О', '686', 'АХ', 'Московская область · 250', 25000, 'Зеркальный', 'Красивые номера на авто', 'https://t.me/runomer/71808'),
  ('runomer-71808-k800va250', 'К', '800', 'ВА', 'Московская область · 250', 90000, 'Нули', 'Красивые номера на авто', 'https://t.me/runomer/71808'),
  ('runomer-71808-e863ee750', 'Е', '863', 'ЕЕ', 'Москва · 750', 150000, 'Одинаковые буквы', 'Красивые номера на авто', 'https://t.me/runomer/71808'),
  ('specznak-13523', 'М', '323', 'КА', 'Москва · 777', 380000, 'Ровный', 'SpecZnak', 'https://t.me/specznak/13523'),
  ('specznak-13524', 'Е', '779', 'ЕЕ', 'Москва · 777', 750000, 'Одинаковые буквы', 'SpecZnak', 'https://t.me/specznak/13524'),
  ('specznak-13527', 'У', '555', 'ХЕ', 'Москва · 177', 550000, 'Одинаковые цифры', 'SpecZnak', 'https://t.me/specznak/13527'),
  ('specznak-13529', 'О', '767', 'ОО', 'Московская область · 90', 1300000, 'Одинаковые буквы', 'SpecZnak', 'https://t.me/specznak/13529'),
  ('specznak-13531', 'М', '565', 'ММ', 'Московская область · 50', 1500000, 'Одинаковые буквы', 'SpecZnak', 'https://t.me/specznak/13531'),
  ('specznak-13532', 'А', '001', 'РС', 'Москва · 99', 2030000, 'Нули', 'SpecZnak', 'https://t.me/specznak/13532'),
  ('specznak-13536', 'А', '702', 'АА', 'Московская область · 90', 630000, 'Одинаковые буквы', 'SpecZnak', 'https://t.me/specznak/13536'),
  ('specznak-13538', 'В', '333', 'ОР', 'Москва · 77', 2400000, 'Одинаковые цифры', 'SpecZnak', 'https://t.me/specznak/13538'),
  ('specznak-13540', 'Х', '056', 'УХ', 'Москва · 99', 180000, 'Нули', 'SpecZnak', 'https://t.me/specznak/13540')
on conflict (id) do update set
  price_rub = excluded.price_rub,
  region = excluded.region,
  tag = excluded.tag,
  source_url = excluded.source_url,
  status = 'active',
  checked_at = now(),
  updated_at = now();
