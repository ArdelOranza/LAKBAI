// The terminal directory is location-aware: which terminal is actually near
// the traveler, what it serves, and how to reach it. Coordinates are curated in
// terminal-coords.json because the source file has none.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TERMINALS, matchTerminals, terminalFacts, terminalAnswer,
  groundTerminalAnswer, isTerminalQuestion, terminalsVersion,
} = require('../terminals.js');

test('every listed terminal has a plausible Philippine coordinate', () => {
  assert.equal(TERMINALS.length, 29);
  for (const t of TERMINALS){
    assert.ok(t.lat > 4 && t.lat < 21, `${t.id} lat ${t.lat}`);
    assert.ok(t.lng > 116 && t.lng < 127, `${t.id} lng ${t.lng}`);
    assert.ok(['exact', 'approx', 'town'].includes(t.precision), `${t.id} precision`);
  }
});

test('dataset version comes from the committed file', () => {
  assert.equal(terminalsVersion(), '2026-11-12');
});

test('a Cubao fix ranks the Cubao cluster first', () => {
  const rows = matchTerminals('Which bus terminal is closest to me?', '121.0485,14.6240');
  assert.match(rows[0].name, /Cubao/);
  assert.ok(rows[0].distanceKm < 1.5, `got ${rows[0].distanceKm}`);
});

test('a Dagupan fix ranks the Dagupan hub first, never a Manila terminal', () => {
  const rows = matchTerminals('Which bus terminal is nearest to me?', '120.3431,16.0433');
  assert.equal(rows[0].id, 'PANG-TERM-DAGUPAN');
  assert.ok(rows[0].distanceKm < 1);
  assert.ok(rows.every(r => !/Cubao|Pasay|PITX/.test(r.name)));
});

test('a named origin filters the list to that city', () => {
  const rows = matchTerminals('Which terminal in Pasay goes to Bolinao?', '120.3431,16.0433');
  assert.ok(rows.length >= 1);
  assert.ok(rows.every(r => /Pasay/.test(r.area)));
});

test('a Pangasinan destination keeps only terminals that serve it', () => {
  const rows = matchTerminals('I am in Cubao, how do I get to Bolinao?', '121.0485,14.6240');
  assert.ok(rows.length >= 1);
  assert.ok(rows.every(r => r.destinations.some(d => /Bolinao/i.test(d))));
  assert.match(rows[0].name, /Cubao/);
});

test('facts carry the committed phone, rating and a straight-line distance', () => {
  const facts = terminalFacts('Which terminal in Pasay goes to Bolinao?', '120.3431,16.0433');
  assert.ok(facts);
  assert.match(facts.text, /TERMINAL FACTS/);
  assert.match(facts.text, /straight-line/);
  assert.match(facts.text, /\+63/);
  assert.match(facts.text, /★/);
});

test('without a GPS fix no distance is claimed anywhere', () => {
  const facts = terminalFacts('Which bus terminal goes to Bolinao?', '');
  assert.ok(facts);
  assert.doesNotMatch(facts.text, /straight-line/);
  assert.doesNotMatch(terminalAnswer(facts), /\bkm\b/);
});

test('an invented phone or fare is rejected and rebuilt from the rows', () => {
  const facts = terminalFacts('Which terminal in Pasay goes to Bolinao?', '120.3431,16.0433');
  const out = groundTerminalAnswer('Call **Victory Liner Pasay** at +63 999 111 2222, fare ₱123.', facts);
  assert.equal(out.grounded, false);
  assert.doesNotMatch(out.answer, /999 111 2222/);
  assert.doesNotMatch(out.answer, /₱123/);
});

test('a reply that only restates the rows is kept', () => {
  const facts = terminalFacts('Which terminal in Pasay goes to Bolinao?', '120.3431,16.0433');
  const out = groundTerminalAnswer('**Victory Liner Pasay** serves Bolinao from Pasay.', facts);
  assert.equal(out.grounded, true);
  assert.match(out.answer, /Victory Liner Pasay/);
});

test('terminal questions are recognised without hijacking fare questions', () => {
  assert.equal(isTerminalQuestion('Which bus terminal near me goes to Manila?'), true);
  assert.equal(isTerminalQuestion('Victory Liner schedule to Dagupan'), true);
  assert.equal(isTerminalQuestion('Where is the solid north terminal in Cubao?'), true);
  assert.equal(isTerminalQuestion('How much is the bus fare from Cubao to Dagupan?'), false);
  assert.equal(isTerminalQuestion('Where should I eat in Dagupan?'), false);
});