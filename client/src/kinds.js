/**
 * The five map chips, one normaliser.
 *
 * Places arrive with four different category vocabularies: curated spots
 * ("Beach", "Food"), the imported dataset ("Specialty Cafés, Bakeries & Milk
 * Tea", "Religious & Pilgrimage Site"), community submissions ("Stay",
 * "Culture") and Mapbox discoveries ("natural"). The map and the browse screens
 * must read all of them the same way, or a restaurant can be a pin but not a
 * Dining row. `kindsOf` maps each place to the chips it honestly answers.
 *
 * A place may answer more than one chip — a beach resort is both a hotel and a
 * beach. A place that answers none is "other", which is what the Others chip
 * shows (it is never a copy of All).
 */
const HOTEL = /hotel|resort|inn\b|lodge|hostel|guesthouse|guest house|villa|suites?|apartment|condo|homestay|pension|staycation|\bstay\b/i;
const RESTAURANT = /restaurant|restobar|food|cafe|café|coffee|grill|dining|diner|eatery|kitchen|kainan|carinderia|bakery|bakeshop|milk tea|buffet|fast ?food|culinary|pizza|pasta|sushi|ramen|bbq|barbecue|korean|japanese|italian|asian|cuisine/i;
const BEACH = /beach|coast|island|cove|sandbar|shore|seaside/i;
const CHURCH = /church|parish|basilica|cathedral|chapel|shrine|religious|pilgrimage/i;

const RULES = [
  ['hotel', HOTEL],
  ['restaurant', RESTAURANT],
  ['beach', BEACH],
  ['church', CHURCH],
];

/** The canonical chip kinds a place belongs to; ['other'] when none match. */
export function kindsOf(place){
  const p = place || {};
  const hay = [
    p.name,
    ...(Array.isArray(p.categories) ? p.categories : []),
    ...(Array.isArray(p.tags) ? p.tags : []),
  ].join(' ');
  const out = RULES.filter(([, re]) => re.test(hay)).map(([kind]) => kind);
  return out.length ? out : ['other'];
}

/** The primary chip label for a place, useful for badges. */
export function kindLabel(place){
  const k = kindsOf(place)[0];
  return k === 'other' ? 'Place' : k.charAt(0).toUpperCase() + k.slice(1);
}