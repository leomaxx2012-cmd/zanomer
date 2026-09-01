-- Посещаемость ЗаНомера. Выполни один раз в Supabase → SQL Editor → Run.
-- В таблице хранится только случайный идентификатор браузера, без IP, почты
-- и других личных данных. Повторный визит одного браузера учитывается раз в 5 минут.

create table if not exists public.site_visit_events (
  id bigint generated always as identity primary key,
  visitor_key text not null check (char_length(visitor_key) between 8 and 128),
  created_at timestamptz not null default now()
);

create index if not exists site_visit_events_created_at_idx
  on public.site_visit_events (created_at desc);
create index if not exists site_visit_events_visitor_created_idx
  on public.site_visit_events (visitor_key, created_at desc);

alter table public.site_visit_events enable row level security;

create or replace function public.record_site_visit(new_visitor_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_visitor_key is null or char_length(trim(new_visitor_key)) < 8 or char_length(new_visitor_key) > 128 then
    return;
  end if;

  if exists (
    select 1 from public.site_visit_events
    where site_visit_events.visitor_key = trim(new_visitor_key)
      and created_at > now() - interval '5 minutes'
  ) then
    return;
  end if;

  insert into public.site_visit_events (visitor_key) values (trim(new_visitor_key));
end;
$$;

create or replace function public.get_site_analytics()
returns table (
  total_visits bigint,
  unique_today bigint,
  visits_today bigint,
  unique_week bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_auto_moderator() then
    raise exception 'Недостаточно прав для просмотра аналитики';
  end if;

  return query
  select
    count(*)::bigint,
    count(distinct visitor_key) filter (where created_at >= date_trunc('day', now()))::bigint,
    count(*) filter (where created_at >= date_trunc('day', now()))::bigint,
    count(distinct visitor_key) filter (where created_at >= now() - interval '7 days')::bigint
  from public.site_visit_events;
end;
$$;

revoke all on public.site_visit_events from anon, authenticated;
grant execute on function public.record_site_visit(text) to anon, authenticated;
grant execute on function public.get_site_analytics() to authenticated;
