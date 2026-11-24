// The three questions a traveler actually asks, and the question each one
// sends. Events and day plans are still answered from chat text; they do not
// need a pill of their own above the composer.
// The question follows the conversation: the place from the last answer,
// else the town the GPS says you are in, else Pangasinan as a whole.
import { haversineKm } from './geo.js';

export const TOPICS = [
  { id: 'places', label: 'Places', icon: 'pin' },
  { id: 'food', label: 'Food', icon: 'food' },
];

// Same town anchors the chips use — only to name the town, never to rank places.
const TOWNS = [
  { name: 'Dagupan', lng: 120.3431, lat: 16.0433 },
  { name: 'Lingayen', lng: 120.2315, lat: 16.0215 },
  { name: 'Alaminos', lng: 119.9800, lat: 16.1600 },
  { name: 'Urdaneta', lng: 120.5710, lat: 15.9760 },
  { name: 'San Carlos', lng: 120.3500, lat: 15.9300 },
  { name: 'Bayambang', lng: 120.3900, lat: 15.7500 },
  { name: 'Bolinao', lng: 119.8860, lat: 16.3340 },
  { name: 'Mangaldan', lng: 120.4030, lat: 16.0700 },
];

/** intent -> topic, so the row can show where the last answer came from. */
const ACTIVE = {
  discover: 'places',
  nearby: 'places',
  food: 'food',
};

function nearestTown(coords){
  if (!coords || !Number.isFinite(Number(coords.lng)) || !Number.isFinite(Number(coords.lat))) return null;
  let best = null;
  for (const town of TOWNS){
    const km = haversineKm(coords.lng, coords.lat, town.lng, town.lat);
    if (km != null && km <= 25 && (!best || km < best.km)) best = { town, km };
  }
  return best ? best.town.name : null;
}

function questionFor(id, place, town){
  if (place){
    if (id === 'food') return `Where should I eat near ${place}?`;
    return `Show me places like ${place}`;
  }
  const where = town || 'Pangasinan';
  if (id === 'food') return `Where should I eat in ${where}?`;
  return `Tourist spots in ${where}`;
}

/**
 * Three tabs, each with the question it would send right now.
 * @param {{ lastAi?: { intent?: string, cards?: Array<{name: string}> }, coords?: {lng:number, lat:number}, hasFix?: boolean }} state
 */
export function topicTabs({ lastAi, coords, hasFix = true } = {}){
  const place = lastAi?.cards?.[0]?.name || '';
  // Without a fix, `coords` is the province fallback centre — not the town the
  // traveler is in — so the chips must stay province-wide rather than name it.
  const town = hasFix === false ? null : nearestTown(coords);
  const active = ACTIVE[String(lastAi?.intent || '')] || null;
  return TOPICS.map(t => ({
    ...t,
    send: questionFor(t.id, place, town),
    active: t.id === active,
  }));
}
