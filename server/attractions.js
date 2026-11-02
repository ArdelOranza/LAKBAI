// Mapbox categories are patchy — Tondaligan Beach Park comes back with none at
// all — so this is a deny-list, not an allow-list: drop the services a traveler
// would never want recommended and keep everything else.
const BLOCKED_CATEGORY_TOKENS = [
  'hospital', 'clinic', 'medical', 'health', 'pharmacy', 'drugstore',
  'police', 'fire station', 'government', 'administrative', 'court', 'jail',
  'prison', 'school', 'university', 'college', 'education', 'bank', 'atm',
  'financial', 'gas station', 'fuel', 'petrol', 'car repair', 'automotive',
  'post office', 'utility', 'waste', 'cemetery', 'funeral', 'laundry',
];

// The name check catches the hits Mapbox leaves uncategorised.
const BLOCKED_NAME = /\b(hospital|medical cent(?:er|re)|clinic|health cent(?:er|re)|lying-in|pharmacy|drugstore|police station|fire station|city hall|municipal hall|barangay hall|provincial capitol|capitol building|hall of justice|regional trial court|court|jail|prison|elementary school|high school|national high school|central school|college|university|academy|bank|atm|gas station|petrol station|post office|water district|electric cooperative|cemetery|funeral home)\b/i;

const EMERGENCY = /\b(hospital|emergency|ambulance|clinic|police|fire|accident|injured|medical)\b/i;

/** Places a traveler would actually visit. Emergency lookups keep everything. */
function isAttraction(place, intent){
  if (intent === 'emergency') return true;
  const cats = (place.categories || []).map(c => String(c).toLowerCase());
  if (cats.some(c => BLOCKED_CATEGORY_TOKENS.some(t => c.includes(t)))) return false;
  return !BLOCKED_NAME.test(String(place.name || ''));
}

/** One line appended to the AI request so fewer junk candidates come back. */
function attractionLine(message){
  if (!message) return '';
  if (EMERGENCY.test(String(message))) return '';
  return '\nSuggest only places a traveler would visit — attractions, restaurants, events or stays. Never hospitals, clinics, schools, banks, government offices or other services.';
}

module.exports = { BLOCKED_CATEGORY_TOKENS, isAttraction, attractionLine };
