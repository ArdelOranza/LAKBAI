// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const eqCalls = [];
  const orderCalls = [];
  const selectCols = [];
  const upsertRows = [];
  function makeQuery() {
    const q = {
      eq: (col, val) => { eqCalls.push([col, val]); return q; },
      order: (col, opts) => { orderCalls.push([col, opts]); return Promise.resolve({ data: [], error: null }); },
      select: () => q,
      single: async () => ({ data: {}, error: null }),
      then: (res, rej) => Promise.resolve({ data: [], error: null }).then(res, rej),
    };
    return q;
  }
  const fromFn = (table) => ({
    select: (cols) => { selectCols.push(cols); return makeQuery(); },
    upsert: async (row) => { upsertRows.push(row); return {}; },
    insert: async () => ({ error: null }),
    delete: () => makeQuery(),
    update: () => makeQuery(),
  });
  return { eqCalls, orderCalls, selectCols, upsertRows, fromFn, fromCalls: [] };
});

vi.mock('./supabaseClient.js', () => ({
  supabase: { from: (t) => { mocks.fromCalls.push(t); return mocks.fromFn(t); } },
}));

import { listFavorites, saveFavorite } from './store.js';

beforeEach(() => { mocks.eqCalls.length = 0; mocks.orderCalls.length = 0; mocks.selectCols.length = 0; mocks.upsertRows.length = 0; mocks.fromCalls.length = 0; });

describe('listFavorites', () => {
  it('scopes the query to the current user and does not select *', async () => {
    await listFavorites({ id: 'u1' });
    expect(mocks.fromCalls).toContain('favorites');
    expect(mocks.eqCalls).toContainEqual(['user_id', 'u1']);
    expect(mocks.selectCols[0]).not.toBe('*');
    expect(String(mocks.selectCols[0])).toContain('place_id');
  });

  it('returns login-required without hitting supabase when logged out', async () => {
    const res = await listFavorites(null);
    expect(res.error).toBe('login required');
    expect(mocks.fromCalls).toHaveLength(0);
  });
});

describe('saveFavorite', () => {
  it('persists categories so the favorites list can read the column it selects', async () => {
    await saveFavorite(
      { id: 'u1' },
      { id: 'p1', name: 'Bolinao Falls', lng: 119.84, lat: 16.22, photo: 'x.jpg', categories: ['falls', 'nature'] },
    );
    expect(mocks.upsertRows[0]).toMatchObject({
      user_id: 'u1', place_id: 'p1', categories: ['falls', 'nature'],
    });
  });

  it('defaults categories to an empty array when the place has none', async () => {
    await saveFavorite({ id: 'u1' }, { id: 'p2', name: 'X', lng: 1, lat: 2 });
    expect(mocks.upsertRows[0].categories).toEqual([]);
  });
});
