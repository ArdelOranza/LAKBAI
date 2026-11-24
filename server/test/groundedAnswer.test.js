// The model writes the travel advice; the rows only police it. These tests pin
// that division: a real place named in passing must not sink the whole answer,
// a fabricated claim costs only its own sentence, and the deterministic
// fallback must read like a guide rather than a spreadsheet.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { groundAnswer } = require('../grounded.js');
const { allEntries } = require('../dataset.js');

const all = allEntries();
const patar = all.find(e => /Patar White Sand Beach/i.test(e.name));
const cave = all.find(e => /Enchanted Cave/i.test(e.name));
if (!patar || !cave) throw new Error('dataset rows missing: Patar White Sand Beach / Enchanted Cave');
const cards = [patar];

const named = (out, name) => out.toLowerCase().includes(name.toLowerCase());

test('a real place named outside the result cards does not discard the answer', () => {
  const answer = 'Patar White Sand Beach is the easy pick for a swim, and Enchanted Cave is a short detour if you want something different.';
  // Enchanted Cave is a verified row, just not one of the cards for this ask.
  assert.equal(groundAnswer(answer, 'discover', cards), answer);
});

test('a landmark written in a row description is grounded, not invented', () => {
  const lighthouse = all.find(e => /Cape Bolinao Lighthouse/i.test(e.name));
  const answer = 'Cape Bolinao Lighthouse sits on Punta Piedra Point, which makes it a fine sunset stop.';
  assert.equal(groundAnswer(answer, 'discover', [lighthouse]), answer);
});

test('a fabricated figure drops only the sentence that carries it', () => {
  const answer = 'Patar White Sand Beach is the easy pick. The entrance costs PHP 9,999. Bring cash for the cottages.';
  const out = groundAnswer(answer, 'discover', cards);
  assert.match(out, /easy pick/, 'the grounded sentence survives');
  assert.match(out, /Bring cash/, 'the sentence after it survives too');
  assert.doesNotMatch(out, /9,999/, 'the invented price is gone');
});

test('an invented place drops its sentence and keeps the rest', () => {
  const answer = 'Patar White Sand Beach is lovely at low tide. The nearby Blue Lagoon Resort has a zipline.';
  const out = groundAnswer(answer, 'discover', cards);
  assert.match(out, /low tide/);
  assert.doesNotMatch(out, /Blue Lagoon/i);
});

test('the deterministic fallback reads like a guide, not a database row', () => {
  const out = groundAnswer('The entrance costs PHP 9,999.', 'discover', cards);
  assert.doesNotMatch(out, /Worth a look/);
  assert.doesNotMatch(out, /★/, 'ratings belong to the cards, not the prose');
  assert.doesNotMatch(out, /reviews/);
  assert.ok(named(out, patar.name), 'it still names a real place');
});