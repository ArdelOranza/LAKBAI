// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../store.js', () => ({
  listMyReviews: vi.fn(async () => ([
    { id: 'r1', place_name: 'Bolo Beach', score: 5, text: 'great', photo: null, created_at: '2026-01-01' },
    { id: 'r2', place_name: 'Lingayen Baywalk', score: 4, text: 'nice', photo: null, created_at: '2026-02-01' },
  ])),
  updateReview: vi.fn(async () => ({})),
  deleteReview: vi.fn(async () => ({})),
}));
vi.mock('../AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

import MyReviews from './MyReviews.jsx';

const ROWS = ['Bolo Beach', 'Lingayen Baywalk'];

async function mount(){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const props = { pop: vi.fn(), showToast: vi.fn() };
  await React.act(async () => { root.render(<MyReviews {...props}/>); });
  return {
    container, root, props,
    get rows(){
      return Array.from(container.querySelectorAll('[data-testid="my-review-card"]')).map(c => c.querySelector('b').textContent);
    },
    async click(sel){
      const el = container.querySelector(sel);
      expect(el, sel + ' exists').not.toBeNull();
      await React.act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    },
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('MyReviews delete flow', () => {
  it('a stray tap on Delete must NOT delete — it asks first', async () => {
    const h = await mount();
    await h.click('[data-testid="delete-review"]');
    expect(h.rows).toEqual(ROWS);                       // nothing removed yet
    const confirm = h.container.querySelector('[data-testid="confirm-delete"]');
    expect(confirm).not.toBeNull();                     // an explicit confirm step appeared
    expect(confirm.textContent).toMatch(/confirm/i);
    expect(h.container.querySelector('[data-testid="cancel-delete"]')).not.toBeNull();
    await h.unmount();
  });

  it('confirming actually deletes just that review', async () => {
    const { deleteReview } = await import('../store.js');
    const h = await mount();
    await h.click('[data-testid="delete-review"]');
    await h.click('[data-testid="confirm-delete"]');
    expect(deleteReview).toHaveBeenCalledTimes(1);
    expect(deleteReview.mock.calls[0]).toContain('r1');
    expect(h.rows).toEqual(['Lingayen Baywalk']);
    await h.unmount();
  });

  it('cancel backs out without touching anything and leaves the other review alone', async () => {
    const { deleteReview } = await import('../store.js');
    const h = await mount();
    await h.click('[data-testid="delete-review"]');
    await h.click('[data-testid="cancel-delete"]');
    expect(deleteReview).not.toHaveBeenCalled();
    expect(h.rows).toEqual(ROWS);
    // flow can be re-entered cleanly (no stuck confirm mode)
    await h.click('[data-testid="delete-review"]');
    await h.click('[data-testid="confirm-delete"]');
    expect(h.rows).toEqual(['Lingayen Baywalk']);
    await h.unmount();
  });
});
