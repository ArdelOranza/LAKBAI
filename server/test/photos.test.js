const { test } = require('node:test');
const assert = require('node:assert/strict');
const { strictRelevant, findPhoto, findCommonsPhoto, hintFromAddress, photoHint, pickStrict, photoCacheKey } = require('../photos.js');

const pages = (...titles) => ({ query: { pages: Object.fromEntries(
  titles.map((t, i) => [i + 1, { title: t, thumbnail: { source: 'http://x/' + i + '.jpg' } }])
) } });

/** One page with extra Commons metadata (size, coordinates). */
const pageList = (...specs) => ({ query: { pages: Object.fromEntries(
  specs.map((s, i) => [i + 1, {
    title: s.title,
    thumbnail: { source: 'http://x/' + i + '.jpg' },
    ...(s.extra || {})
  }])
) } });

function respondWith(data, calls = []){
  return async url => {
    calls.push(String(url));
    return { ok: true, json: async () => data };
  };
}

test('strictRelevant keeps the feature noun, not just the town', () => {
  // "beach" must survive tokenising, or every Lingayen file matches.
  assert.equal(strictRelevant('File:Estanza Beach, Lingayen, Pangasinan.jpg', 'Estanza Beach'), true);
  assert.equal(strictRelevant('File:5772Estanza, Lingayen, Pangasinan 31.jpg', 'Estanza Beach'), false);
  assert.equal(strictRelevant('File:Sunset at Lingayen Capitol.jpg', 'Lingayen Beach'), false);
});

test('findPhoto rejects a barangay photo dump that only matches the town', async () => {
  // The reported bug: "Estanza Beach" showed a house from the 5772Estanza
  // Commons series, because only "estanza" was required to match.
  const fake = respondWith(pages('File:5772Estanza, Lingayen, Pangasinan 31.jpg'));
  const out = await findPhoto('Estanza Beach', 'Lingayen', 120.23, 16.02, { fetch: fake });
  assert.equal(out, null);
});

test('findPhoto rejects a landmark photo for a beach', async () => {
  const fake = respondWith(pages(
    'File:Sunset at Lingayen Capitol.jpg',
    'File:Urduja-Lingayen-Sep1982.jpg'
  ));
  const out = await findPhoto('Lingayen Beach', 'Lingayen', 120.23, 16.02, { fetch: fake });
  assert.equal(out, null);
});

test('findPhoto accepts a file that names the place and its feature', async () => {
  const fake = respondWith(pages(
    'File:5772Estanza, Lingayen, Pangasinan 31.jpg',
    'File:Estanza Beach, Lingayen, Pangasinan.jpg'
  ));
  const out = await findPhoto('Estanza Beach', 'Lingayen', 120.23, 16.02, { fetch: fake });
  assert.equal(out.src, 'http://x/1.jpg');
  assert.ok(out.page.includes('Estanza%20Beach'));
});

test('findPhoto rejects a house even when every name token is in the title', async () => {
  const fake = respondWith(pages('File:Lingayen Beach house.jpg', 'File:Estanza Beach interior.jpg'));
  assert.equal(await findPhoto('Lingayen Beach', 'Lingayen', 120.2, 16.0, { fetch: fake }), null);
});

