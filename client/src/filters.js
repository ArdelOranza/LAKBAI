import { kindsOf } from './kinds.js';

const FOOD = /restaurant|food|cafe|grill|dining|eat/i;
const EVENT = /festival|event/i;
// Lodging: the words a resort/hotel/guesthouse actually carries. Kept apart
// from Food so "Beach Resort Restaurant" can answer both chips honestly.
export const HOTEL = /hotel|resort|inn\b|lodge|hostel|guesthouse|guest house|villa|suites?|apartment|condo|homestay|pension/i;
export const MATCH = { Beaches:/beach|coast|island/i, Hotels:HOTEL, Food:FOOD, Events:EVENT };
// The map's chips map 1:1 onto the shared normaliser (kinds.js).
const CHIP = { Hotels:'hotel', Restaurants:'restaurant', Beaches:'beach', Churches:'church' };

/**
 * Does a place answer a map chip? The new chips (Hotels/Restaurants/Beaches/
 * Churches/Others) read the one normaliser, so the map and the browse screens
 * can never disagree. The legacy Food/Events labels keep their old behaviour
 * for callers that still use them (search results).
 */
export function matches(place, label){
  if (label === 'All') return true;
  if (label === 'Food' || label === 'Events'){
    const hay = (place.categories || []).join(' ') + ' ' + (place.name || '');
    return label === 'Food' ? FOOD.test(hay) : Boolean(place.festival) || EVENT.test(hay);
  }
  const kinds = kindsOf(place);
  if (label === 'Others') return kinds.length === 1 && kinds[0] === 'other';
  const want = CHIP[label];
  return want ? kinds.includes(want) : true;
}
export function filterPlaces(places, kind){
  const ps = places || [];
  const hay = p => (p.categories || []).join(' ') + ' ' + (p.name || '');
  if (kind === 'food') return ps.filter(p => FOOD.test(hay(p)));
  if (kind === 'events') return ps.filter(p => p.festival || EVENT.test(hay(p)));
  if (kind === 'places') return ps.filter(p => !FOOD.test(hay(p)) && !(p.festival || EVENT.test(hay(p))));
  return ps;
}
export function feeLabel(fees){
  if (!fees || /free/i.test(String(fees))) return 'Free';
  return String(fees);
}