-- Публичные комментарии и личные лайки к объявлениям ЗаНомером.
-- listing_id хранится как text: это позволяет работать и с UUID объявлений сайта,
-- и с идентификаторами партнёрских объявлений Telegram.

create table if not exists public.listing_public_comments (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  body text not null check (char_length(body) between 1 and 600),
  created_at timestamptz not null default now()
);

create index if not exists listing_public_comments_listing_created_idx
  on public.listing_public_comments (listing_id, created_at);

create or replace function public.reject_prohibited_public_comment()
returns trigger language plpgsql as $$
begin
  if lower(new.body) ~ '(хуй|хуе|пизд|пізд|еба|їба|йоб|бля|бляд|сука|курва|мраз|гандон|идиот|fuck|shit|bitch|asshole|bastard|cunt|dick|whore|slut|huy|pizd|ebat|yob|blya|suka|kurwa)' then
    raise exception 'Комментарий содержит запрещённые слова';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_prohibited_public_comment on public.listing_public_comments;
create trigger reject_prohibited_public_comment
  before insert or update on public.listing_public_comments
  for each row execute function public.reject_prohibited_public_comment();

alter table public.listing_public_comments enable row level security;

drop policy if exists "Public comments are visible to everyone" on public.listing_public_comments;
create policy "Public comments are visible to everyone"
  on public.listing_public_comments for select using (true);

drop policy if exists "Authenticated users add their comments" on public.listing_public_comments;
create policy "Authenticated users add their comments"
  on public.listing_public_comments for insert to authenticated
  with check (author_id = auth.uid() and not exists (select 1 from public.auto_banned_users b where b.user_id = auth.uid()));

-- Жалобы на публичные комментарии. Связанный пользователь определяется на
-- сервере, чтобы клиент не мог подменить цель жалобы.
create table if not exists public.listing_public_comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.listing_public_comments(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  reported_user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id)
);

create or replace function public.fill_public_comment_report_details()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select author_id into new.reported_user_id from public.listing_public_comments where id = new.comment_id;
  if new.reported_user_id is null then raise exception 'Комментарий не найден'; end if;
  if new.reported_user_id = auth.uid() then raise exception 'Нельзя пожаловаться на себя'; end if;
  return new;
end;
$$;
drop trigger if exists listing_public_comment_reports_details on public.listing_public_comment_reports;
create trigger listing_public_comment_reports_details before insert on public.listing_public_comment_reports
  for each row execute function public.fill_public_comment_report_details();

alter table public.listing_public_comment_reports enable row level security;
drop policy if exists "Users submit public comment reports" on public.listing_public_comment_reports;
create policy "Users submit public comment reports" on public.listing_public_comment_reports for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists "Users see own public comment reports" on public.listing_public_comment_reports;
create policy "Users see own public comment reports" on public.listing_public_comment_reports for select to authenticated using (reporter_id = auth.uid());
drop policy if exists "Moderators view public comment reports" on public.listing_public_comment_reports;
create policy "Moderators view public comment reports" on public.listing_public_comment_reports for select to authenticated using (exists (select 1 from public.auto_moderators m where m.user_id = auth.uid()));

create table if not exists public.listing_likes (
  listing_id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

alter table public.listing_likes enable row level security;

drop policy if exists "Users see own listing likes" on public.listing_likes;
create policy "Users see own listing likes"
  on public.listing_likes for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users add own listing likes" on public.listing_likes;
create policy "Users add own listing likes"
  on public.listing_likes for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users remove own listing likes" on public.listing_likes;
create policy "Users remove own listing likes"
  on public.listing_likes for delete to authenticated using (user_id = auth.uid());
