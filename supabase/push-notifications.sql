-- Push-токены ЗаНомером. Выполни один раз в Supabase -> SQL Editor.
-- Токен принадлежит пользователю или анонимной гостевой сессии, а не хранит
-- контактные данные человека.

create table if not exists public.auto_push_tokens (
  token text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);

create index if not exists auto_push_tokens_owner_idx on public.auto_push_tokens(owner_id);

alter table public.auto_push_tokens enable row level security;

drop policy if exists "Users manage their own push tokens" on public.auto_push_tokens;
create policy "Users manage their own push tokens"
  on public.auto_push_tokens for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
