// The chat endpoint has to keep the same no-invention rule for fares: the model
// may phrase the answer, but every peso figure, town and terminal must come from
// the LTFRB facts block, and the disclaimer is attached by the server so the
// model can neither drop it nor make one up.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

process.env.LAKBAI_DATA = path.join(__dirname, 'fixtures', 'dataset.json');

const { groundedChat } = require('../grounded.js');
const { groundCommuteAnswer, fareFacts, DISCLAIMER } = require('../commute.js');

const facts = fareFacts('bus fare from Cubao to Dagupan');
const reply = (system, payload, answer) => async (sys, msg) => {
  system.push(sys);
  payload.push(msg);
  return JSON.stringify({ intent: 'commute', answer, candidates: [], sources: [] });
};

test('a fare question hands the model the LTFRB block, not the place rows alone', async () => {
  const payloads = [];
  await groundedChat('How much is the bus fare from Cubao to Dagupan?', '', {
    askFn: async (sys, msg) => {
      payloads.push(msg);
      return JSON.stringify({ intent: 'commute', answer: 'Ordinary is ₱467.50.', candidates: [], sources: [] });
    },
  });
  assert.match(payloads[0], /FARE FACTS/);
  assert.match(payloads[0], /467\.50/);
});

test('a non-fare question is not handed the fare block', async () => {
  const payloads = [];
  await groundedChat('where can I eat in Dagupan', '120.341,16.043', {
    askFn: async (sys, msg) => {
      payloads.push(msg);
      return JSON.stringify({ intent: 'food', answer: 'Try Conrad\'s.', candidates: [], sources: [] });
    },
  });
  assert.doesNotMatch(payloads[0], /FARE FACTS/);
});

test('a fare answer keeps the model prose and gains the disclaimer', async () => {
  const out = await groundedChat('bus fare from Cubao to Dagupan', '', {
    askFn: reply([], [], 'From Cubao: ₱467.50 ordinary, ₱519.50 aircon.'),
  });
  assert.equal(out.intent, 'commute');
  assert.match(out.answer, /467\.50/);
  assert.ok(out.answer.includes(DISCLAIMER));
  assert.deepEqual(out.candidates, []);
});

test('an invented fare is thrown out and the file answer is used instead', async () => {
  const out = await groundedChat('bus fare from Cubao to Dagupan', '', {
    askFn: reply([], [], 'It is about ₱999.00 each way.'),
  });
  assert.match(out.answer, /467\.50/);
  assert.doesNotMatch(out.answer, /999/);
  assert.ok(out.answer.includes(DISCLAIMER));
});

test('a jeepney question is answered honestly, never with a bus fare', async () => {
  const out = await groundedChat('magkano jeep papuntang Dagupan', '', {
    askFn: reply([], [], 'Jeepney fare is ₱20.'),
  });
  assert.match(out.answer, /jeepney|tricycle/i);
  assert.match(out.answer, /not in|no verified|couldn't/i);
  assert.doesNotMatch(out.answer, /₱20/);
});

test('a route the file does not cover says so', async () => {
  const out = await groundedChat('bus fare to Batanes', '', {
    askFn: reply([], [], 'Around ₱1,200.'),
  });
  assert.match(out.answer, /isn't in|not in|no verified|couldn't/i);
  assert.doesNotMatch(out.answer, /1,200/);
});

test('groundCommuteAnswer accepts facts figures and rejects anything else', () => {
  const ok = groundCommuteAnswer('Cubao to Dagupan is 212 km, ordinary ₱467.50.', facts);
  assert.match(ok.answer, /467\.50/);
  assert.equal(ok.grounded, true);

  const bad = groundCommuteAnswer('It takes 6 hours and costs ₱1,000.', facts);
  assert.equal(bad.grounded, false);
  assert.match(bad.answer, /467\.50/);

  const hours = groundCommuteAnswer('Buses leave at 4:30 AM.', facts);
  assert.equal(hours.grounded, false);

  const empty = groundCommuteAnswer('', facts);
  assert.equal(empty.grounded, false);
  assert.ok(empty.answer.includes(DISCLAIMER));
});
