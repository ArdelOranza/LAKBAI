// The province-centre fallback keeps the map centred before GPS arrives, but it
// is NOT the traveler's position. These tests pin the rule that it is never
// sent to the server as proximity once `hasFix` says there is no real fix —
// otherwise results get ordered around the fallback town and "closest terminal"
// answers claim a distance from a place the traveler is not standing in.
import { describe, it, expect } from 'vitest';
import { proximityOf } from './geo.js';

// Same point the app uses as FALLBACK_CENTER (App.jsx): the Lingayen area.
const FALLBACK = { lng: 120.23, lat: 16.03 };

describe('proximityOf', () => {
  it('sends the coordinates for a real fix', () => {
    expect(proximityOf({ lng: 120.34, lat: 16.043 }, true)).toBe('120.34,16.043');
  });

  it('sends nothing for the fallback point when there is no fix', () => {
    expect(proximityOf(FALLBACK, false)).toBe('');
  });

  it('sends nothing for missing or non-finite coordinates', () => {
    expect(proximityOf(null, true)).toBe('');
    expect(proximityOf(undefined)).toBe('');
    expect(proximityOf({ lng: NaN, lat: 16.03 }, true)).toBe('');
    expect(proximityOf({ lng: 120.23 }, true)).toBe('');
  });

  it('treats an unspecified fix flag as a fix, so older callers are unchanged', () => {
    expect(proximityOf({ lng: 120.34, lat: 16.043 })).toBe('120.34,16.043');
  });
});
