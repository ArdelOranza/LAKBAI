import { haversineKm } from './geo.js';

// Category browse ("Dining in Bolinao", "Beaches in Bolinao") over the curated
// spots list. Cuisine facets are derived from the place name, the same way
// server/spots.js derives categories — no invented tags.
const CUISINE = [
  ['Seafood', /seafood|grill|fish|inihaw|bagoong|bangus|oyster|talaba|sugpo|matutina/i],
  ['Cafés', /cafe|café|coffee|bakeshop|bakery|boissons|hub/i],
  ['Filipino', /resto|restaurant|kainan|carinderia|lutong|puto|pasalubong|jech|tito|peping/i],
];
const BEACH_RADIUS = { Near: 3, 'Within 5km': 5, 'Within 10km': 10 };

const hasCat = (p, names) => (p.categories || []).some(c => names.includes(c));

export function kindMatch(p, kind){
  if (kind === 'beaches') return hasCat(p, ['Beach']);
  if (kind === 'dining') return hasCat(p, ['Food', 'Dining']);
  return true;
}

export function cuisineTags(name){
  const s = String(name || '');
  return CUISINE.filter(([, re]) => re.test(s)).map(([tag]) => tag);
}

export function townsFor(spots, kind){
  const towns = (spots || []).filter(p => kindMatch(p, kind)).map(p => p.town).filter(Boolean);
  return [...new Set(towns)].sort();
}

export function nearestTown(spots, coords, kind){
  if (!coords) return townsFor(spots, kind)[0] || null;
  let best = null;
  for (const p of (spots || []).filter(x => kindMatch(x, kind))) {
    const km = haversineKm(coords.lng, coords.lat, p.lng, p.lat);
    if (km == null) continue;
    if (!best || km < best.km) best = { town: p.town, km };
  }
  return best ? best.town : (townsFor(spots, kind)[0] || null);
}

const byKm = (a, b) => {
  if (a.km == null && b.km == null) return 0;
  if (a.km == null) return 1;
  if (b.km == null) return -1;
  return a.km - b.km;
};

export function browseRows(spots, { kind = 'beaches', town, facet = 'All', coords } = {}){
  let rows = (spots || []).filter(p => kindMatch(p, kind));
  if (town) rows = rows.filter(p => p.town === town);

  if (kind === 'dining' && facet !== 'All') {
    rows = facet === 'More'
      ? rows.filter(p => cuisineTags(p.name).length === 0)
      : rows.filter(p => cuisineTags(p.name).includes(facet));
  }

  const withKm = rows.map(p => ({
    ...p,
    km: coords ? haversineKm(coords.lng, coords.lat, p.lng, p.lat) : null,
  }));

  const radius = kind === 'beaches' ? BEACH_RADIUS[facet] : null;
  if (radius != null) return withKm.filter(p => p.km != null && p.km <= radius).sort(byKm);
  return withKm.sort(byKm);
}
