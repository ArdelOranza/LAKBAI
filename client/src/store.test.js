// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const eqCalls = [];
  const orderCalls = [];
  const selectCols = [];
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
    upsert: async () => ({}),
    insert: async () => ({ error: null }),
    delete: () => makeQuery(),
    update: () => makeQuery(),
  });
  return { eqCalls, orderCalls, selectCols, fromFn, fromCalls: [] };
});

vi.mock('./supabaseClient.js', () => ({
  supabase: { from: (t) => { mocks.fromCalls.push(t); return mocks.fromFn(t); } },
}));

import { listFavorites } from './store.js';

beforeEach(() => { mocks.eqCalls.length = 0; mocks.orderCalls.length = 0; mocks.selectCols.length = 0; mocks.fromCalls.length = 0; });

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
