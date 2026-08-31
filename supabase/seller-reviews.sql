-- Оценки продавцов: один пользователь может оценить продавца один раз по объявлению.
create table if not exists public.seller_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.auto_listings(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  reviewer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  unique (listing_id, reviewer_id)
);

alter table public.seller_reviews enable row level security;

create policy "Everyone reads seller ratings" on public.seller_reviews for select using (true);
create policy "Chat participants rate sellers" on public.seller_reviews for insert to authenticated with check (
  reviewer_id = auth.uid() and seller_id <> auth.uid() and exists (
    select 1 from public.listing_messages m
    where m.listing_id = seller_reviews.listing_id
      and ((m.sender_id = auth.uid() and m.recipient_id = seller_reviews.seller_id)
        or (m.recipient_id = auth.uid() and m.sender_id = seller_reviews.seller_id))
  )
);
create policy "Reviewers update own seller ratings" on public.seller_reviews for update to authenticated using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());
