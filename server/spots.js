// LOCKED SCOPE: Pangasinan province only (user decision).
// Official Pangasinan tourist spots (user-supplied, by congressional district).
// photos: leave `photos: []` until real photo URLs exist — added by hand here
// later (no external fetches; this file is the single place to add them).
// lng/lat: resolved once by scripts/geocode-spots.mjs into spots-coords.json.
const DISTRICTS = {
  '1': [['Abagatanen Beach','Agno'],['Agnos Beach','Agno'],['Andron Buyanging Beach','Anda'],
    ['Balingasay River','Bolinao'],['Bangrin Marine Protected Area','Bani'],['Binabalian River','Infanta'],
    ['Bolinao Falls 1','Bolinao'],['Bolinao Falls 2','Bolinao'],['Bolinao Falls 3A','Bolinao'],
    ['Bolo Beach Resort','Alaminos'],['Cabongaoan Beach','Burgos'],['Cape Bolinao Lighthouse','Bolinao'],
    ['Colibra Island','Dasol'],['Death Pool','Burgos'],['Enchanted Cave','Bolinao'],
    ["Governor's Island",'Alaminos City'],['Hundred Islands National Park','Alaminos City'],['Marcos Island','Bani'],
    ['Nalsoc Cave','Bani'],['Patar Beach','Bolinao'],['Patar Rock Formation','Bolinao'],
    ['Pilgrimage Island','Alaminos City'],['Puerto del Sol','Bolinao'],['Rock Garden Resort','Bolinao'],
    ['Santiago Island','Bolinao'],['Sungayan Grill','Bolinao'],['Tara Falls','Bolinao'],
    ['Tambobong Beach','Dasol'],['Tondol Beach','Anda'],['Wonderful Cave','Bolinao']],
  '2': [['Binmaley Beach','Binmaley'],['Capitol','Lingayen'],['Daang Kalikasan','Mangatarem'],
    ['Lingayen Baywalk','Lingayen'],['Lingayen Heritage Park','Lingayen'],['Manleluag Spring National Park','Mangatarem'],
    ['Narciso Ramos Ancestral House Area','Lingayen'],['Narciso Ramos Sports and Civic Center (NRSCC)','Lingayen'],
    ['Tubuan Beach','Labrador'],['Urduja House Grounds','Lingayen'],['Veterans Memorial Park','Lingayen']],
  '3': [['Calasiao Puto and Pasalubong Center','Calasiao'],["Jech's Bakery & Restaurant",'Calasiao'],
    ['Les Boissons','Dagupan'],['Malacañang of the North Pangasinan','Bayambang'],["Mapandan People's Park",'Mapandan'],
    ['Minor Basilica of Saint Dominic','San Carlos City'],['Pisces Coffee Hub','San Carlos City'],
    ['Public Plaza','Santa Barbara'],['San Carlos City Plaza','San Carlos City'],
    ['Saints Peter & Paul Parish Church','Calasiao'],["Tito's Cafe",'San Carlos City']],
  '4': [['Bonuan Blue Beach','Dagupan City'],['Cafe Zero','Dagupan City'],['CSI Stadia and Lifestyle Center','Dagupan City'],
    ['Dawel River Cruise Area','San Fabian'],['Hardin sa Paraiso','Manaoag'],['Kainan ni Mang Peping','Dagupan'],
    ['Kanto Cafe Tapuac','Dagupan City'],['Manaoag Church (Minor Basilica of Our Lady of Manaoag)','Manaoag'],
    ['Mangaldan Plaza','Mangaldan'],['Pantal River','Dagupan City'],['Rizal Park','Manaoag'],
    ['San Fabian Beach','San Fabian'],['Silverios','Dagupan'],['Sunset Hill Cafe & Cabins','San Fabian'],
    ['Tondaligan Beach','Dagupan City']],
  '5': [['Antong Falls','Sison'],['Lipit Secret Falls','Sison'],["Matutina-Gerry's Seafood House",'Urdaneta City'],
    ['Saint Jude Thaddeus Parish Church of Pozorrubio','Pozorrubio'],['Little N','Sison'],
    ['Cathedral of Our Lady of the Immaculate Conception','Urdaneta City'],['Urdaneta City Plaza','Urdaneta City'],
    ['Villasis Plaza','Villasis']],
  '6': [['Balungao Hilltop Adventure and Hotspring','Balungao'],['Malico','San Nicolas'],
    ['Municipality Park','Balungao'],['San Nicolas Church','San Nicolas'],['Tayug Ecopark','Tayug'],['Umingan Plaza','Umingan']],
};
const CATEGORY_HINTS = [ // first matching regex wins; spot-check in the preview
  [/beach|river|island|cave|falls|pool|spring|hot ?spring|mangrove|hilltop|ecopark/i, ['Beach','Nature']],
  [/cafe|restaurant|bakery|puto|pasalubong|grill|seafood|stadia|lifestyle|silverios|boissons|kainan|matutina|pisces|jech|tito|little ?n/i, ['Food','Dining']],
  [/church|basilica|cathedral|parish|capitol|heritage|museum|malacanang|urduja|ancestral|civic|center/i, ['Heritage','Cultural']],
];
function categoriesFor(name){
  for (const [rx, cats] of CATEGORY_HINTS) if (rx.test(name)) return cats;
  return ['Heritage','Cultural']; // civic parks/plazas default
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
let COORDS = {};
try { COORDS = require('./spots-coords.json'); } catch { /* not geocoded yet */ }
const SPOTS = Object.entries(DISTRICTS).flatMap(([district, list]) => list.map(([name, town]) => {
  const id = slug(`${name}-${town}`);
  const c = COORDS[id] || [];
  return {
    id, name, town, district, categories: categoriesFor(name),
    blurb: '', photos: [], // photos added by hand later
    lng: Number.isFinite(c[0]) ? c[0] : null,
    lat: Number.isFinite(c[1]) ? c[1] : null,
  };
}));
// TODO coords (unresolved, add by hand): Nalsoc Cave (Bani), Urduja House Grounds
// (Lingayen), Malacañang of the North Pangasinan (Bayambang), Tito's Cafe
// (San Carlos City), Bonuan Blue Beach (Dagupan City), Cafe Zero (Dagupan City),
// San Nicolas Church (San Nicolas), Tayug Ecopark (Tayug).
// NOTE hand-check suspicion: Binabalian River (Infanta) geocoded to the same
// point as Balingasay River — likely wrong; fix by hand when convenient.
module.exports = { SPOTS };
