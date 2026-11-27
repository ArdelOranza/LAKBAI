-- Harden place submissions: the traveller controls `photo_path`, and the API
-- reads it with the service key, which bypasses Storage RLS. Without a check a
-- pending row could point at another user's private object and an admin
-- preview/approval/rejection would sign, copy or delete that file.
--
-- Run by hand in the Supabase SQL editor, after 0005_place_submissions.sql.

-- 1. photo_path must be <the submitter's uid>/<safe file name>.<image ext>
--    The constraint is NOT VALID so an existing bad row cannot block the
--    deploy; it still applies to every new insert and update. After cleaning
--    old rows you can promote it with:
--      alter table public.place_submissions validate constraint place_submissions_photo_path_owned;
alter table public.place_submissions
  drop constraint if exists place_submissions_photo_path_owned;

alter table public.place_submissions
  add constraint place_submissions_photo_path_owned
  check (
    photo_path is null or (
      photo_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,128}\.(jpe?g|png|webp)$'
      and split_part(photo_path, '/', 1) = user_id::text
    )
  ) not valid;

-- 2. A submitter can only create a pending row: the published photo URL and
--    the review fields belong to the admin transition, never the insert.
drop policy if exists "place_submissions insert own pending" on public.place_submissions;
create policy "place_submissions insert own pending" on public.place_submissions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and photo is null
    and review_note is null
    and reviewed_at is null
  );

notify pgrst, 'reload schema';
