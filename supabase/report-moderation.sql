-- Apply after chat.sql and listing-social.sql. Safe to apply repeatedly.
begin;

-- A SECURITY DEFINER trigger checks bans even when RLS hides the ban list.
create or replace function public.reject_banned_listing_author()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  if tg_table_name = 'listing_messages' then author := new.sender_id;
  else author := new.author_id;
  end if;
  if exists (select 1 from public.auto_banned_users b where b.user_id = author) then
    raise exception 'Вы заблокированы и не можете отправлять сообщения и комментарии' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.reject_banned_listing_author() from public, anon, authenticated;
drop trigger if exists listing_messages_ban_check on public.listing_messages;
create trigger listing_messages_ban_check before insert or update of sender_id, body on public.listing_messages
for each row execute function public.reject_banned_listing_author();
drop trigger if exists listing_public_comments_ban_check on public.listing_public_comments;
create trigger listing_public_comments_ban_check before insert or update of author_id, body on public.listing_public_comments
for each row execute function public.reject_banned_listing_author();

-- A user can report only a message received in their own conversation.
create or replace function public.fill_listing_message_report_details()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_recipient uuid;
begin
  select m.listing_id, m.sender_id, m.recipient_id
  into new.listing_id, new.reported_user_id, target_recipient
  from public.listing_messages m where m.id = new.message_id;
  if new.listing_id is null or new.reported_user_id is null then raise exception 'Сообщение для жалобы не найдено'; end if;
  if new.reporter_id is distinct from auth.uid() or target_recipient is distinct from auth.uid() then
    raise exception 'Можно пожаловаться только на полученное сообщение' using errcode = '42501';
  end if;
  if new.reported_user_id = auth.uid() then raise exception 'Нельзя пожаловаться на самого себя'; end if;
  new.status := 'pending'; new.reviewed_by := null; new.reviewed_at := null;
  return new;
end;
$$;
revoke all on function public.fill_listing_message_report_details() from public, anon, authenticated;

create or replace function public.get_reported_listing_chat(report uuid)
returns table (id uuid, listing_id uuid, sender_id uuid, recipient_id uuid, body text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare target public.listing_messages%rowtype;
begin
  if not exists (select 1 from public.auto_moderators m where m.user_id = auth.uid()) then
    raise exception 'Недостаточно прав модератора' using errcode = '42501';
  end if;
  select m.* into target from public.listing_message_reports r
  join public.listing_messages m on m.id = r.message_id
  where r.id = report and r.reporter_id = m.recipient_id and r.reporter_id <> m.sender_id;
  if not found then raise exception 'Жалоба или её переписка не найдена'; end if;
  return query select m.id, m.listing_id, m.sender_id, m.recipient_id, m.body, m.created_at
  from public.listing_messages m where m.listing_id = target.listing_id and (
    (m.sender_id = target.sender_id and m.recipient_id = target.recipient_id) or
    (m.sender_id = target.recipient_id and m.recipient_id = target.sender_id)
  ) order by m.created_at asc, m.id asc;
end;
$$;
revoke all on function public.get_reported_listing_chat(uuid) from public, anon;
grant execute on function public.get_reported_listing_chat(uuid) to authenticated;

alter table public.listing_public_comment_reports
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create or replace function public.fill_public_comment_report_details()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select c.author_id into new.reported_user_id from public.listing_public_comments c where c.id = new.comment_id;
  if new.reported_user_id is null then raise exception 'Комментарий не найден'; end if;
  if new.reporter_id is distinct from auth.uid() then raise exception 'Недостаточно прав' using errcode = '42501'; end if;
  if new.reported_user_id = auth.uid() then raise exception 'Нельзя пожаловаться на себя'; end if;
  new.status := 'pending'; new.reviewed_by := null; new.reviewed_at := null;
  return new;
end;
$$;
revoke all on function public.fill_public_comment_report_details() from public, anon, authenticated;

-- Return reported content only, rather than exposing unrelated private chats.
create or replace function public.get_pending_listing_reports()
returns table (kind text, id uuid, reason text, created_at timestamptz, reported_user_id uuid, body text, listing_id text)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.auto_moderators m where m.user_id = auth.uid()) then
    raise exception 'Недостаточно прав модератора' using errcode = '42501';
  end if;
  return query
  select 'message'::text, r.id, r.reason, r.created_at, m.sender_id, m.body, m.listing_id::text
  from public.listing_message_reports r join public.listing_messages m on m.id = r.message_id
  where r.status = 'pending' and r.reporter_id = m.recipient_id and r.reporter_id <> m.sender_id
  union all
  select 'comment'::text, r.id, r.reason, r.created_at, c.author_id, c.body, c.listing_id
  from public.listing_public_comment_reports r join public.listing_public_comments c on c.id = r.comment_id
  where r.status = 'pending'
  order by 4, 2;
end;
$$;
revoke all on function public.get_pending_listing_reports() from public, anon;
grant execute on function public.get_pending_listing_reports() to authenticated;

create or replace function public.review_listing_public_comment_report(report uuid, new_status text, ban_author boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if not exists (select 1 from public.auto_moderators m where m.user_id = auth.uid()) then
    raise exception 'Недостаточно прав модератора' using errcode = '42501';
  end if;
  if new_status is null or new_status not in ('approved', 'rejected') or (ban_author and new_status <> 'approved') then
    raise exception 'Недопустимый статус жалобы';
  end if;
  select r.reported_user_id into target from public.listing_public_comment_reports r
  where r.id = report and r.status = 'pending' for update;
  if not found then raise exception 'Жалоба не найдена или уже обработана'; end if;
  if ban_author then
    if target is null or target = auth.uid() then raise exception 'Нельзя заблокировать этого пользователя'; end if;
    insert into public.auto_banned_users (user_id, banned_by, reason)
    values (target, auth.uid(), 'Жалоба на комментарий')
    on conflict (user_id) do update set banned_by = excluded.banned_by, reason = excluded.reason, created_at = now();
  end if;
  update public.listing_public_comment_reports r set status = new_status, reviewed_by = auth.uid(), reviewed_at = now()
  where r.id = report;
end;
$$;
revoke all on function public.review_listing_public_comment_report(uuid, text, boolean) from public, anon;
grant execute on function public.review_listing_public_comment_report(uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
