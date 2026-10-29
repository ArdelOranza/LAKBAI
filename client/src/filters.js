const FOOD = /restaurant|food|cafe|grill|dining|eat/i;
const EVENT = /festival|event/i;
export const MATCH = { Beaches:/beach|coast|island/i, Food:FOOD, Events:EVENT };
export function matches(place, label){
  if (label === 'All') return true;
  const hay = (place.categories || []).join(' ') + ' ' + (place.name || '');
  return MATCH[label] ? MATCH[label].test(hay) : true;
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
