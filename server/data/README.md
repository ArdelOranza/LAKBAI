# Pangasinan dataset

Every `.json` file in this folder is part of the reference set:

- `places.json` — the verified restaurants
- `spots.json` — the verified tourist spots

As soon as at least one exists, `/api/chat` and `/api/recommend` stop searching
the web. The rows in these files — plus the curated attractions in
`server/spots.js` — are handed to the AI as its only source of truth, and every
place it names is matched back to a row before it reaches the app. A name that
is not in the file is dropped, so it cannot invent a place, rating, hours or
price. `agent.js` and its Google-search path are untouched; they simply stop
being used.

If the AI is unavailable, the server answers from the files directly instead of
erroring. The model chain is Gemini → Gemini lite → Groq, and each step is
independent, so one dead quota does not stop the answer. Set `LAKBAI_AI=off` to
skip the model entirely and always use the direct answer (zero cost).

`LAKBAI_DATA=/abs/path.json` narrows the set to a single file (the tests use it).

## Accepted shapes

Any of these work:

```json
[{ "name": "..." }, ...]
```

```json
{ "places": [ ... ] }
```

```json
{ "restaurants": [ ... ] }
```

`spots`, `items`, `entries`, `attractions`, `results` and `data` are also
recognised as the list key. A bare array anywhere in the object is used too.

## Fields (aliases in brackets)

| Field | Aliases | Notes |
|---|---|---|
| `name` | `title`, `place_name` | required |
| `municipality` | `town`, `city`, `locality`, `location` | used for matching + the card hint |
| `address` | `full_address`, `formatted_address`, `vicinity` | searched |
| `lat` / `lng` | `latitude` / `longitude`, `lon`, `coordinates.lat` / `.lng` | if missing, Mapbox geocodes once and caches |
| `rating` | `average_rating`, `avg_rating` | `"4.2/5 from 185 reviews"`, `4.2`, anything |
| `reviews` | `review_count`, `user_ratings_total`, `total_reviews` | `185`, `"1.2k"` |
| `categories` | `category`, `type`, `tags` | array or string |
| `opening_hours` | `hours` | array or string |
| `phone_number` | `phone`, `contact` | |
| `website` | `site` | |
| `google_maps_url` | `maps_url`, `map_url` | used as the card's source link |
| `description` | `blurb`, `about`, `summary` | |
| `real_reviews` | `reviews_list`, `top_reviews` | array of `{ rating, text }` or strings |
| `festival` | | optional |
| `price` | `price_range`, `fees`, `entrance_and_venue_fees` | object of named rates is flattened |
| `what_to_do_activities` | `activities` | array; shown to the AI, not on cards |
| `ratings_and_reviews` | | `{ overall_rating, total_review_count, verified_reviews: [{ quote }] }` |
| `verified_source_urls` | `sources` | used as the card's source link |
| `verified_image_urls` | `photos` | stored; not shown on spot cards |

Tourist-spot aliases: `official_name` → `name`, `municipality_or_city` → town,
`exact_location_address` → address, `detailed_description` → description.

If an address only carries a Google plus code (`RF54+F9V`) or DMS coordinates
(`15°49′11″N 120°26′39″E`), they are decoded into a real pin. A short plus code
whose town is unknown is left without coordinates rather than guessed, and
Mapbox geocodes it on first use instead.

Nothing is invented: a card only shows what the file states.
