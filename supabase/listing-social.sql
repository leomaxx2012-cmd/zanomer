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
  with check (author_id = auth.uid());

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
