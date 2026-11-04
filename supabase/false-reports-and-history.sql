-- Apply after account-warnings.sql. History remains moderator-only.
begin;
create index if not exists account_ban_notices_history_idx on public.account_ban_notices(owner_id,created_at desc,id);
create index if not exists account_warning_notices_history_idx on public.account_warning_notices(owner_id,created_at desc,id);

create or replace function public.moderate_report_participant(report uuid,report_kind text,target_role text,action_type text,duration_minutes integer,description text)
returns table(expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare target uuid; ends_at timestamptz; message_text text:=trim(description);
begin
  if not exists(select 1 from public.auto_moderators m where m.user_id=auth.uid()) then raise exception 'Недостаточно прав модератора' using errcode='42501'; end if;
  if target_role is null or target_role not in ('reporter','reported') or action_type is null or action_type not in ('warning','ban') then raise exception 'Неизвестное действие'; end if;
  if message_text is null or char_length(message_text) not between 3 and 480 then raise exception 'Укажи описание от 3 до 480 символов'; end if;
  if action_type='ban' and duration_minutes is not null and (duration_minutes<1 or duration_minutes>52560000) then raise exception 'Некорректный срок блокировки'; end if;
  if target_role='reported' then
    if action_type='warning' then
      perform public.warn_user_from_report(report,report_kind,message_text);
      return query select null::timestamptz;
    else
      return query select b.expires_at from public.ban_user_from_report(report,report_kind,duration_minutes,message_text) b;
    end if;
    return;
  end if;
  -- False-report decisions target the reporter, never the reported author.
  if report_kind='message' then
    select r.reporter_id into target from public.listing_message_reports r join public.listing_messages m on m.id=r.message_id
    where r.id=report and r.status='pending' and r.reporter_id=m.recipient_id and r.reporter_id<>m.sender_id for update of r;
  elsif report_kind='comment' then
    select r.reporter_id into target from public.listing_public_comment_reports r where r.id=report and r.status='pending' for update;
  else raise exception 'Неизвестный вид жалобы'; end if;
  if target is null then raise exception 'Жалоба не найдена или уже обработана'; end if;
  if target=auth.uid() then raise exception 'Нельзя назначить наказание себе'; end if;
  message_text:='Ложная жалоба. '||message_text;
  if action_type='warning' then
    insert into public.account_warning_notices(owner_id,reason) values(target,message_text);
  else
    ends_at:=case when duration_minutes is null then null else now()+make_interval(mins=>duration_minutes) end;
    insert into public.auto_banned_users(user_id,banned_by,reason,created_at,expires_at)
    values(target,auth.uid(),message_text,now(),ends_at)
    on conflict(user_id) do update set banned_by=excluded.banned_by,reason=excluded.reason,created_at=excluded.created_at,expires_at=excluded.expires_at;
  end if;
  if report_kind='message' then
    update public.listing_message_reports r set status='rejected',reviewed_by=auth.uid(),reviewed_at=now() where r.id=report;
  else
    update public.listing_public_comment_reports r set status='rejected',reviewed_by=auth.uid(),reviewed_at=now() where r.id=report;
  end if;
  return query select ends_at;
end;
$$;
revoke all on function public.moderate_report_participant(uuid,text,text,text,integer,text) from public,anon;
grant execute on function public.moderate_report_participant(uuid,text,text,text,integer,text) to authenticated;

create or replace function public.get_report_participant_history(report uuid,report_kind text,page integer default 0)
returns table(participant text,id uuid,kind text,username text,reason text,expires_at timestamptz,created_at timestamptz,active boolean,total_count bigint)
language plpgsql security definer set search_path=public as $$
declare reporter uuid; reported uuid;
begin
  if not exists(select 1 from public.auto_moderators m where m.user_id=auth.uid()) then raise exception 'Недостаточно прав модератора' using errcode='42501'; end if;
  if page is null or page<0 or page>10000 then raise exception 'Некорректная страница истории'; end if;
  if report_kind='message' then
    select r.reporter_id,m.sender_id into reporter,reported from public.listing_message_reports r join public.listing_messages m on m.id=r.message_id
    where r.id=report and r.reporter_id=m.recipient_id and r.reporter_id<>m.sender_id;
  elsif report_kind='comment' then
    select r.reporter_id,c.author_id into reporter,reported from public.listing_public_comment_reports r join public.listing_public_comments c on c.id=r.comment_id where r.id=report;
  else raise exception 'Неизвестный вид жалобы'; end if;
  if reporter is null or reported is null then raise exception 'Жалоба не найдена'; end if;
  return query with participants as (
    select 'reporter'::text as role,reporter as user_id union all select 'reported'::text,reported
  ), events as (
    select p.role,n.id,'warning'::text as kind,p.user_id,n.reason,null::timestamptz as expires_at,n.created_at,false as active
    from participants p join public.account_warning_notices n on n.owner_id=p.user_id
    union all
    select p.role,n.id,'ban'::text,p.user_id,n.reason,n.expires_at,n.created_at,
      exists(select 1 from public.auto_banned_users b where b.user_id=p.user_id and b.created_at=n.created_at
        and b.reason=n.reason and b.expires_at is not distinct from n.expires_at and (b.expires_at is null or b.expires_at>now()))
    from participants p join public.account_ban_notices n on n.owner_id=p.user_id
  ), ranked as (
    select e.*,row_number() over(partition by e.role order by e.created_at desc,e.id desc) as position,
      count(*) over(partition by e.role) as total_count from events e
  ) select e.role,e.id,e.kind,coalesce(p.username,'Пользователь'),e.reason,e.expires_at,e.created_at,e.active,e.total_count
  from ranked e left join public.auto_profiles p on p.id=e.user_id
  where e.position>page*20 and e.position<=(page+1)*20
  order by e.role,e.created_at desc,e.id desc;
end;
$$;
revoke all on function public.get_report_participant_history(uuid,text,integer) from public,anon;
grant execute on function public.get_report_participant_history(uuid,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
