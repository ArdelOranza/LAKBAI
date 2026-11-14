const { test } = require('node:test');
const assert = require('node:assert/strict');
const { relevant, pickPhoto, findPhoto, findCommonsPhoto } = require('../photos.js');
test('relevant matches place words, rejects random files', () => {
  assert.equal(relevant('File:Patar Beach, Bolinao.jpg', 'Patar Beach', 'Bolinao'), true);
  assert.equal(relevant('File:Lucap, Alaminos, Pangasinan - panoramio (1).jpg', 'Hundred Islands', 'Alaminos'), false);
});
test('pickPhoto skips thumbless and irrelevant pages', () => {
  const data = { query: { pages: {
    1: { title: 'File:Random road.jpg', thumbnail: { source: 'http://x/1.jpg' } },
    2: { title: 'File:Patar Beach aerial.jpg' },
    3: { title: 'File:Patar Beach shoreline.jpg', thumbnail: { source: 'http://x/3.jpg' } }
  } } };
  const out = pickPhoto(data, 'Patar Beach', 'Bolinao');
  assert.equal(out.src, 'http://x/3.jpg');
  assert.ok(out.page.includes('Patar'));
});
test('findPhoto returns null when nothing relevant', async () => {
  const fake = async () => ({ ok: true, json: async () => ({ query: { pages: {
    9: { title: 'File:Somewhere else.jpg', thumbnail: { source: 'http://x/9.jpg' } }
  } } }) });
  const out = await findPhoto('Hundred Islands', 'Alaminos', 119.95, 16.21, { fetch: fake });
  assert.equal(out, null);
});
test('google image search wins when CSE is configured', async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(String(url));
    if (String(url).includes('customsearch')) {
      return { ok: true, json: async () => ({ items: [{ link: 'http://g/patar.jpg', image: { contextLink: 'http://g/page' } }] }) };
    }
    throw new Error('wikimedia must not run');
  };
  const hadCx = process.env.GOOGLE_CSE_ID;
  const hadKey = process.env.GEMINI_API_KEY;
  process.env.GOOGLE_CSE_ID = 'test-cx';
  process.env.GEMINI_API_KEY = 'test-key';
  const { findPhoto } = require('../photos.js');
  try {
    const out = await findPhoto('Patar Beach', 'Bolinao', 119.79, 16.12, { fetch: fake });
    assert.equal(out.src, 'http://g/patar.jpg');
    assert.equal(calls.length, 1);
  } finally {
    if (hadCx === undefined) delete process.env.GOOGLE_CSE_ID; else process.env.GOOGLE_CSE_ID = hadCx;
    if (hadKey === undefined) delete process.env.GEMINI_API_KEY;
  }
});
test('findPhoto prefers name match over nearby', async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(String(url));
    if (String(url).includes('generator=search')) {
      return { ok: true, json: async () => ({ query: { pages: {
        7: { title: 'File:Patar Beach, Bolinao.jpg', thumbnail: { source: 'http://x/name.jpg' } }
      } } }) };
    }
    throw new Error('geosearch must not run');
  };
  const out = await findPhoto('Patar Beach', 'Bolinao', 119.79, 16.12, { fetch: fake });
  assert.equal(out.src, 'http://x/name.jpg');
  assert.equal(calls.length, 1);
});
test('findCommonsPhoto rejects a different numbered feature', async () => {
  const fake = async () => ({ ok: true, json: async () => ({ query: { pages: {
    1: { title: 'File:Bolinao Falls 2.jpg', thumbnail: { source: 'http://x/2.jpg' } },
    2: { title: 'File:Bolinao Falls 1.jpg', thumbnail: { source: 'http://x/1.jpg' } },
  } } }) });
  const out = await findCommonsPhoto('Bolinao Falls 1', 'Bolinao', undefined, undefined, { fetch: fake });
  assert.equal(out.src, 'http://x/1.jpg');
});

test('findCommonsPhoto rejects an unnumbered title for a numbered feature', async () => {
  const fake = async () => ({ ok: true, json: async () => ({ query: { pages: {
    1: { title: 'File:Bolinao Falls, Pangasinan.jpg', thumbnail: { source: 'http://x/falls.jpg' } },
    2: { title: 'File:Bolinao Falls, Pangasinan (2).jpg', thumbnail: { source: 'http://x/falls2.jpg' } },
  } } }) });
  const out = await findCommonsPhoto('Bolinao Falls 1', 'Bolinao', undefined, undefined, { fetch: fake });
  assert.equal(out, null);
});

test('findCommonsPhoto never calls Google image search', async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(String(url));
    return { ok: true, json: async () => ({ query: { pages: {} } }) };
  };
  const hadCx = process.env.GOOGLE_CSE_ID;
  const hadKey = process.env.GEMINI_API_KEY;
  process.env.GOOGLE_CSE_ID = 'test-cx';
  process.env.GEMINI_API_KEY = 'test-key';
  try {
    const out = await findCommonsPhoto('Patar Beach', 'Bolinao', 119.79, 16.12, { fetch: fake });
    assert.equal(out, null);
    assert.ok(calls.length >= 1);
    assert.ok(calls.every(u => u.includes('commons.wikimedia.org')), 'commons only: ' + calls.join(', '));
  } finally {
    if (hadCx === undefined) delete process.env.GOOGLE_CSE_ID; else process.env.GOOGLE_CSE_ID = hadCx;
    if (hadKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = hadKey;
  }
});

test('findCommonsPhoto rejects unrelated nearby files', async () => {
  const fake = async (url) => {
    if (String(url).includes('generator=search')) {
      return { ok: true, json: async () => ({ query: { pages: {
        1: { title: 'File:Unrelated road.jpg', thumbnail: { source: 'http://x/no.jpg' } },
      } } }) };
    }
    return { ok: true, json: async () => ({ query: { pages: {
      2: { title: 'File:Balungao town hall.jpg', thumbnail: { source: 'http://x/hall.jpg' } },
    } } }) };
  };
  const out = await findCommonsPhoto('Municipality Park', 'Balungao', 120.8, 15.9, { fetch: fake });
  assert.equal(out, null);
});

test('findCommonsPhoto surfaces rate limiting so callers can back off', async () => {
  const fake = async () => ({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(
    () => findCommonsPhoto('Patar Beach', 'Bolinao', undefined, undefined, { fetch: fake }),
    /rate|429/i
  );
});

test('findPhoto falls back to nearby when name misses', async () => {
  const fake = async (url) => {
    if (String(url).includes('generator=search')) {
      return { ok: true, json: async () => ({ query: { pages: {
        8: { title: 'File:Unrelated road.jpg', thumbnail: { source: 'http://x/no.jpg' } }
      } } }) };
    }
    return { ok: true, json: async () => ({ query: { pages: {
      9: { title: 'File:Patar Beach shoreline.jpg', thumbnail: { source: 'http://x/geo.jpg' } }
    } } }) };
  };
  const out = await findPhoto('Patar Beach', 'Bolinao', 119.79, 16.12, { fetch: fake });
  assert.equal(out.src, 'http://x/geo.jpg');
});
