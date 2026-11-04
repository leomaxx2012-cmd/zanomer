begin;
create table if not exists public.moderation_push_jobs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  report_kind text not null check(report_kind in ('message','comment')),
  audience text not null check(audience in ('subject','reporter')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  issued_by uuid not null references auth.users(id),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_claimed_at timestamptz,
  push_sent_at timestamptz,
  push_error text,
  unique(report_id,report_kind,audience)
);
alter table public.moderation_push_jobs enable row level security;
create index if not exists moderation_push_jobs_pending_idx on public.moderation_push_jobs(issued_by,created_at) where push_sent_at is null;
drop policy if exists "Users read own report results" on public.moderation_push_jobs;
create policy "Users read own report results" on public.moderation_push_jobs for select to authenticated using(owner_id=auth.uid() and audience='reporter');
drop policy if exists "Users acknowledge own report results" on public.moderation_push_jobs;
create policy "Users acknowledge own report results" on public.moderation_push_jobs for update to authenticated using(owner_id=auth.uid() and audience='reporter') with check(owner_id=auth.uid() and audience='reporter');
revoke all on public.moderation_push_jobs from public,anon,authenticated;
grant select,update(read_at) on public.moderation_push_jobs to authenticated;
grant all on public.moderation_push_jobs to service_role;

create or replace function public.moderate_report_with_push(report uuid,report_kind text,target_role text,action_type text,duration_minutes integer,description text)
returns table(expires_at timestamptz,push_job_ids uuid[])
language plpgsql security definer set search_path=public as $$
declare reporter uuid; reported uuid; subject uuid; ends_at timestamptz; subject_job uuid; receipt_job uuid;
  notification_title text; notification_body text; duration_label text;
begin
  if not exists(select 1 from public.auto_moderators m where m.user_id=auth.uid()) then raise exception 'Недостаточно прав модератора' using errcode='42501'; end if;
  if report_kind='message' then
    select r.reporter_id,m.sender_id into reporter,reported from public.listing_message_reports r join public.listing_messages m on m.id=r.message_id
    where r.id=report and r.status='pending' and r.reporter_id=m.recipient_id and r.reporter_id<>m.sender_id for update of r;
  elsif report_kind='comment' then
    select r.reporter_id,c.author_id into reporter,reported from public.listing_public_comment_reports r join public.listing_public_comments c on c.id=r.comment_id
    where r.id=report and r.status='pending' for update of r;
  else raise exception 'Неизвестный вид жалобы'; end if;
  if reporter is null or reported is null then raise exception 'Жалоба не найдена или уже обработана'; end if;
  select r.expires_at into ends_at from public.moderate_report_participant(report,report_kind,target_role,action_type,duration_minutes,description) r;
  subject:=case when target_role='reporter' then reporter else reported end;
  duration_label:=case when ends_at is null then 'Бессрочно.' else 'До '||to_char(ends_at at time zone 'Europe/Moscow','DD.MM.YYYY HH24:MI')||' МСК.' end;
  notification_title:=case when action_type='warning' then 'Предупреждение от модератора' else 'Ограничение общения' end;
  notification_body:=case when target_role='reporter' then 'Ложная жалоба. ' else '' end||trim(description);
  if action_type='ban' then notification_body:='Отправка сообщений и комментариев заблокирована. '||duration_label||' '||notification_body; end if;
  insert into public.moderation_push_jobs(report_id,report_kind,audience,owner_id,issued_by,title,body)
  values(report,report_kind,'subject',subject,auth.uid(),notification_title,notification_body) returning id into subject_job;
  if target_role='reported' then
    notification_body:=case when action_type='warning' then 'По вашей жалобе пользователю выдано предупреждение.' else 'По вашей жалобе пользователь заблокирован. '||duration_label end;
    insert into public.moderation_push_jobs(report_id,report_kind,audience,owner_id,issued_by,title,body)
    values(report,report_kind,'reporter',reporter,auth.uid(),'Результат вашей жалобы',notification_body) returning id into receipt_job;
  end if;
  return query select ends_at,array_remove(array[subject_job,receipt_job],null::uuid);
end;
$$;
revoke all on function public.moderate_report_with_push(uuid,text,text,text,integer,text) from public,anon;
grant execute on function public.moderate_report_with_push(uuid,text,text,text,integer,text) to authenticated;

create or replace function public.get_my_pending_moderation_push_jobs()
returns table(id uuid) language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.auto_moderators m where m.user_id=auth.uid()) then raise exception 'Недостаточно прав модератора' using errcode='42501'; end if;
  return query select j.id from public.moderation_push_jobs j where j.issued_by=auth.uid() and j.push_sent_at is null
  and (j.push_claimed_at is null or j.push_claimed_at<now()-interval '5 minutes') order by j.created_at limit 50;
end;
$$;
revoke all on function public.get_my_pending_moderation_push_jobs() from public,anon;
grant execute on function public.get_my_pending_moderation_push_jobs() to authenticated;

create or replace function public.claim_moderation_push_jobs(job_ids uuid[],issuer uuid)
returns setof public.moderation_push_jobs language sql security definer set search_path=public as $$
  update public.moderation_push_jobs j set push_claimed_at=now(),push_error=null
  where j.id=any(job_ids) and j.issued_by=issuer and j.push_sent_at is null
  and (j.push_claimed_at is null or j.push_claimed_at<now()-interval '5 minutes') returning j.*;
$$;
revoke all on function public.claim_moderation_push_jobs(uuid[],uuid) from public,anon,authenticated;
grant execute on function public.claim_moderation_push_jobs(uuid[],uuid) to service_role;

create or replace function public.get_unread_account_moderation_notice()
returns table(id uuid,owner_id uuid,reason text,expires_at timestamptz,created_at timestamptz,kind text)
language sql stable security definer set search_path=public as $$
  select n.id,n.owner_id,n.reason,n.expires_at,n.created_at,n.kind from (
    select b.id,b.owner_id,b.reason,b.expires_at,b.created_at,'ban'::text as kind from public.account_ban_notices b where b.owner_id=auth.uid() and b.read_at is null
    union all
    select w.id,w.owner_id,w.reason,null::timestamptz,w.created_at,'warning'::text from public.account_warning_notices w where w.owner_id=auth.uid() and w.read_at is null
    union all
    select j.id,j.owner_id,j.body,null::timestamptz,j.created_at,'report-result'::text from public.moderation_push_jobs j where j.owner_id=auth.uid() and j.audience='reporter' and j.read_at is null
  ) n order by n.created_at,n.id limit 1;
$$;
revoke all on function public.get_unread_account_moderation_notice() from public,anon;
grant execute on function public.get_unread_account_moderation_notice() to authenticated;
notify pgrst,'reload schema';
commit;
