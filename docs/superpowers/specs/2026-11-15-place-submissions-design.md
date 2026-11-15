# LakbAI Place Submissions — Design Spec

**Date:** 2026-11-15
**Status:** Draft for review

## Summary

Let a signed-in traveller add a place that is missing from the map, and let the
admin app review it before anyone else sees it. One Supabase table holds the
submission from `pending` to `approved`, so an approved place survives a Render
redeploy — the current admin catalogue file does not (no persistent disk), which
is the reason we are not reusing it.

Approved decisions from brainstorming:

- **Admin review first.** Nothing reaches the map until an admin approves it.
- **Signed-in travellers only.** No anonymous submissions.
- **Optional photo upload.** The reviewer decides whether the photo publishes.
- **One table with a status column** (approach A), not a queue plus a copy.
- No separate business account type: a business is a signed-in user submitting
  places, and can add its branches one after another in the same session.

Success criteria: a traveller can pin a place and submit it in under a minute;
a pending submission never appears on the map, in `/api/spots`, or in a public
URL; an approved one appears on the map without a redeploy and survives one.

## Out of scope (deliberate)

- Chat and `/api/recommend` still answer from the committed file datasets, so a
  brand-new community place is on the map and in `/api/spots` but not yet in chat
  answers. Making `dataset.js` async is a separate change.
- Editing an approved community place from the traveller app. The admin edits it
  (a follow-up tab), or rejects it before approval.
- Reviewer-side photo upload: admins keep the existing photo finder.

## Data model

Migration `supabase/migrations/0005_place_submissions.sql`:

```sql
create table public.place_submissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected')),
  name          text not null check (length(btrim(name)) between 2 and 120),
  town          text not null,
  barangay      text,
  categories    text[] not null default '{}',
  lng           double precision not null check (lng between 119.7 and 120.7),
  lat           double precision not null check (lat between 15.7 and 16.5),
  note          text check (note is null or length(note) <= 500),
  hours         text check (hours is null or length(hours) <= 120),
  price         text check (price is null or length(price) <= 120),
  photo_path    text,
  photo         text,
  review_note   text,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

- The `lng`/`lat` checks are the same Pangasinan bbox lock as `server/places.js`
  (`119.7,15.7,120.7,16.5`). A pin outside the province is rejected by the
  database, not only by the form.
- `town` is a value from the known town list, enforced by the form; the column
  stays text so a new town does not need a migration.
- `hours` and `price` are free text **as the submitter reported them**. The UI
  labels them "reported by the submitter"; they are never presented as verified
  fact and never enter fare data.

Indexes and constraints:

```sql
create unique index place_submissions_once_per_user
  on public.place_submissions (user_id, lower(btrim(name)), lower(btrim(town)));
create index place_submissions_queue on public.place_submissions (status, created_at);
```

RLS:

```sql
alter table public.place_submissions enable row level security;

create policy "insert own pending" on public.place_submissions
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

create policy "read own" on public.place_submissions
  for select to authenticated using (user_id = auth.uid());

create policy "withdraw own pending" on public.place_submissions
  for delete to authenticated using (user_id = auth.uid() and status = 'pending');
```

No update policy: a submitter cannot edit a row into `approved`, and cannot
rewrite one after review. The API uses `SUPABASE_SERVICE_KEY`, which bypasses RLS
by design; nothing else does.

## Photo pipeline

- Private bucket `place-submissions`; object key `${user_id}/${submission_id}.jpg`.
  Policies: authenticated insert/select limited to `(storage.foldername(name))[1] = auth.uid()::text`.
  Bucket limits: 5 MB, `image/jpeg|png|webp`.
- The client uploads the file first, then inserts the row with `photo_path` set.
  A failed upload degrades to a photo-less submission instead of losing the form.
- The admin app never receives a public URL for a pending photo: it calls
  `GET /api/admin/submissions/:id/photo`, which returns a 60-second signed URL.
- Approve: the server copies the object from `place-submissions` into the public
  bucket `place-photos` and writes the public URL into `photo`. Reject: the server
  deletes the private object. A pending photo is therefore never publicly readable.

## Client UI

Existing tokens and components only — `--primary #0066FF`, `--ink #0A2540`,
`--muted-ink #64748B`, `--radius 16px`, `.field`, `.primary-btn`, `.spot-sheet`
(24 px top radius, bottom-sheet pattern). No new colour enters the app.

