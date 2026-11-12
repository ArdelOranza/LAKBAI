const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

process.env.LAKBAI_DATA = path.join(__dirname, 'fixtures', 'dataset.json');

const { buildContext, hydrate, groundedChat, groundedRecommend } = require('../grounded.js');
const { allEntries, NO_MATCH } = require('../dataset.js');

const fake = payload => async () => JSON.stringify(payload);

test('the context hands the AI the verified rows, not a web search', () => {
  const { text, hits } = buildContext('where can I eat in Dagupan', '120.341,16.043');
  assert.ok(hits.length > 0);
  assert.match(text, /RECORDS:/);
  assert.match(text, /Conrad's Dagupan/);
  assert.match(text, /185 reviews/);
  assert.match(text, /Traveler is in/);
});

test('the traveler profile rides along as a fact, clearly labeled', () => {
  const { text } = buildContext('where can I eat', '120.341,16.043', {
    profile: 'Ana. Interests: Beaches, Food & Dining. Local time: Thu 14:05 (Asia/Manila).',
  });
  assert.match(text, /Traveler profile: Ana\. Interests: Beaches, Food & Dining\./);
  assert.match(text, /Traveler is in Dagupan/);
});

test('without a GPS fix the AI is told not to claim a town', () => {
  const { text } = buildContext('where can I eat', '120.23,16.03', { hasFix: false });
  assert.match(text, /location is not known/);
  assert.doesNotMatch(text, /Traveler is in/);
});

test('groundedChat hands the profile to the model, not just the builder', async () => {
  let seen = '';
  const askFn = async (_system, payload) => {
    seen = payload;
    return JSON.stringify({ intent: 'discover', answer: 'ok', candidates: [] });
  };
  await groundedChat('beaches', '120.341,16.043', {
    askFn, profile: 'Ana. Interests: Beaches.', hasFix: true,
  });
  assert.match(seen, /Traveler profile: Ana\. Interests: Beaches\./);
});

test('terminal facts ride in the model payload, not just the fare block', async () => {
  let seen = '';
  const askFn = async (_system, payload) => {
    seen = payload;
    return JSON.stringify({ intent: 'commute', answer: 'ok', candidates: [] });
  };
  await groundedChat('Which terminal in Cubao goes to Bolinao?', '121.0485,14.6240', { askFn });
  assert.match(seen, /TERMINAL FACTS/);
  assert.match(seen, /Five Star Bus Co\. Cubao Terminal/);
});

test('an invented terminal phone is rebuilt from the directory rows', async () => {
  const askFn = async () => JSON.stringify({
    intent: 'commute',
    answer: 'Call **Victory Liner Cubao** at +63 999 111 2222.',
    candidates: [],
  });
  const out = await groundedChat('Which bus terminal is closest to me?', '121.0485,14.6240', { askFn });
  assert.equal(out.intent, 'commute');
  assert.doesNotMatch(out.answer, /999 111 2222/);
  assert.match(out.answer, /Cubao/);
});

test('a request that matches nothing still gets the index to choose from', () => {
  const { text, hits } = buildContext('somewhere for a quiet anniversary', '120.341,16.043');
  assert.equal(hits.length, 0);
  assert.match(text, /INDEX/);
  assert.match(text, /Tondaligan Beach Park/);
});

test('an invented name is dropped, even if the AI insists', () => {
  const picked = hydrate([
    { name: 'Fake Beach Resort' },
    { name: "Conrad's Dagupan", reason: 'Good bagnet.' },
  ], allEntries());
  assert.equal(picked.length, 1);
  assert.equal(picked[0].entry.name, "Conrad's Dagupan");
});

test('chat keeps the file rating, never the model rating', async () => {
  const out = await groundedChat('food in Dagupan', '120.341,16.043', {
    askFn: fake({
      intent: 'food',
      answer: 'Conrad’s is the pick.',
      candidates: [{ name: "Conrad's Dagupan", reason: '4.2★ from 185 reviews.', rating: '5.0', reviews: '9999' }],
      sources: [],
    }),
  });
  assert.equal(out.source, 'dataset+ai');
  assert.equal(out.candidates.length, 1);
  assert.equal(out.candidates[0].rating, '4.2');
  assert.equal(out.candidates[0].reviews, '185');
  assert.equal(out.candidates[0].hint, 'Dagupan City');
});

test('if the AI only names places outside the file, the reply is the honest no-match line', async () => {
  const out = await groundedChat('a beach in Dagupan', '120.341,16.043', {
    askFn: fake({ intent: 'discover', answer: 'Try Fake Beach.', candidates: [{ name: 'Fake Beach' }], sources: [] }),
  });
  assert.equal(out.candidates.length, 0);
  assert.equal(out.answer, NO_MATCH);
  assert.equal(out.source, 'dataset+ai');
});

test('recommendations come back as places with file coordinates', async () => {
  const out = await groundedRecommend('food in Dagupan', '120.341,16.043', [], {
    askFn: fake({ intent: 'food', answer: 'Eat here.', candidates: [{ name: "Conrad's Dagupan" }], sources: [] }),
  });
  assert.equal(out.places.length, 1);
  assert.equal(out.places[0].name, "Conrad's Dagupan");
  assert.equal(out.places[0].lat, 16.043);
  assert.equal(out.places[0].sourceKind, 'dataset');
});

test('a hospital named by the AI is still filtered out of recommendations', async () => {
  const out = await groundedRecommend('places in San Carlos', '120.348,15.928', [], {
    askFn: fake({ intent: 'discover', answer: 'Here.', candidates: [{ name: 'Pangasinan Provincial Hospital' }], sources: [] }),
  });
  assert.ok(out.places.every(p => !/hospital/i.test(p.name)));
});

test('a totally empty answer falls back to the honest no-match line', async () => {
  const out = await groundedChat('file my taxes', '120.341,16.043', {
    askFn: fake({ intent: 'refuse', answer: '', candidates: [], sources: [] }),
  });
  assert.equal(out.answer, NO_MATCH);
});

test('an answer that adds a place or a price outside the rows is rebuilt from the rows', async () => {
  const out = await groundedChat('food in Dagupan', '120.341,16.043', {
    askFn: fake({
      intent: 'food',
      answer: 'Try **Patar Beach** — open 24 hours, PHP 150 entrance.',
      candidates: [{ name: "Conrad's Dagupan" }],
      sources: [],
    }),
  });
  assert.doesNotMatch(out.answer, /Patar Beach/);
  assert.doesNotMatch(out.answer, /24 hours/);
  assert.doesNotMatch(out.answer, /150/);
  assert.match(out.answer, /Conrad's Dagupan/);
});

test('an answer that only restates the rows is kept as written', async () => {
  const out = await groundedChat('food in Dagupan', '120.341,16.043', {
    askFn: fake({
      intent: 'food',
      answer: "**Conrad's Dagupan** — 4.2★ from 185 reviews in Dagupan City.",
      candidates: [{ name: "Conrad's Dagupan" }],
      sources: [],
    }),
  });
  assert.equal(out.answer, "**Conrad's Dagupan** — 4.2★ from 185 reviews in Dagupan City.");
});
