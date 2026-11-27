-- Admin documents that must survive a redeploy.
--
-- Render's free web service has no persistent disk. Admin edits (spots,
-- restaurant photos) and the Wikimedia photo cache were written to files inside
-- the container, which disappear on every deploy/restart. They live in this
-- table instead, one JSON document per row.
--
-- Run by hand in the Supabase SQL editor, after 0005_place_submissions.sql.
-- Then set on the API service:
--   LAKBAI_STORE=supabase
--   SUPABASE_URL=...          (already set)
--   SUPABASE_SERVICE_KEY=...  (already set)
-- The API uses the service key, which bypasses RLS; no policies are needed for
-- the public/anon role, and that is deliberate: browsers must never read or
-- write these documents directly.

create table if not exists public.admin_documents (
  name        text primary key check (char_length(name) between 1 and 80),
  doc         jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Keep updated_at honest without the API having to send it.
create or replace function public.touch_admin_document()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_documents_touch on public.admin_documents;
create trigger admin_documents_touch
  before update on public.admin_documents
  for each row execute function public.touch_admin_document();

-- RLS on with no policies: anon/authenticated get nothing, the service role
-- (used by the API) bypasses RLS. This is the same posture as the submitter's
-- email lookup and the private photo bucket.
alter table public.admin_documents enable row level security;
revoke all on public.admin_documents from anon, authenticated;

-- PostgREST caches the schema; without this the API keeps answering
-- "table not found" until the next deploy.
notify pgrst, 'reload schema';
