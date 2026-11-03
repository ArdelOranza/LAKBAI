# Pangasinan dataset

Drop the verified Pangasinan file here as **`places.json`**.

As soon as that file exists, `/api/chat` and `/api/recommend` answer from it
instead of the Google-grounded Gemini call — no AI tokens, no invented places.
Remove the file (or set `LAKBAI_DATA` to another path) and the AI path comes
back unchanged.

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
| `price` | `price_range`, `fees` | optional |

Nothing is invented: a card only shows what the file states.
