// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ insertCalls: 0, failFirst: true }));
vi.mock('./supabaseClient.js', () => ({
  supabase: {
    from: (table) => ({
      insert: async (row) => {
        state.insertCalls += 1;
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

beforeEach(() => { localStorage.clear(); state.insertCalls = 0; state.failFirst = true; });

describe('flushOutbox', () => {
  it('retains all queued items when the first insert fails', async () => {
    const user = { id: 'uA' };
    queueReview(user, { place_id: 'p1', place_name: 'A', score: 5, text: 'one' });
    queueReview(user, { place_id: 'p2', place_name: 'B', score: 4, text: 'two' });
    await flushOutbox(user);
    // First failed, second must not be lost — both still queued for retry
    expect(readOutbox(user)).toHaveLength(2);
  });
});
