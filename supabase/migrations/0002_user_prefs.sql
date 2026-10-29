alter table profiles add column if not exists preferences text[] not null default '{}';
alter table profiles add column if not exists phone text;
alter table plans add column if not exists starts_at timestamptz;
