-- Внутренний чат ЗаНомером. Выполни один раз в Supabase → SQL Editor.

create table if not exists public.listing_messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.auto_listings(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- Безопасно добавляет получателя, если таблица была создана старой версией скрипта.
alter table public.listing_messages
  add column if not exists recipient_id uuid references auth.users(id) on delete cascade;

update public.listing_messages m
set recipient_id = l.owner_id
from public.auto_listings l
where l.id = m.listing_id and m.recipient_id is null;

create index if not exists listing_messages_listing_created_idx
  on public.listing_messages (listing_id, created_at asc);

alter table public.listing_messages enable row level security;

create or replace function public.reject_prohibited_chat_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.body) ~ '(хуй|хуе|пизд|еба|бля|сука|мраз|гандон|идиот)' then
    raise exception 'Сообщение содержит запрещённые слова';
  end if;
  return new;
end;
$$;

drop trigger if exists listing_messages_content_check on public.listing_messages;
create trigger listing_messages_content_check
  before insert or update of body on public.listing_messages
  for each row execute function public.reject_prohibited_chat_message();

drop policy if exists "Users see their own listing chats" on public.listing_messages;
create policy "Users see their own listing chats"
  on public.listing_messages for select to authenticated
  using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
  );

drop policy if exists "Users send messages to active listings" on public.listing_messages;
create policy "Users send messages to active listings"
  on public.listing_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and recipient_id is not null
    and recipient_id <> auth.uid()
    and exists (select 1 from public.auto_listings l where l.id = listing_id and l.status = 'active')
    and (
      recipient_id = (select owner_id from public.auto_listings l where l.id = listing_id)
      or (
        (select owner_id from public.auto_listings l where l.id = listing_id) = auth.uid()
        and exists (
          select 1 from public.listing_messages earlier
          where earlier.listing_id = listing_id
            and (earlier.sender_id = recipient_id or earlier.recipient_id = recipient_id)
        )
      )
    )
  );

-- Ник владельца доступен всем для отображения в карточке, без контактов.
-- Политика уже есть в schema.sql; эта строка безопасна при повторном запуске.
drop policy if exists "Everyone can check usernames" on public.auto_profiles;
create policy "Everyone can check usernames"
  on public.auto_profiles for select using (true);
