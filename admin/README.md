# Lakbai Admin — separate domain, not inside the traveller app

This is a **completely separate website**. It is not a route inside the main
app, not linked from the main app, and not built by the main app's
`vercel.json` (which outputs only `client/dist`).

Deploy this folder as its **own Vercel project / own domain**, for example:

| | Traveller app | Admin (separate) |
|---|---|---|
| Root directory | `client/` | `admin/` |
| Domain | `lakbai.example` | `admin.lakbai.example` (your private domain) |
| Build | `npm --prefix client run build` | `npm --prefix admin run build` |
| Output | `client/dist` | `admin/dist` |

`admin/vercel.json` is the admin site’s own config, so Vercel can import the
repo with **Root Directory = `admin`**.

## Run locally

```bash
ADMIN_TOKEN=your-secret npm --prefix server run start   # API on :3001
npm --prefix admin run dev      # Admin site on http://127.0.0.1:5174
```

Paste the same `ADMIN_TOKEN` in the admin header. Token lives only in that
browser’s `localStorage` and is sent as `x-admin-token`. Without it → 401;
with `ADMIN_TOKEN` unset on the server → 503 (admin disabled).

## Cross-domain in production

The admin site calls the API over HTTPS on a different domain, so set the
API base at build time:

```bash
VITE_API_URL=https://api.lakbai.example   # admin Vercel env var
```

The API server already allows CORS (`app.use(cors())`), so a separate admin
domain can reach `/api/admin/*` with the token header.

## What you can do (from the admin domain)

Two tabs, **Tourist spots** and **Restaurants**:

- Search/filter all curated Pangasinan spots (name, town, district, categories)
- Edit a site: name, town, district 1–6, categories, blurb, lng/lat, **photos**
- Add photos as **separate rows** — one URL per field, with a live preview, plus
  add/remove buttons. Save sends the whole list as an array.
- **Find real photo (Wikimedia)**, create/delete sites, “missing photos” filter
- Pick any of the 78-restaurant dataset rows and attach photos the same way

Edits persist in gitignored runtime files, layered over the committed source:

| Catalogue | Source (read-only) | Admin overlay |
|---|---|---|
| Tourist spots | `server/spots.js` | `server/data/admin-spots.json` |
| Restaurants | `server/data/places.json` | `server/data/admin-photos.json` |

The traveller app picks both up immediately. An admin photo always wins; an
empty photo list removes the overlay entry. Otherwise tourist spots fall back to
the precomputed Wikimedia map (`server/data/spot-photos.json`, rebuilt with
`node scripts/fetch-spot-photos.mjs`) and then to the Mapbox static map.
Restaurants show photos or a placeholder — they never get an invented image.

## Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/admin/spots` | token | list merged tourist-spot catalogue |
| `POST /api/admin/spots` | token | create |
| `PUT /api/admin/spots/:id` | token | edit name/town/coords/photos |
| `DELETE /api/admin/spots/:id` | token | remove |
| `POST /api/admin/photos/find` | token | `{name,town,lng,lat}` → real Wikimedia photo |
| `GET /api/admin/places` | token | list the restaurant dataset (read-only fields + photos) |
| `PUT /api/admin/places/:id/photos` | token | `{photos:[url,…]}` → saved overlay; `[]` clears |

Photo URLs must be `http(s)`; the API caps a list at 20 and answers 404 for an
unknown restaurant id.

Keep the admin domain unlisted (no links from the traveller app, `noindex`
meta) and change `ADMIN_TOKEN` in production.

