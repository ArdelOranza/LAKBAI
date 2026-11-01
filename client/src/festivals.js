// Curated Pangasinan festivals (user ruling: real data only, no invented events).
// Dates are the annual recurring schedule; organisers shift them year to year, so
// treat month/day as the usual window rather than a fixed appointment.
// lng/lat are town centroids from spots-coords.json (same source as the map pins).
export const FESTIVALS = [
  {
    id: 'hundred-islands-festival', name: 'Hundred Islands Festival', town: 'Alaminos City',
    month: 3, day: 19, endMonth: 3, endDay: 19, venue: 'Alaminos City',
    lng: 119.97467, lat: 16.158,
    blurb: 'Paraw parade and talaba ihaw-ihaw feast closing the city fiesta.',
  },
  {
    id: 'bangus-festival', name: 'Bangus Festival', town: 'Dagupan',
    month: 4, day: 1, endMonth: 4, endDay: 30, venue: 'Dagupan City',
    lng: 120.33633, lat: 16.03667,
    blurb: 'Month-long milkfish celebration capped by the Kalutan ed Dalan street grilling.',
  },
  {
    id: 'pandan-festival', name: 'Pandan Festival', town: 'Mapandan',
    month: 4, day: 11, endMonth: 4, endDay: 16, venue: 'Mapandan',
    lng: 120.453, lat: 16.027,
    blurb: 'Street dancing and pandan-themed props honouring the town’s weaving trade.',
  },
  {
    id: 'binongey-festival', name: 'Binongey Festival', town: 'Anda',
    month: 4, day: 17, endMonth: 4, endDay: 17, venue: 'Anda',
    lng: 119.91, lat: 16.3355,
    blurb: 'Island-town fiesta with coastal dances and a banca parade off Tondol.',
  },
  {
    id: 'mangunguna-festival', name: 'Mangunguna Festival', town: 'Bolinao',
    month: 4, day: 17, endMonth: 4, endDay: 24, venue: 'Poblacion, Bolinao',
    lng: 119.86907, lat: 16.30293,
    blurb: 'Fisherman’s festival — street dancing, banca races and a seafood cook-off.',
  },
  {
    id: 'mango-bamboo-festival', name: 'Mango-Bamboo Festival', town: 'San Carlos City',
    month: 4, day: 20, endMonth: 4, endDay: 27, venue: 'San Carlos City',
    lng: 120.34867, lat: 15.924,
    blurb: 'Trade fair and parades for the city’s mango and bamboo industries.',
  },
  {
    id: 'pistay-dayat', name: 'Pista’y Dayat', town: 'Lingayen',
    month: 4, day: 24, endMonth: 5, endDay: 1, venue: 'Capitol Beach, Lingayen',
    lng: 120.28533, lat: 16.09233,
    blurb: 'The province’s Festival of the Sea — banca parada, sand sculptures, beach sports.',
  },
  {
    id: 'galicayo-festival', name: 'Galicayo Festival', town: 'Manaoag',
    month: 12, day: 1, endMonth: 12, endDay: 9, venue: 'Manaoag',
    lng: 120.502, lat: 16.03167,
    blurb: 'Lantern parade and street dancing for the Our Lady of Manaoag apparition.',
  },
  {
    id: 'puto-festival', name: 'Puto Festival', town: 'Calasiao',
    month: 12, day: 8, endMonth: 12, endDay: 14, venue: 'Calasiao',
    lng: 120.35033, lat: 16.01567,
    blurb: 'Puto Calasiao at its centre — cooking contests, stalls and street parties.',
  },
];

const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

function edition(year, f){
  const starts = new Date(year, f.month - 1, f.day);
  const ends = new Date(year, (f.endMonth || f.month) - 1, f.endDay || f.day);
  if (ends < starts) ends.setFullYear(ends.getFullYear() + 1); // window crosses New Year
  return { starts, ends };
}

function editionFor(f, from){
  const now = startOfDay(from);
  for (const year of [from.getFullYear(), from.getFullYear() + 1]) {
    const ed = edition(year, f);
    if (endOfDay(ed.ends) >= now) return ed;
  }
  return edition(from.getFullYear() + 2, f);
}

/** Start date of the current or next edition of one festival. */
export function nextOccurrence(f, from = new Date()){
  return editionFor(f, from).starts;
}

/** Festivals with their current/next edition, soonest start first. */
export function upcomingFestivals(list = FESTIVALS, from = new Date()){
  return (list || [])
    .map(f => ({ ...f, ...editionFor(f, from) }))
    .sort((a, b) => a.starts - b.starts);
}

/** Editions whose window overlaps the calendar month of `from`. */
export function thisMonthFestivals(list = FESTIVALS, from = new Date()){
  const monthStart = new Date(from.getFullYear(), from.getMonth(), 1);
  const monthEnd = endOfDay(new Date(from.getFullYear(), from.getMonth() + 1, 0));
  return upcomingFestivals(list, from).filter(f => f.starts <= monthEnd && f.ends >= monthStart);
}