**Entry points**

1. Map: a 48 px round white FAB, bottom-right, above the nav bar
   (`bottom: calc(92px + var(--safe-bottom))`), pin-plus icon in `--primary`,
   shadow `0 10px 24px -12px rgba(10,37,64,.28)`, `aria-label="Add a missing place"`.
2. The "no stops here" state on the map and the empty search-results state each
   get a quiet text link, "Can't find it? Add a missing place".

**Sheet 1 — pin (bottom sheet, 86 vh max)**

- Title "Add a missing place", close affordance top-right.
- Map preview ~240 px tall with a centre pin fixed to the middle of the box; the
  map pans under it. This is the "Choose on map" mode and the default.
- Above the map, a two-option segmented control: **Use my location now** /
  **Choose on map**. "Use my location" is disabled with the label "Waiting for
  GPS…" until there is a real fix; it never uses the Lingayen fallback centre and
  never re-centres on a guess.
- Below: the chosen point as `16.0433, 120.3431` in 12 px mono-ish muted type,
  plus "Move the map to place the pin" helper copy.
- Primary button "Continue" (`.primary-btn`, 52 px), disabled until a point exists.
- Locked to the province bbox: panning past it clamps, and a point outside it
  cannot continue.

**Sheet 2 — details**

- Fields, `.field` (14 px radius, `#F7F9FC`) stacked with 12 px gaps: Name
  (autofocus), Category (chips, single select from the existing vocabulary,
  stored as a one-element `categories` array), Town (select, required, no
  default), Barangay (optional), Hours (optional), Price range (optional), Note
  (textarea, "Why should this be on the map?").
- Photo: one optional 96 px square dashed tile "Add a photo"; after picking, a
  thumbnail with a remove ×. Copy under it: "Reviewed before it appears."
- Footer: primary "Send for review" (disabled until name + category + town are
  set), secondary text button "Back". While saving: button shows "Sending…" and
  the sheet cannot be dismissed by the scrim.
- Success replaces the sheet body with a check mark, "Sent for review", "It
  appears on the map once an editor approves it. You can follow it in
  Profile → My submissions." and a single "Done" button. No pin is drawn
  optimistically.

**Profile → My submissions**

- New menu row under My Reviews. List rows: name, town, submitted date, and a
  status pill — `Pending` (`#EFF6FF` bg, `--primary` text), `Live` (white bg,
  `--ink`, check icon), `Not added` (white bg, `--muted-ink`, with the reviewer's
  note beneath). Pending rows carry a "Withdraw" text button with confirm.
- Empty state: "Nothing submitted yet. Spotted a place we're missing? Add it from
  the map."

**Quality bar for every new surface**

- Minimum 44 px touch height on every control (the compact chip rows are the
  exception only where the parent already provides the target).
- One primary action per screen; secondary actions are text buttons, never two
  filled buttons side by side.
- 16 px gutters, 12 px vertical rhythm between fields, 24 px sheet radius.
- Every disabled control says why: "Waiting for GPS…", not a dead grey button.
- No new fonts, no new accent colours, no shadows outside `--shadow`.
- Layout verified at 320, 360 and 390 px widths: no clipped labels, no wrapped
  button text, no horizontal scroll except the deliberate chip rows.

## Admin UI

- Third segment in the existing switcher: **Spots | Restaurants | Submissions**,
  with a count badge for pending rows.
- Two-pane layout already used by the app: queue on the left (name, town, age,
  photo dot), editor on the right.
