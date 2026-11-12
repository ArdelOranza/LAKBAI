// Composer chips that follow the conversation instead of repeating the same
// four prompts forever. Pure: no React, no icons, no side effects, so the rules
// can be tested on their own.
import { haversineKm } from './geo.js';

// Town centres, only used to say "you're standing in Dagupan". A fix within
// 25 km of one of these is close enough to name it in a suggestion.
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

const MAX = 4;

function nearestTown(coords){
  if (!coords || !Number.isFinite(Number(coords.lng)) || !Number.isFinite(Number(coords.lat))) return null;
  let best = null;
  for (const town of TOWNS){
    const km = haversineKm(coords.lng, coords.lat, town.lng, town.lat);
    if (km != null && km <= 25 && (!best || km < best.km)) best = { town, km };
  }
  return best ? best.town : null;
}

const DEFAULT = [
  { id: 'beach', label: 'Beaches near me', send: 'Best beaches near me' },
  { id: 'festival', label: 'Festivals this month', send: 'Which festivals are on this month?' },
];

/**
 * Up to four chips for the current state.
 * @param {{ lastAi?: { intent?: string, cards?: Array<{name: string}> }, coords?: {lng:number, lat:number} }} state
 */
export function suggestionsFor({ lastAi, coords } = {}){
  const out = [];
  const add = chip => {
    if (!chip || out.length >= MAX) return;
    if (out.some(c => c.label === chip.label)) return;
    out.push(chip);
  };

  const intent = String(lastAi?.intent || '');
  const card = lastAi?.cards?.[0];

  if (intent === 'commute'){
    add({ id: 'fare', label: 'Fare to another town', send: 'How much is the bus fare to Lingayen?' });
    add({ id: 'terminal', label: 'Closest terminal', send: 'Which bus terminal near me goes to Manila?' });
  } else if (card && card.name){
    add({ id: 'plan', label: 'Plan a day here', send: 'Plan a day trip to ' + card.name });
    add({ id: 'more', label: 'More like this', send: 'Show me more places like ' + card.name });
  }

  const town = nearestTown(coords);
  if (town){
    add({
      id: 'bus',
      label: `Bus from Cubao to ${town.name}`,
      send: `How much is the bus fare from Cubao to ${town.name}?`,
    });
  }

  if (!out.length) DEFAULT.forEach(add);
  return out;
}
