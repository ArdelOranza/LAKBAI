const { test } = require('node:test');
const assert = require('node:assert/strict');
const { strictRelevant, findPhoto, findCommonsPhoto } = require('../photos.js');

const pages = (...titles) => ({ query: { pages: Object.fromEntries(
  titles.map((t, i) => [i + 1, { title: t, thumbnail: { source: 'http://x/' + i + '.jpg' } }])
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

test('findCommonsPhoto surfaces rate limiting so callers can back off', async () => {
  const fake = async () => ({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(
    () => findCommonsPhoto('Patar Beach', 'Bolinao', undefined, undefined, { fetch: fake }),
    /rate|429/i
  );
});
