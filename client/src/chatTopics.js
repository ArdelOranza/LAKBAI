// The five topics a traveler actually asks about, and the question each one
// sends. The question follows the conversation: the place from the last answer,
// else the town the GPS says you are in, else Pangasinan as a whole.
import { haversineKm } from './geo.js';

export const TOPICS = [
  { id: 'places', label: 'Places', icon: 'pin' },
  { id: 'food', label: 'Food', icon: 'food' },
  { id: 'events', label: 'Events', icon: 'event' },
  { id: 'commute', label: 'Commute', icon: 'bus' },
  { id: 'plan', label: 'Plan', icon: 'plan' },
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
  event: 'events',
  commute: 'commute',
  plan: 'plan',
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
    if (id === 'places') return `Show me places like ${place}`;
    if (id === 'food') return `Where should I eat near ${place}?`;
    if (id === 'events') return `What festivals happen near ${place}?`;
    if (id === 'commute') return `How much is the bus fare to ${place}?`;
    return `Plan a day trip to ${place}`;
  }
  const where = town || 'Pangasinan';
  if (id === 'places') return `Tourist spots in ${where}`;
  if (id === 'food') return `Where should I eat in ${where}?`;
  if (id === 'events') return `Which festivals and events are on in ${where}?`;
  // Without a named town the honest default is the provincial capital's route:
  // Cubao is the terminal most travelers actually leave from.
  if (id === 'commute') return town ? `How much is the bus fare from Cubao to ${town}?` : 'How much is the bus fare to Dagupan?';
  return `Plan a day trip in ${where}`;
}

/**
 * Five tabs, each with the question it would send right now.
 * @param {{ lastAi?: { intent?: string, cards?: Array<{name: string}> }, coords?: {lng:number, lat:number} }} state
 */
export function topicTabs({ lastAi, coords } = {}){
  const place = lastAi?.cards?.[0]?.name || '';
  const town = nearestTown(coords);
  const active = ACTIVE[String(lastAi?.intent || '')] || null;
  return TOPICS.map(t => ({
    ...t,
    send: questionFor(t.id, place, town),
    active: t.id === active,
  }));
}
