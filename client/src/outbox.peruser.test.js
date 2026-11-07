// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { queueReview, queueFavDelete, readOutbox, peekOutbox, removeFirst, stripForInsert } from './outbox.js';

beforeEach(() => localStorage.clear());

describe('outbox per-user isolation', () => {
  it('keeps user A queued reviews separate from user B', () => {
    queueReview({ id: 'uA' }, { place_id: 'p1', place_name: 'A', score: 5, text: 'hi' });
    expect(readOutbox({ id: 'uA' })).toHaveLength(1);
    expect(readOutbox({ id: 'uB' })).toHaveLength(0);
    expect(readOutbox({ id: 'uB' })[0]).toBeUndefined();
  });

  it('queues fav deletes for the right user only', () => {
    queueFavDelete({ id: 'uA' }, 'p2');
    expect(readOutbox({ id: 'uA' })).toHaveLength(1);
    expect(readOutbox({ id: 'uB' })).toHaveLength(0);
  });

  it('peek does not clear; removeFirst pops one entry', () => {
    queueReview({ id: 'uA' }, { place_id: 'p1', place_name: 'A', score: 5, text: 'one' });
    queueReview({ id: 'uA' }, { place_id: 'p2', place_name: 'B', score: 4, text: 'two' });
    expect(peekOutbox({ id: 'uA' })).toHaveLength(2);
    expect(peekOutbox({ id: 'uA' })).toHaveLength(2);
    const removed = removeFirst({ id: 'uA' });
    expect(removed?.text).toBe('one');
    expect(readOutbox({ id: 'uA' })).toHaveLength(1);
    expect(readOutbox({ id: 'uA' })[0].text).toBe('two');
  });

  it('cannot overwrite kind via the row', () => {
    queueReview({ id: 'uA' }, { place_id: 'p1', place_name: 'A', score: 5, text: 'hi', kind: 'favdelete' });
    expect(readOutbox({ id: 'uA' })[0].kind).toBe('review');
  });

  it('stripForInsert only allows review columns', () => {
    const out = stripForInsert({ place_id: 'p1', place_name: 'A', score: 5, text: 'hi', user_id: 'evil', is_admin: true, at: 123, kind: 'review' });
    expect(out).toEqual({ place_id: 'p1', place_name: 'A', score: 5, text: 'hi' });
    expect(out).not.toHaveProperty('user_id');
    expect(out).not.toHaveProperty('is_admin');
  });
});