test('findPhoto never calls Google image search', async () => {
  const calls = [];
  const hadCx = process.env.GOOGLE_CSE_ID;
  const hadKey = process.env.GEMINI_API_KEY;
  process.env.GOOGLE_CSE_ID = 'test-cx';
  process.env.GEMINI_API_KEY = 'test-key';
  try {
    const fake = respondWith(pages('File:Estanza Beach, Lingayen.jpg'), calls);
    const out = await findPhoto('Estanza Beach', 'Lingayen', 120.23, 16.02, { fetch: fake });
    assert.equal(out.src, 'http://x/0.jpg');
    assert.equal(calls.length, 1);
    assert.ok(calls.every(u => u.includes('commons.wikimedia.org')), calls.join(', '));
    assert.ok(calls.every(u => !u.includes('customsearch')), calls.join(', '));
  } finally {
    if (hadCx === undefined) delete process.env.GOOGLE_CSE_ID; else process.env.GOOGLE_CSE_ID = hadCx;
    if (hadKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = hadKey;
  }
});

test('findPhoto searches names only and never geosearches', async () => {
  const calls = [];
  const fake = respondWith(pages(), calls);
  const out = await findPhoto('Patar Beach', 'Bolinao', 119.79, 16.12, { fetch: fake });
  assert.equal(out, null);
  assert.equal(calls.length, 1, calls.join(', '));
  const q = new URL(calls[0]).searchParams.get('gsrsearch');
  // intitle: keeps barangay photo dumps out of the result set; the feature word
  // stays plain so the search is not over-specific.
  assert.equal(q, 'intitle:patar beach Bolinao');
  assert.equal(new URL(calls[0]).searchParams.get('generator'), 'search');
  assert.ok(calls[0].includes('categories'), 'location metadata arrives in the same call');
  assert.ok(!calls[0].includes('geosearch'), calls[0]);
  assert.ok(!calls[0].includes('ggscoord'), calls[0]);
});

test('a filler adjective does not block the right beach photo', () => {
  // "Abagatanen White Sand Beach" is the same beach as the Commons file
  // "Abagatanen Beach of Pangasinan.jpg". Demanding "white"/"sand" rejected it.
  assert.equal(strictRelevant('File:Abagatanen Beach of Pangasinan.jpg', 'Abagatanen White Sand Beach'), true);
});

test('a compound name matches a file that names any of its parts', () => {
  assert.equal(
    strictRelevant('File:Lingayen Beach (Lingayen, Pangasinan)(2018-02-25).jpg', 'Lingayen Beach & Lingayen Baywalk'),
    true
  );
  assert.equal(
    strictRelevant('File:Panacalan Island.jpg', 'Tondol White Sand Beach & Panacalan Island Sandbar'),
    true
  );
});

test('a brochure or collage is never a place photo', () => {
  assert.equal(strictRelevant('File:Abagatanen Beach brochure.jpg', 'Abagatanen White Sand Beach'), false);
  assert.equal(strictRelevant('File:Anea Cafe collage.jpg', 'Anea Cafe'), false);
});

test('a distinctive name still needs its feature noun', () => {
  // Lingayen alone is not a beach photo.
  assert.equal(strictRelevant('File:Lingayen Capitol.jpg', 'Lingayen Beach'), false);
  assert.equal(strictRelevant('File:Lingayen Beach.jpg', 'Lingayen Beach'), true);
});

test('the query pins only the distinctive words so recall stays wide', async () => {
  const calls = [];
  const fake = respondWith(pages(), calls);
  await findPhoto('Abagatanen White Sand Beach', 'Agno', undefined, undefined, { fetch: fake });
  const q = new URL(calls[0]).searchParams.get('gsrsearch');
  assert.equal(q, 'intitle:abagatanen beach Agno');
});

test('findCommonsPhoto rejects a different numbered feature', async () => {
  const fake = respondWith(pages(
    'File:Bolinao Falls 2.jpg',
    'File:Bolinao Falls 1.jpg'
  ));
  const out = await findCommonsPhoto('Bolinao Falls 1', 'Bolinao', undefined, undefined, { fetch: fake });
  assert.equal(out.src, 'http://x/1.jpg');
});

test('findCommonsPhoto rejects an unnumbered title for a numbered feature', async () => {
  const fake = respondWith(pages(
    'File:Bolinao Falls, Pangasinan.jpg',
    'File:Bolinao Falls, Pangasinan (2).jpg'
  ));
  const out = await findCommonsPhoto('Bolinao Falls 1', 'Bolinao', undefined, undefined, { fetch: fake });
  assert.equal(out, null);
});

test('findCommonsPhoto never calls Google image search', async () => {
  const calls = [];
  const hadCx = process.env.GOOGLE_CSE_ID;
  const hadKey = process.env.GEMINI_API_KEY;
  process.env.GOOGLE_CSE_ID = 'test-cx';
  process.env.GEMINI_API_KEY = 'test-key';
  try {
    const fake = respondWith(pages(), calls);
    const out = await findCommonsPhoto('Patar Beach', 'Bolinao', 119.79, 16.12, { fetch: fake });
    assert.equal(out, null);
    assert.ok(calls.length >= 1);
    assert.ok(calls.every(u => u.includes('commons.wikimedia.org')), 'commons only: ' + calls.join(', '));
  } finally {
    if (hadCx === undefined) delete process.env.GOOGLE_CSE_ID; else process.env.GOOGLE_CSE_ID = hadCx;
    if (hadKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = hadKey;
  }
});

test('the Commons hint is the town, never the postcode', () => {
  // "Lingayen, 2401, Philippines" sent 2401 to Commons. "intitle:lingayen
  // beach 2401" matched nothing, so Lingayen Beach never got its photo; the
  // same bug fed 2402 to Ruby's and surfaced an FBI report numbered CE 2402.
  assert.equal(hintFromAddress('Lingayen, 2401, Philippines'), 'Lingayen');
  assert.equal(hintFromAddress('Baywalk, Lingayen, 2401, Philippines'), 'Lingayen');
  assert.equal(hintFromAddress('Labrador - Sual Rd, Labrador, 2402, Philippines'), 'Labrador');
  assert.equal(hintFromAddress('Lingayen, Pangasinan, Philippines'), 'Lingayen');
  assert.equal(hintFromAddress(''), '');
});

test('the town hint finds the beach photo the postcode hid', async () => {
  const fake = respondWith(pages('File:Lingayen Beach.jpg'));
  const out = await findPhoto(
    'Lingayen Beach',
    hintFromAddress('Lingayen, 2401, Philippines'),
    120.23, 16.02,
    { fetch: fake }
  );
  assert.equal(out.src, 'http://x/0.jpg');
});

test('a PDF, diagram or recording is never a place photo', () => {
  // Ruby's (Labrador) showed page one of an FBI report because the PDF title
  // repeated the place tokens; a document cannot caption a restaurant.
  const pdf = 'File:CE 2402 FBI report of interviews of Dennis G. Brewer at Irving, Tex. and of various individuals whose names appeared in the personal effects of Jack Ruby - DPLA - 1c3ccbb472484be43fd252801c8f34bd.pdf';
  assert.equal(strictRelevant(pdf, "Ruby's"), false);
  assert.equal(strictRelevant('File:Sual Beach.svg', 'Sual Beach'), false);
});

test('a place named only after its town gets no borrowed photo', async () => {
  // Mapbox names some shops just "Lingayen". Any file naming the town passed,
  // so a church captioned an ice-cream shop. A miss is honest; the client
  // draws a map instead.
  const calls = [];
  const fake = respondWith(pages('File:Iglesia Ni Cristo in Lingayen No.1.jpg'), calls);
  assert.equal(await findPhoto('Lingayen', 'Lingayen', 120.23, 16.02, { fetch: fake }), null);
  assert.equal(calls.length, 0, 'no lookup at all for a town-only name');
});

test('a bare name needs location proof, not just a feature word', () => {
  // These places carry no address, so there is no town to lean on. "Patar" is
  // also an Indian poet, "Labrador" a dog breed, "Agno" a Swiss village whose
  // map scan reads "Agno - Swisstopo", and "Bautista" a river in Venezuela.
  assert.equal(strictRelevant('File:Surjit Patar.jpg', 'Patar'), false);
  assert.equal(strictRelevant('File:400-mork-labrador.png', 'Labrador'), false);
  assert.equal(strictRelevant('File:Agno - Swisstopo technical image 000-408-205.tif.jpg', 'Agno'), false);
  assert.equal(strictRelevant('File:5877San Agustin, Alaminos, Laguna 54.jpg', 'Alaminos'), false);
  assert.equal(strictRelevant('File:Ruby In Pool After Fetch.jpg', "Ruby's", 'Labrador'), false);
  // "Tondol Beach Sunset" names a feature, but so does "Bautista River". A
  // feature word is not location proof, so Commons metadata has to place the
  // file in Pangasinan (or at the place).
  const tondol = pageList({
    title: 'File:Tondol Beach Sunset by Gerald Mondala.jpg',
    extra: { categories: [{ title: 'Category:Sunsets of the Philippines' }] }
  });
  assert.ok(pickStrict(tondol, 'Tondol', 'Tondol', { lat: 16.3, lng: 119.9 }));
  const patar = pageList({
    title: 'File:Patar Beach.jpg',
    extra: { categories: [{ title: 'Category:Pangasinan' }] }
  });
  assert.ok(pickStrict(patar, 'Patar', 'Bolinao', { lat: 16.12, lng: 119.79 }));
  const bolinao = pageList({
    title: 'File:Bolinao beach low tide.jpg',
    extra: { coordinates: [{ lat: 16.356, lon: 119.813 }] }
  });
  assert.ok(pickStrict(bolinao, 'Bolinao', 'Bolinao', { lat: 16.33, lng: 119.79 }));
  // The province in the title is location proof by itself.
  assert.equal(strictRelevant('File:Sual pangasinan.jpg', 'Sual'), true);
});

test('a category naming another Pangasinan town is not location proof', () => {
  // "Burgos" was captioned with the San Carlos City Hall photo: the category
  // says San Carlos, and San Carlos is a different municipality.
  const burgos = pageList({
    title: 'File:05219jfBonifacio Burgos Soriano Palaris Halls Park San Carlos Pangasin5.JPG',
    extra: { categories: [{ title: 'Category:San Carlos City Hall (Pangasinan)' }] }
  });
  assert.equal(pickStrict(burgos, 'Burgos', 'Burgos', { lat: 16.07, lng: 119.87 }), null);
  // A category that is the town itself is fine: this is the Balungao bridge.
  const balungao = pageList({
    title: 'File:Balungao-bridge-Mt.jf6077 03.JPG',
    extra: { categories: [{ title: 'Category:Balungao' }] }
  });
  assert.ok(pickStrict(balungao, 'Balungao', 'Balungao', { lat: 15.9, lng: 120.5 }));
});

test('plus codes and postcodes never become the town hint', () => {
  // The curated Lingayen Beach row ends with "(Plus Codes: 26PM+RQ9, ...)".
  // Splitting on commas made the last part a plus code, so the real count of
  // Wikimedia hits was lost and the card fell back to a static map.
  const address = 'Capitol Beachfront, Alvear East / Maramba Blvd, Brgy. Maniboc and Brgy. Poblacion, Lingayen, 2401 Pangasinan (Plus Codes: 26PM+RQ9, 26PJ+WG4, 26PJ+JCH)';
  assert.equal(hintFromAddress(address), 'Lingayen');
  assert.equal(hintFromAddress('Poblacion, Lingayen, Pangasinan, Philippines'), 'Lingayen');
});

test('an explicit place hint wins over whatever the address ends with', () => {
  // The curated row already knows its town; parsing the address must not
  // overrule it.
  assert.equal(photoHint({ hint: 'Lingayen', address: 'Capitol Beachfront, Lingayen, 2401 Pangasinan (Plus Codes: 26PM+RQ9)' }), 'Lingayen');
  assert.equal(photoHint({ address: 'Baywalk, Lingayen, 2401, Philippines' }), 'Lingayen');
  assert.equal(photoHint({}), '');
});

test('findPhoto refuses a namesake with no address to disambiguate it', async () => {
  const fake = respondWith(pages(
    'File:Surjit Patar.jpg',
    'File:400-mork-labrador.png',
    'File:Agno - Swisstopo technical image 000-408-205.tif.jpg'
  ));
  assert.equal(await findPhoto('Patar', '', undefined, undefined, { fetch: fake }), null);
  assert.equal(await findPhoto('Labrador', '', undefined, undefined, { fetch: fake }), null);
  assert.equal(await findPhoto('Agno', '', undefined, undefined, { fetch: fake }), null);
});

test('a municipal flag is not a photo of the place', () => {
  // Anda, Infanta, Mabini, Mangatarem and Pozorrubio all showed their town
  // flag because the flag file names the town, not a place that looks like it.
  assert.equal(strictRelevant('File:Flag of Anda, Pangasinan.png', 'Anda', 'Anda'), false);
  assert.equal(strictRelevant('File:Flag of Mabini, Pangasinan.png', 'Mabini', 'Mabini'), false);
  assert.equal(strictRelevant('File:Flag of Pozorrubio, Pangasinan.png', 'Pozorrubio', 'Pozorrubio'), false);
});

test('a seal or icon smaller than a photo is not a place photo', () => {
  // Calasiao showed "Calasiao Pangasinan.png" — the municipal seal, 150x165.
  const data = pageList({ title: 'File:Calasiao Pangasinan.png', extra: { imageinfo: [{ width: 150, height: 165, mime: 'image/png' }] } });
  assert.equal(pickStrict(data, 'Calasiao', 'Calasiao', { lat: 16.0, lng: 120.35 }), null);
});

test('a same-named place in another country is not a place photo', () => {
  // Bautista is a river in Venezuela, Santa Maria is a font in Spain, Santa
  // Barbara is a California mission and a US town hall. The titles name the
  // town and nothing that places them in Pangasinan.
  assert.equal(strictRelevant('File:Boy playing in San Juan Bautista River.jpg', 'Bautista', 'Bautista'), false);
  assert.equal(strictRelevant('File:Santa Maria Organyà Pila bautismal.jpg', 'Santa Maria De Pila', 'Santa Maria'), false);
  assert.equal(strictRelevant('File:Santa Barbara Town Hall Monique Limon.jpg', 'Santa Barbara Town Hall', 'Santa Barbara'), false);
  assert.equal(strictRelevant('File:Inlaid decoration of shells for tabernacle at Mission Santa Barbara, ca.1905 (CHS-4463).jpg', 'Shell | Santa Barbara', 'Santa Barbara'), false);
});

test('a file geotagged far away is rejected even when the title matches', () => {
  // "Santo Tomas City Public Market, Batangas" is 250 km from Pangasinan;
  // "Agoo, La Union" is 56 km. Commons knows where its files were taken.
  const far = pageList({
    title: 'File:Santo Tomas City Public Market, Batangas, Sep 2026.jpg',
    extra: { coordinates: [{ lat: 14.1, lon: 121.1 }] }
  });
  assert.equal(pickStrict(far, 'Santo Tomas Public Market', 'Santo Tomas', { lat: 15.85, lng: 120.6 }), null);

  const near = pageList({
    title: 'File:Santo Tomas Public Market, Pangasinan.jpg',
    extra: { coordinates: [{ lat: 15.86, lon: 120.61 }] }
  });
  assert.ok(pickStrict(near, 'Santo Tomas Public Market', 'Santo Tomas', { lat: 15.85, lng: 120.6 }));
});

test('the province still lets a correct town photo through', () => {
  assert.equal(strictRelevant('File:Sual pangasinan.jpg', 'Sual', 'Sual'), true);
  assert.equal(strictRelevant('File:9324Baay, Lingayen, Pangasinan 44.jpg', 'Lingayen', 'Lingayen'), true);
});

test('the photo cache never shares a lookup between same-named places', () => {
  // Two Mapbox results called "Santo Tomas" 50 km apart shared one cache slot,
  // so the one near Manaoag was served the municipality's market photo.
  const town = photoCacheKey({ name: 'Santo Tomas', lat: 15.8671, lng: 120.5801 });
  const elsewhere = photoCacheKey({ name: 'Santo Tomas', lat: 16.2837, lng: 120.3887 });
  assert.notEqual(town, elsewhere);
  // The same place asked twice still hits its own entry.
  assert.equal(town, photoCacheKey({ name: 'santo tomas', lat: 15.867, lng: 120.58 }));
  // A row without coordinates keeps the old name|hint key.
  assert.equal(photoCacheKey({ name: 'Patar', hint: 'Bolinao' }), 'patar|bolinao|');
});

test('findCommonsPhoto surfaces rate limiting so callers can back off', async () => {
  const fake = async () => ({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(
    () => findCommonsPhoto('Patar Beach', 'Bolinao', undefined, undefined, { fetch: fake }),
    /rate|429/i
  );
});
