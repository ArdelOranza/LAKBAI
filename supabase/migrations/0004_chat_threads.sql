-- Persistent LakbAI chat. Threads belong to the signed-in traveler and follow
-- the account across devices; "New chat" archives rather than deletes.
create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table chat_threads enable row level security;

create policy "own chat threads" on chat_threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists chat_threads_user_updated
  on chat_threads (user_id, updated_at desc);

grant select, insert, update, delete on chat_threads to authenticated;