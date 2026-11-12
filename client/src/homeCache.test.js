// @vitest-environment happy-dom
// The home feed is an AI call. Opening the app must not re-run it every launch:
// the last good answer is kept per account and refreshed only when it has aged
// out, the traveler moved, or their interests changed.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readHomeCache, writeHomeCache, clearHomeCache, isStale } from './homeCache.js';

const USER = { id: 'u1' };
const COORDS = { lng: 120.23, lat: 16.03 };
const PLACES = [{ id: 'p1', name: 'Patar White Sand Beach' }];
const PREFS = ['Beaches', 'Hidden Gems'];

beforeEach(() => { localStorage.clear(); });

describe('home recommendation cache', () => {
  it('gives the same account its last places back on the next launch', () => {
    writeHomeCache(USER, COORDS, PREFS, PLACES, 1_000_000);
    const hit = readHomeCache(USER, COORDS, PREFS, 1_000_000 + 1000);
    expect(hit.places).toEqual(PLACES);
  });

  it('never shows one account the places another account saw', () => {
    writeHomeCache(USER, COORDS, PREFS, PLACES, 1_000_000);
    expect(readHomeCache({ id: 'u2' }, COORDS, PREFS, 1_000_000)).toBeNull();
    expect(readHomeCache(null, COORDS, PREFS, 1_000_000)).toBeNull();
  });

  it('drops the cache when the traveler changes their interests', () => {
    writeHomeCache(USER, COORDS, PREFS, PLACES, 1_000_000);
    expect(readHomeCache(USER, COORDS, ['Food & Dining'], 1_000_000)).toBeNull();
  });

  it('treats the same interests in another order as unchanged', () => {
    writeHomeCache(USER, COORDS, PREFS, PLACES, 1_000_000);
    expect(readHomeCache(USER, COORDS, [...PREFS].reverse(), 1_000_000)).not.toBeNull();
  });

  it('marks an entry stale after 30 minutes instead of hiding it', () => {
    writeHomeCache(USER, COORDS, PREFS, PLACES, 1_000_000);
    const thin = readHomeCache(USER, COORDS, PREFS, 1_000_000 + 10 * 60 * 1000);
    const old = readHomeCache(USER, COORDS, PREFS, 1_000_000 + 31 * 60 * 1000);
    expect(isStale(thin, COORDS, 1_000_000 + 10 * 60 * 1000)).toBe(false);
    expect(isStale(old, COORDS, 1_000_000 + 31 * 60 * 1000)).toBe(true);
  });

  it('marks an entry stale when the traveler moved more than 8 km', () => {
    writeHomeCache(USER, COORDS, PREFS, PLACES, 1_000_000);
    const near = readHomeCache(USER, { lng: 120.24, lat: 16.04 }, PREFS, 1_000_000);
    const far = readHomeCache(USER, { lng: 119.89, lat: 16.32 }, PREFS, 1_000_000);
    expect(isStale(near, { lng: 120.24, lat: 16.04 }, 1_000_000)).toBe(false);
    expect(isStale(far, { lng: 119.89, lat: 16.32 }, 1_000_000)).toBe(true);
  });

  it('survives corrupt storage and quota errors', () => {
    localStorage.setItem('lakbai.home.v1:u1', '{not json');
    expect(readHomeCache(USER, COORDS, PREFS, 1_000_000)).toBeNull();

    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => writeHomeCache(USER, COORDS, PREFS, PLACES, 1_000_000)).not.toThrow();
    spy.mockRestore();
  });

  it('forgets the cache on request (sign out)', () => {
    writeHomeCache(USER, COORDS, PREFS, PLACES, 1_000_000);
    clearHomeCache(USER);
    expect(readHomeCache(USER, COORDS, PREFS, 1_000_000)).toBeNull();
  });
});