- Editor: photo preview (thumb, click to open full size), category chips, name,
  town/barangay, coordinates, note, reported hours/price, submitter email.
- Duplicate guard: "Nearest existing places" list with haversine distance
  (50 m / 120 m / 400 m) so the admin can see a near-duplicate before approving.
- Actions: **Approve** (primary) and **Reject** (secondary; opens a required note
  field, 5–200 chars, with the reason shown to the submitter).
- Empty queue: "No submissions waiting" with a check icon, not a blank pane.

## Server

- `GET /api/spots` becomes: existing `adminStore.listSpots()` **plus** approved
  community places mapped to the spot shape
  (`{ id: 'community-<uuid>', name, town, categories, lng, lat, blurb: note,
  photos: photo ? [photo] : [], photo, photoSource: 'community' }`).
  Cached 60 s in-process; approving invalidates the cache, so a new pin appears on
  the next fetch without a redeploy.
- New module `server/communityPlaces.js`: `approvedSpots()`, `invalidate()`,
  `approve(id)`, `reject(id, note)`, `listQueue(status)`, `photoUrl(id)`,
  `toSpot(row)`. Pure mapping separated from Supabase calls so the shape is
  testable without a database.
- Admin endpoints, all behind `adminStore.requireAdmin`:
  - `GET /api/admin/submissions?status=pending`
  - `POST /api/admin/submissions/:id/approve`
  - `POST /api/admin/submissions/:id/reject` — body must contain a note
  - `GET /api/admin/submissions/:id/photo` — signed URL
- If `SUPABASE_SERVICE_KEY` is missing or the table does not exist yet, the queue
  endpoint returns `{ submissions: [] }` and `/api/spots` returns the file
  catalogue unchanged, so the deploy order does not break the map.

## Error handling

- Client: offline submit → "You're offline. Try again when you have a signal." and
  keep the form state; duplicate (unique index) → "You already submitted this
  place."; photo upload failure → submit without the photo and say so.
- Server: approve on a non-pending row → 409; reject without a note → 400;
  unknown id → 404; Supabase failure → 503 with a short message, never a stack.
- Admin: a failed approve keeps the row in the queue and shows the error inline.

## Testing

Server (`server/test/communityPlaces.test.js`, plus index route tests):

1. `toSpot` maps a row to the spot shape, including `photoSource: 'community'`
   and the `community-` id prefix.
2. Approved rows appear in `/api/spots`; pending and rejected rows do not.
3. Approve a pending row → status approved, cache invalidated. Approve twice → 409.
4. Reject without a note → 400 with a note requirement; with a note → status
   rejected and the note stored.
5. Admin endpoints reject a missing/wrong token (401/403).
6. Missing Supabase config → `/api/spots` still serves the file catalogue.

Client:

7. "Use my location" with no fix leaves Continue disabled and shows
   "Waiting for GPS…"; it never sends the fallback centre.
8. Continue is disabled until a pin exists; a pin outside the bbox is refused.
9. Send is disabled until name, category and town are set.
10. Logged-out tap opens login and returns to the form with the pin intact.
11. Success copy says review, not published; no optimistic pin is added to the map.
12. Withdraw is offered only on pending rows.

Admin:

13. Pending rows render with a count badge; approving removes the row from the
    queue and the editor resets.
14. Reject requires a note before the request fires.

Visual: measured checks at 320/360/390 px for the two sheets (no clipped labels,
no wrapped buttons, 44 px minimum control height), plus one manual pass over the
admin submissions tab.

## Rollout

1. Run `0005_place_submissions.sql` in Supabase, then `notify pgrst, 'reload schema';`.
2. Deploy the API (queue endpoints return empty until the table exists).
3. Deploy the admin app, then the client.
4. Manual smoke on the live site: submit from a phone-sized viewport, approve in
   admin, confirm the pin appears on the map and in `/api/spots`.