-- Favorites keep the place categories so SavedTab can show category hints
-- without re-joining the live spots catalogue. store.js selects and writes
-- this column; without it PostgREST returns 42703 and the saved list breaks.
alter table favorites add column if not exists categories text[] not null default '{}';
