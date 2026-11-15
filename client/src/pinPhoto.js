/**
 * Photo inside a map pin (close view only).
 *
 * A pin is a tiny piece of the map, so it only earns a face when the traveler
 * is close enough to read it (the 1 km view). The photo then follows the same
 * hierarchy as every card: the first real photo the place already has
 * (curated → admin → committed Wikimedia). The Mapbox static map is a card
 * fallback, never a pin face — a map drawn inside a map reads as a second pin.
 */

/** True for a Mapbox Static Images URL (the card fallback, not a real photo). */
export function isStaticMap(url){
  return /api\.mapbox\.com\/.*\/static\//i.test(String(url || ''));
}

/** First real photo carried by a place, in list order. */
function firstPhoto(place){
  if (!place || typeof place !== 'object') return null;
  const list = Array.isArray(place.photos) ? place.photos : [];
  const candidate = list.find(p => typeof p === 'string' && p.trim())
    || (typeof place.photo === 'string' && place.photo.trim() ? place.photo : null);
  return candidate ? candidate.trim() : null;
}

/**
 * Wikimedia thumbnail at 960 px is far too heavy for an 18 px pin head.
 * The same file is served at a bucket width by swapping the thumb segment.
 * Wikimedia only accepts its standard buckets (120/250/500/960…), so 128 px
 * — the obvious "pin size" — returns HTTP 400 and the pin falls back to the
 * glyph. 120 px is the smallest valid bucket and still 3x the bubble size.
 * A non-thumb Wikimedia URL falls back to Special:FilePath with a width.
 */
function pinSized(url){
  // Wikimedia serves thumbs from upload.wikimedia.org and thumb.wikimedia.org.
  if (!/^https?:\/\/(?:[a-z0-9-]+\.)?wikimedia\.org\//i.test(url)) return url;
  const thumb = url.match(/^(.+\/thumb\/[^/]+\/[^/]+\/[^/]+\/)(\d+)px-(.+)$/i);
  if (thumb) return `${thumb[1]}120px-${thumb[3]}`;
  const file = url.match(/\/wikipedia\/commons\/[^/]+\/[^/]+\/([^/?#]+)$/i);
  if (file) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decodeURIComponent(file[1]))}?width=120`;
  return url;
}

/**
 * The photo URL for a pin head, or null when the pin should show its glyph.
 * `detailed` is the close-view state (zoom >= 12.5, i.e. the 1 km radius).
 */
export function pinPhoto(place, detailed = false){
  if (!detailed) return null;
  const url = firstPhoto(place);
  if (!url || isStaticMap(url)) return null;
  return pinSized(url);
}
