// Commuting answers come from one committed LTFRB file. These tests pin the
// parts that must never drift: the fare arithmetic (rounded to ₱0.25 exactly as
// the file says), the corridor distance for a named origin, the honest refusal
// when the file covers nothing, and the disclaimer that must ride every answer.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  isCommuteQuestion, fareFacts, fareAnswer, fareFor, localRidesNote, DISCLAIMER,
  groundCommuteAnswer,
} = require('../commute.js');

test('recognises a commuting question in English and Taglish', () => {
  assert.equal(isCommuteQuestion('How much is the bus fare from Cubao to Dagupan?'), true);
  assert.equal(isCommuteQuestion('magkano pamasahe papuntang Lingayen'), true);
  assert.equal(isCommuteQuestion('Which terminal has aircon buses?'), true);
  assert.equal(isCommuteQuestion('Best beach near me'), false);
  assert.equal(isCommuteQuestion('Plan a day trip in Bayambang'), false);
});

test('computes the LTFRB fare for the exact distance, rounded to 25 centavos', () => {
  // Alaminos City sits at KM 238 from Luneta; the file publishes that row.
  assert.deepEqual(fareFor(238), {
    ordinary: { regular: 524.5, discounted: 419.75 },
    aircon: { regular: 583, discounted: 466.5 },
    deluxe: { regular: 618.75, discounted: 495 },
  });
  // 212 km from Cubao to Dagupan, the row the file pre-calculates.
  assert.deepEqual(fareFor(212).ordinary, { regular: 467.5, discounted: 374 });
});

test('answers Cubao to Dagupan with the corridor distance and both fare sources', () => {
  const facts = fareFacts('How much is the bus fare from Cubao to Dagupan City?');
  assert.equal(facts.town.name, 'Dagupan City');
  assert.equal(facts.town.km, 216);
  assert.equal(facts.origin.name, 'Cubao, Quezon City');
  assert.equal(facts.distanceKm, 212);
  assert.deepEqual(facts.fares, {
    ordinary: { regular: 467.5, discounted: 374 },
    aircon: { regular: 519.5, discounted: 415.5 },
    deluxe: { regular: 551.25, discounted: 441 },
  });
  // The same town measured from KM 0 at Luneta, straight from the file row.
  assert.equal(facts.fromManila.distanceKm, 216);
  assert.equal(facts.fromManila.fares.ordinary.regular, 476.25);
  assert.ok(facts.operators.includes('Pangasinan Solid North Transit, Inc.'));
  assert.ok(facts.operators.includes('Victory Liner, Inc.'));
  assert.deepEqual(facts.published[0], { route: 'Cubao → Dagupan', regular: 450, standard: 550, luxury: null });
});

test('defaults to Cubao when the traveler does not name a terminal', () => {
  const facts = fareFacts('magkano pamasahe papuntang Dagupan');
  assert.equal(facts.origin.name, 'Cubao, Quezon City');
  assert.equal(facts.distanceKm, 212);
});

test('uses the file route for a corridor the KM markers cannot describe', () => {
  // Baguio is at KM 250, but the road to Dagupan is 70 km — not 250 - 216.
  const facts = fareFacts('bus from Baguio to Dagupan');
  assert.equal(facts.distanceKm, 70);
  assert.equal(facts.fares.ordinary.regular, 155);
});

test('refuses instead of guessing when the file has no such place', () => {
  assert.equal(fareFacts('bus fare to Batanes'), null);
  assert.equal(fareFacts('bus fare to Manila'), null);
});

test('local rides are honestly out of scope until data arrives', () => {
  assert.equal(isCommuteQuestion('magkano jeep papuntang Dagupan'), true);
  assert.equal(fareFacts('magkano jeep papuntang Dagupan'), null);
  assert.match(localRidesNote(), /jeepney|tricycle/i);
  assert.match(localRidesNote(), /not in|no verified|do not have/i);
});

test('every rendered answer carries the LTFRB disclaimer', () => {
  const facts = fareFacts('bus fare Cubao to Dagupan');
  const text = fareAnswer(facts);
  assert.match(text, /Dagupan City/);
  assert.match(text, /₱467\.50/);
  assert.match(text, /₱374\.00/);
  assert.match(text, /Solid North/);
  assert.ok(text.includes(DISCLAIMER));
  assert.match(DISCLAIMER, /LTFRB/);
  assert.match(DISCLAIMER, /28 Sep 2026/);
  assert.match(DISCLAIMER, /20%/);
  assert.match(DISCLAIMER, /1342/);
});

test('the prompt block names every figure the answer may use', () => {
  const facts = fareFacts('bus fare from PITX to Alaminos');
  assert.equal(facts.distanceKm, 248); // 238 + 10 km PITX adjustment
  assert.match(facts.text, /FARE FACTS/);
  assert.match(facts.text, /583/);
  assert.match(facts.text, /Alaminos City/);
});

test('an invented travel time or departure schedule is rebuilt from the file', () => {
  // The LTFRB file has no travel times and no frequencies; the model must not
  // smuggle them in as prose. Both figures sit below ten, where the old number
  // check gave up policing.
  const facts = fareFacts('How much is the bus fare from Cubao to Dagupan?');
  const withTime = groundCommuteAnswer(`The ride is about 5 to 8 hours. Ordinary is ₱${facts.fares.ordinary.regular}.`, facts);
  assert.equal(withTime.grounded, false);
  assert.doesNotMatch(withTime.answer, /5 to 8 hours/);

  const withSchedule = groundCommuteAnswer('Buses leave the terminal hourly.', facts);
  assert.equal(withSchedule.grounded, false);
  assert.doesNotMatch(withSchedule.answer, /hourly/i);
});
