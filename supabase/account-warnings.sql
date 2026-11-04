-- Apply after timed-account-bans.sql.
begin;
create table if not exists public.account_warning_notices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check(char_length(trim(reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists account_warning_notices_unread_idx on public.account_warning_notices(owner_id,created_at) where read_at is null;
alter table public.account_warning_notices enable row level security;
drop policy if exists "Users read own warnings" on public.account_warning_notices;
create policy "Users read own warnings" on public.account_warning_notices for select to authenticated using(owner_id=auth.uid());
drop policy if exists "Users acknowledge own warnings" on public.account_warning_notices;
create policy "Users acknowledge own warnings" on public.account_warning_notices for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
revoke all on public.account_warning_notices from public,anon,authenticated;
grant select,update(read_at) on public.account_warning_notices to authenticated;

create or replace function public.warn_user_from_report(report uuid,report_kind text,warning_description text)
returns void language plpgsql security definer set search_path=public as $$
declare target uuid; description text:=trim(warning_description);
begin
  if not exists(select 1 from public.auto_moderators m where m.user_id=auth.uid()) then raise exception 'Недостаточно прав модератора' using errcode='42501'; end if;
  if description is null or char_length(description) not between 3 and 500 then raise exception 'Укажи описание от 3 до 500 символов'; end if;
  if report_kind='message' then
    select m.sender_id into target from public.listing_message_reports r join public.listing_messages m on m.id=r.message_id
    where r.id=report and r.status='pending' and r.reporter_id=m.recipient_id and r.reporter_id<>m.sender_id for update of r;
  elsif report_kind='comment' then
    select c.author_id into target from public.listing_public_comment_reports r join public.listing_public_comments c on c.id=r.comment_id
    where r.id=report and r.status='pending' for update of r;
  else raise exception 'Неизвестный вид жалобы'; end if;
  if target is null then raise exception 'Жалоба не найдена или уже обработана'; end if;
  if target=auth.uid() then raise exception 'Нельзя выдать предупреждение себе'; end if;
  insert into public.account_warning_notices(owner_id,reason) values(target,description);
  if report_kind='message' then
    update public.listing_message_reports r set status='approved',reviewed_by=auth.uid(),reviewed_at=now() where r.id=report;
  else
    update public.listing_public_comment_reports r set status='approved',reviewed_by=auth.uid(),reviewed_at=now() where r.id=report;
  end if;
end;
$$;
revoke all on function public.warn_user_from_report(uuid,text,text) from public,anon;
grant execute on function public.warn_user_from_report(uuid,text,text) to authenticated;

create or replace function public.get_unread_account_moderation_notice()
returns table(id uuid,owner_id uuid,reason text,expires_at timestamptz,created_at timestamptz,kind text)
language sql stable security definer set search_path=public as $$
  select n.id,n.owner_id,n.reason,n.expires_at,n.created_at,n.kind from (
    select b.id,b.owner_id,b.reason,b.expires_at,b.created_at,'ban'::text as kind from public.account_ban_notices b where b.owner_id=auth.uid() and b.read_at is null
    union all
    select w.id,w.owner_id,w.reason,null::timestamptz,w.created_at,'warning'::text as kind from public.account_warning_notices w where w.owner_id=auth.uid() and w.read_at is null
  ) n order by n.created_at,n.id limit 1;
$$;
revoke all on function public.get_unread_account_moderation_notice() from public,anon;
grant execute on function public.get_unread_account_moderation_notice() to authenticated;
notify pgrst,'reload schema';
commit;
