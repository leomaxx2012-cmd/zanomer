-- Apply after report-moderation.sql. Existing bans remain permanent.
begin;
alter table public.auto_banned_users add column if not exists expires_at timestamptz;

create table if not exists public.account_ban_notices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists account_ban_notices_unread_idx on public.account_ban_notices(owner_id, created_at desc) where read_at is null;
alter table public.account_ban_notices enable row level security;
drop policy if exists "Users read own ban notices" on public.account_ban_notices;
create policy "Users read own ban notices" on public.account_ban_notices for select to authenticated using (owner_id = auth.uid());
drop policy if exists "Users acknowledge own ban notices" on public.account_ban_notices;
create policy "Users acknowledge own ban notices" on public.account_ban_notices for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke all on public.account_ban_notices from anon, authenticated;
grant select, update(read_at) on public.account_ban_notices to authenticated;

create or replace function public.create_account_ban_notice()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.account_ban_notices(owner_id,reason,expires_at,created_at)
  values(new.user_id,coalesce(nullif(trim(new.reason),''),'Нарушение правил общения'),new.expires_at,new.created_at);
  return new;
end;
$$;
revoke all on function public.create_account_ban_notice() from public, anon, authenticated;
drop trigger if exists auto_banned_users_notice on public.auto_banned_users;
create trigger auto_banned_users_notice after insert or update on public.auto_banned_users for each row execute function public.create_account_ban_notice();

-- Existing blocked accounts also receive a message, once.
insert into public.account_ban_notices(owner_id,reason,expires_at,created_at)
select b.user_id,coalesce(nullif(trim(b.reason),''),'Нарушение правил общения'),b.expires_at,b.created_at
from public.auto_banned_users b
where (b.expires_at is null or b.expires_at > now())
and not exists(select 1 from public.account_ban_notices n where n.owner_id=b.user_id and n.created_at=b.created_at);

create or replace function public.is_current_user_banned()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.auto_banned_users b where b.user_id=auth.uid() and (b.expires_at is null or b.expires_at > now()));
$$;
revoke all on function public.is_current_user_banned() from public, anon;
grant execute on function public.is_current_user_banned() to authenticated;

create or replace function public.get_my_ban_status()
returns table(reason text,expires_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(b.reason),''),'Нарушение правил общения'),b.expires_at,b.created_at
  from public.auto_banned_users b where b.user_id=auth.uid() and (b.expires_at is null or b.expires_at > now());
$$;
revoke all on function public.get_my_ban_status() from public, anon;
grant execute on function public.get_my_ban_status() to authenticated;

create or replace function public.reject_banned_listing_author()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  if tg_table_name='listing_messages' then author:=new.sender_id; else author:=new.author_id; end if;
  if exists(select 1 from public.auto_banned_users b where b.user_id=author and (b.expires_at is null or b.expires_at > now())) then
    raise exception 'Вы заблокированы и не можете отправлять сообщения и комментарии' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function public.reject_banned_listing_author() from public, anon, authenticated;

-- The restriction supplements existing recipient/ownership policies.
drop policy if exists "Blocked users cannot send messages" on public.listing_messages;
create policy "Blocked users cannot send messages" on public.listing_messages as restrictive for insert to authenticated with check (not public.is_current_user_banned());
drop policy if exists "Authenticated users add their comments" on public.listing_public_comments;
create policy "Authenticated users add their comments" on public.listing_public_comments for insert to authenticated with check(author_id=auth.uid() and not public.is_current_user_banned());

create or replace function public.ban_user_from_report(report uuid, report_kind text, duration_minutes integer, ban_reason text)
returns table(expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare target uuid; ends_at timestamptz; clean_reason text := trim(ban_reason);
begin
  if not exists(select 1 from public.auto_moderators m where m.user_id=auth.uid()) then raise exception 'Недостаточно прав модератора' using errcode='42501'; end if;
  if duration_minutes is not null and (duration_minutes < 1 or duration_minutes > 52560000) then raise exception 'Некорректный срок блокировки'; end if;
  if clean_reason is null or char_length(clean_reason) not between 3 and 500 then raise exception 'Укажи причину от 3 до 500 символов'; end if;
  if report_kind='message' then
    select m.sender_id into target from public.listing_message_reports r join public.listing_messages m on m.id=r.message_id
    where r.id=report and r.status='pending' and r.reporter_id=m.recipient_id and r.reporter_id<>m.sender_id for update of r;
  elsif report_kind='comment' then
    select c.author_id into target from public.listing_public_comment_reports r join public.listing_public_comments c on c.id=r.comment_id
    where r.id=report and r.status='pending' for update of r;
  else raise exception 'Неизвестный вид жалобы'; end if;
  if target is null then raise exception 'Жалоба не найдена или уже обработана'; end if;
  if target=auth.uid() then raise exception 'Нельзя заблокировать себя'; end if;
  ends_at:=case when duration_minutes is null then null else now()+make_interval(mins=>duration_minutes) end;
  insert into public.auto_banned_users(user_id,banned_by,reason,created_at,expires_at)
  values(target,auth.uid(),clean_reason,now(),ends_at)
  on conflict(user_id) do update set banned_by=excluded.banned_by,reason=excluded.reason,created_at=excluded.created_at,expires_at=excluded.expires_at;
  if report_kind='message' then
    update public.listing_message_reports r set status='approved',reviewed_by=auth.uid(),reviewed_at=now() where r.id=report;
  else
    update public.listing_public_comment_reports r set status='approved',reviewed_by=auth.uid(),reviewed_at=now() where r.id=report;
  end if;
  return query select ends_at;
end;
$$;
revoke all on function public.ban_user_from_report(uuid,text,integer,text) from public, anon;
grant execute on function public.ban_user_from_report(uuid,text,integer,text) to authenticated;

-- Compatibility for old application versions: a ban without a duration is permanent.
create or replace function public.ban_user_from_message_report(report uuid)
returns void language plpgsql security definer set search_path = public as $$
begin perform public.ban_user_from_report(report,'message',null,'Нарушение правил общения'); end;
$$;
revoke all on function public.ban_user_from_message_report(uuid) from public, anon;
grant execute on function public.ban_user_from_message_report(uuid) to authenticated;

create or replace function public.review_listing_public_comment_report(report uuid,new_status text,ban_author boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.auto_moderators m where m.user_id=auth.uid()) then raise exception 'Недостаточно прав модератора' using errcode='42501'; end if;
  if new_status is null or new_status not in ('approved','rejected') or (ban_author and new_status<>'approved') then raise exception 'Недопустимый статус жалобы'; end if;
  if ban_author then perform public.ban_user_from_report(report,'comment',null,'Нарушение правил общения'); return; end if;
  update public.listing_public_comment_reports r set status=new_status,reviewed_by=auth.uid(),reviewed_at=now() where r.id=report and r.status='pending';
  if not found then raise exception 'Жалоба не найдена или уже обработана'; end if;
end;
$$;
revoke all on function public.review_listing_public_comment_report(uuid,text,boolean) from public, anon;
grant execute on function public.review_listing_public_comment_report(uuid,text,boolean) to authenticated;

notify pgrst,'reload schema';
commit;
