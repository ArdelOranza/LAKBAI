// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ insertCalls: 0, failFirst: true, inserted: [] }));
vi.mock('./supabaseClient.js', () => ({
  supabase: {
    from: (table) => ({
      insert: async (row) => {
        state.insertCalls += 1;
        state.inserted.push(row.place_id);
        if (table === 'reviews' && state.failFirst && state.insertCalls === 1) {
          return { error: { message: 'boom' } };
        }
        return { error: null };
      },
      delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
  },
}));

import { queueReview, readOutbox } from './outbox.js';
import { flushOutbox } from './store.js';

beforeEach(() => { localStorage.clear(); state.insertCalls = 0; state.failFirst = true; state.inserted = []; });

describe('flushOutbox', () => {
  it('retains all queued items when the first insert fails', async () => {
    const user = { id: 'uA' };
    queueReview(user, { place_id: 'p1', place_name: 'A', score: 5, text: 'one' });
    queueReview(user, { place_id: 'p2', place_name: 'B', score: 4, text: 'two' });
    await flushOutbox(user);
    // First failed, second must not be lost — both still queued for retry
    expect(readOutbox(user)).toHaveLength(2);
  });

  it('overlapping flushes insert every queued row exactly once', async () => {
    state.failFirst = false;
    const user = { id: 'uA' };
    queueReview(user, { place_id: 'p1', place_name: 'A', score: 5, text: 'one' });
    queueReview(user, { place_id: 'p2', place_name: 'B', score: 4, text: 'two' });
    // Two listeners (Panels/Saved) can flush at once. Without a lock both peek
    // the same queue: p1 inserts twice and p2 is removed without ever syncing.
    await Promise.all([flushOutbox(user), flushOutbox(user)]);
    expect(state.inserted.filter(id => id === 'p1')).toHaveLength(1);
    expect(state.inserted.filter(id => id === 'p2')).toHaveLength(1);
    expect(readOutbox(user)).toHaveLength(0);
  });
});
