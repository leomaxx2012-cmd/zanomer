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
  -- Русский, украинский, английский и популярная транслитерация.
  -- Проверка выполняется на сервере и действует также для гостевых сессий.
  if lower(new.body) ~ '(хуй|хуе|ху[йїіе]|пизд|пізд|еба|їба|йоб|бля|бляд|сука|курва|мраз|гандон|идиот|fuck|f+u+c+k+|shit|bitch|asshole|bastard|cunt|dick|whore|slut|huy|hu[yi]|pizd|pizdets|ebat|yob|blya|suka|kurwa)' then
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
    and (
      exists (
        select 1 from public.auto_listings l
        where l.id = listing_id and l.status = 'active' and l.owner_id = recipient_id
      )
      or (
        exists (
          select 1 from public.auto_listings l
          where l.id = listing_id and l.status = 'active' and l.owner_id = auth.uid()
        )
        and exists (
          select 1 from public.listing_messages earlier
          where earlier.listing_id = listing_id
            and (earlier.sender_id = recipient_id or earlier.recipient_id = recipient_id)
        )
      )
    )
  );

-- Жалобы на сообщения. Их видит автор жалобы и модератор в отдельном интерфейсе;
-- обычные участники чата не получают доступ к чужим жалобам.
create table if not exists public.listing_message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.listing_messages(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

-- Жалоба относится к пользователю, отправившему выбранное сообщение. Эти поля
-- заполняются на сервере: клиент не может подменить, на кого жалуется.
alter table public.listing_message_reports
  add column if not exists listing_id uuid references public.auto_listings(id) on delete cascade,
  add column if not exists reported_user_id uuid references auth.users(id) on delete cascade;

update public.listing_message_reports r
set listing_id = m.listing_id,
    reported_user_id = m.sender_id
from public.listing_messages m
where m.id = r.message_id
  and (r.listing_id is null or r.reported_user_id is null);

create or replace function public.fill_listing_message_report_details()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select listing_id, sender_id into new.listing_id, new.reported_user_id
  from public.listing_messages
  where id = new.message_id;
  if new.listing_id is null or new.reported_user_id is null then
    raise exception 'Сообщение для жалобы не найдено';
  end if;
  if new.reported_user_id = auth.uid() then
    raise exception 'Нельзя пожаловаться на самого себя';
  end if;
  return new;
end;
$$;

drop trigger if exists listing_message_reports_details on public.listing_message_reports;
create trigger listing_message_reports_details
  before insert on public.listing_message_reports
  for each row execute function public.fill_listing_message_report_details();

alter table public.listing_message_reports enable row level security;

alter table public.listing_message_reports
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

drop policy if exists "Users submit their own message reports" on public.listing_message_reports;
create policy "Users submit their own message reports"
  on public.listing_message_reports for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "Users see their own message reports" on public.listing_message_reports;
create policy "Users see their own message reports"
  on public.listing_message_reports for select to authenticated
  using (reporter_id = auth.uid());

-- Только аккаунты из auto_moderators могут видеть и обрабатывать чужие жалобы.
drop policy if exists "Moderators view message reports" on public.listing_message_reports;
create policy "Moderators view message reports"
  on public.listing_message_reports for select to authenticated
  using (exists (select 1 from public.auto_moderators m where m.user_id = auth.uid()));

create or replace function public.review_listing_message_report(report uuid, new_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.auto_moderators m where m.user_id = auth.uid()) then
    raise exception 'Недостаточно прав модератора';
  end if;
  if new_status not in ('approved', 'rejected') then
    raise exception 'Недопустимый статус жалобы';
  end if;
  update public.listing_message_reports
  set status = new_status, reviewed_by = auth.uid(), reviewed_at = now()
  where id = report and status = 'pending';
  if not found then
    raise exception 'Жалоба не найдена или уже обработана';
  end if;
end;
$$;

revoke all on function public.review_listing_message_report(uuid, text) from public;
grant execute on function public.review_listing_message_report(uuid, text) to authenticated;

-- Модератор может открыть чат только из карточки жалобы. Обычные пользователи
-- по-прежнему видят только свои сообщения благодаря RLS-политике выше.
create or replace function public.get_reported_listing_chat(report uuid)
returns table (id uuid, listing_id uuid, sender_id uuid, recipient_id uuid, body text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  report_listing_id uuid;
begin
  if not exists (select 1 from public.auto_moderators where user_id = auth.uid()) then
    raise exception 'Недостаточно прав модератора';
  end if;
  select r.listing_id into report_listing_id
  from public.listing_message_reports r
  where r.id = report;
  if report_listing_id is null then
    raise exception 'Жалоба не найдена';
  end if;
  return query
  select m.id, m.listing_id, m.sender_id, m.recipient_id, m.body, m.created_at
  from public.listing_messages m
  where m.listing_id = report_listing_id
  order by m.created_at asc;
end;
$$;

revoke all on function public.get_reported_listing_chat(uuid) from public;
grant execute on function public.get_reported_listing_chat(uuid) to authenticated;

-- Ник владельца доступен всем для отображения в карточке, без контактов.
-- Политика уже есть в schema.sql; эта строка безопасна при повторном запуске.
drop policy if exists "Everyone can check usernames" on public.auto_profiles;
create policy "Everyone can check usernames"
  on public.auto_profiles for select using (true);
