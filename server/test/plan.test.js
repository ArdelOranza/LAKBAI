const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planDay } = require('../plan.js');
test('unverifiable stops are dropped, times kept', async () => {
  const fakeAgent = async () => ({
    title: 'Alaminos food day',
    stops: [
      { name: 'Patar Beach', hint: 'Bolinao', arrive: '09:00', depart: '10:30', activities: ['Swim', 'Photos'] },
      { name: 'Nowhere Fake', hint: '', arrive: '11:00', depart: '12:30', activities: ['Nothing'] }
    ]
  });
  const fakeSearch = async (q) => q.startsWith('Patar')
    ? [{ id: 'p1', name: 'Patar Beach', lng: 119.79, lat: 16.12, address: '', categories: [] }]
    : [];
  const out = await planDay('food day', 4, 9, { agentFn: fakeAgent, searchFn: fakeSearch });
  assert.equal(out.title, 'Alaminos food day');
  assert.equal(out.schedule.length, 1);
  assert.deepEqual(out.schedule[0].activities, ['Swim', 'Photos']);
  assert.equal(out.schedule[0].arrive, '09:00');
});
