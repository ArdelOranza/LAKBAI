import { describe, it, expect } from 'vitest';
import { filterPlaces, matches, feeLabel } from './filters.js';
const A = { id:'1', name:'Patar White Beach', categories:['beach'], fees:'' };
const B = { id:'2', name:'Sungayan Grill', categories:['restaurant'], fees:'Eco fee P60' };
const C = { id:'3', name:'Mangunguna Festival', categories:['festival'], festival:'Oct 24 – Oct 25' };
const D = { id:'4', name:'El Puerto Marina Beach Resort', categories:['Resort'] };
const E = { id:'5', name:'Kabaleyan Cove Restaurant', categories:['Restaurant'] };
describe('filterPlaces', () => {
  it('kinds filter correctly', () => {
    expect(filterPlaces([A, B, C], 'all')).toHaveLength(3);
    expect(filterPlaces([A, B, C], 'food')).toEqual([B]);
    expect(filterPlaces([A, B, C], 'events')).toEqual([C]);
    expect(filterPlaces([A, B, C], 'places')).toEqual([A]);
  });
});
describe('matches', () => {
  it('drives map filter chips', () => {
    expect(matches(A, 'Beaches')).toBe(true);
    expect(matches(B, 'Beaches')).toBe(false);
    expect(matches(B, 'All')).toBe(true);
  });

  it('the Hotels chip keeps lodging apart from food and beaches', () => {
    expect(matches(D, 'Hotels')).toBe(true);
    expect(matches(D, 'Food')).toBe(false);
    expect(matches(B, 'Hotels')).toBe(false);
    expect(matches(E, 'Hotels')).toBe(false);
    // A beach resort is honest under both chips, not a lie under either.
    expect(matches({ name:'Beach Resort', categories:['Beach'] }, 'Hotels')).toBe(true);
    expect(matches({ name:'Beach Resort', categories:['Beach'] }, 'Beaches')).toBe(true);
  });
});
describe('feeLabel', () => {
  it('Free when fees empty or /free/i, else the fee text', () => {
    expect(feeLabel('')).toBe('Free');
    expect(feeLabel(undefined)).toBe('Free');
    expect(feeLabel('Free entrance')).toBe('Free');
    expect(feeLabel('Eco fee P60')).toBe('Eco fee P60');
  });
});
