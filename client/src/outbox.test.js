// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { queueReview, queueFavDelete, readOutbox, takeAll } from './outbox.js';
beforeEach(() => localStorage.clear());
describe('outbox', () => {
  it('queues and strips reviews and deletions separately', () => {
    const user = { id: 'u1' };
    queueReview(user, { place_id:'p1', place_name:'A', score:5, text:'hi' });
    queueFavDelete(user, 'p2');
    const box = readOutbox(user);
    expect(box).toHaveLength(2);
    expect(box[0].kind).toBe('review');
    expect(box[0].place_id).toBe('p1');
    expect(box[1]).toEqual({ kind:'favdelete', placeId:'p2' });
    expect(takeAll(user)).toHaveLength(2);
    expect(readOutbox(user)).toHaveLength(0);
  });
});
