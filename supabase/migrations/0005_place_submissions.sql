-- Reviewed place submissions.
--
-- A traveller's submission is a `pending` row here. Nothing reaches the map
-- until an admin flips it to `approved`, and the API (service key) is the only
-- reader of pending rows. The row lives in Postgres because the API container
-- has no persistent disk: an approved place written to a file would disappear
-- on the next deploy.
--
-- Run by hand, then: notify pgrst, 'reload schema';

create table if not exists public.place_submissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected')),
  name          text not null check (char_length(btrim(name)) between 2 and 120),
  town          text not null check (char_length(btrim(town)) between 2 and 80),
  barangay      text check (barangay is null or char_length(barangay) <= 120),
  categories    text[] not null default '{}',
  -- Same Pangasinan box as server/places.js. A pin outside the province is
  -- refused by the database, not only by the form.
  lng           double precision not null check (lng between 119.7 and 120.7),
  lat           double precision not null check (lat between 15.7 and 16.5),
  note          text check (note is null or char_length(note) <= 500),
  hours         text check (hours is null or char_length(hours) <= 120),
  price         text check (price is null or char_length(price) <= 120),
  photo_path    text,
  photo         text,
  review_note   text,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One traveller cannot submit the same place twice while it is pending.
create unique index if not exists place_submissions_once_per_user
  on public.place_submissions (user_id, lower(btrim(name)), lower(btrim(town)));

create index if not exists place_submissions_queue
  on public.place_submissions (status, created_at);

create index if not exists place_submissions_user
  on public.place_submissions (user_id, created_at desc);

alter table public.place_submissions enable row level security;

-- A traveller inserts their own row, always as pending. No update policy:
-- nothing a client holds can turn a row into `approved`.
drop policy if exists "place_submissions insert own pending" on public.place_submissions;
create policy "place_submissions insert own pending" on public.place_submissions
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "place_submissions read own" on public.place_submissions;
create policy "place_submissions read own" on public.place_submissions
  for select to authenticated using (user_id = auth.uid());

-- Withdrawing is allowed only while it is still pending.
drop policy if exists "place_submissions withdraw own pending" on public.place_submissions;
create policy "place_submissions withdraw own pending" on public.place_submissions
  for delete to authenticated using (user_id = auth.uid() and status = 'pending');

-- Photos: private until approval. Objects live at <user_id>/<submission_id>.jpg.
insert into storage.buckets (id, name, public)
values ('place-submissions', 'place-submissions', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', true)
on conflict (id) do nothing;

-- A traveller writes only inside their own folder. Public read stays off, so a
-- pending photo is reachable only through a signed URL from the API.
drop policy if exists "place-submissions upload own" on storage.objects;
create policy "place-submissions upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'place-submissions' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "place-submissions read own" on storage.objects;
create policy "place-submissions read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'place-submissions' and (storage.foldername(name))[1] = auth.uid()::text);

-- The approved copy is served from the public bucket to everybody.
drop policy if exists "place-photos public read" on storage.objects;
create policy "place-photos public read" on storage.objects
  for select using (bucket_id = 'place-photos');

-- Service-role writes (approve copies the object) bypass RLS by design.