-- Выполни один раз в Supabase → SQL Editor.
-- Авто: А 123 ВС; мото: 1234 АВ; прицеп: АВ 1234.

alter table public.auto_listings
  drop constraint if exists auto_listings_plate_left_check,
  drop constraint if exists auto_listings_plate_digits_check,
  drop constraint if exists auto_listings_plate_right_check,
  drop constraint if exists auto_listings_plate_format_check;

alter table public.auto_listings add constraint auto_listings_plate_format_check check (
  (vehicle_type = 'car' and char_length(plate_left) = 1 and plate_digits ~ '^[0-9]{3}$' and char_length(plate_right) = 2)
  or (vehicle_type = 'motorcycle' and plate_left = '' and plate_digits ~ '^[0-9]{4}$' and char_length(plate_right) = 2)
  or (vehicle_type = 'truck' and char_length(plate_left) = 2 and plate_digits ~ '^[0-9]{4}$' and plate_right = '')
);

alter table public.partner_listings
  drop constraint if exists partner_listings_plate_left_check,
  drop constraint if exists partner_listings_plate_digits_check,
  drop constraint if exists partner_listings_plate_right_check,
  drop constraint if exists partner_listings_plate_format_check;

alter table public.partner_listings add constraint partner_listings_plate_format_check check (
  (vehicle_type = 'car' and char_length(plate_left) = 1 and plate_digits ~ '^[0-9]{3}$' and char_length(plate_right) = 2)
  or (vehicle_type = 'motorcycle' and plate_left = '' and plate_digits ~ '^[0-9]{4}$' and char_length(plate_right) = 2)
  or (vehicle_type = 'truck' and char_length(plate_left) = 2 and plate_digits ~ '^[0-9]{4}$' and plate_right = '')
);

drop index if exists public.auto_listings_unique_pending_or_active_plate_idx;
create unique index auto_listings_unique_pending_or_active_plate_idx
  on public.auto_listings (owner_id, plate_left, plate_digits, plate_right, region, vehicle_type)
  where status in ('active', 'moderation');
