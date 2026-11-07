// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('./AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
vi.mock('./store.js', () => ({
  postReview: vi.fn(async () => ({ queued: false })),
  flushOutbox: vi.fn(async () => {}),
}));
vi.mock('./api.js', () => ({
  recommend: vi.fn(async () => ({ places: [] })),
}));

import { useReviews, Reviews } from './Panels.jsx';

function Probe({ placeId, onValue }) {
  const { reviews, add } = useReviews(placeId);
  onValue({ reviews, add });
  return <div>{reviews.map(r => r.text).join(',')}</div>;
}

async function renderProbe(initialId) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let latest;
  const onValue = (v) => { latest = v; };
  await React.act(async () => {
    root.render(<Probe placeId={initialId} onValue={onValue} />);
  });
  return {
    container, root,
    get latest() { return latest; },
    async rerender(placeId) {
      await React.act(async () => {
        root.render(<Probe placeId={placeId} onValue={onValue} />);
      });
    },
    async unmount() { await React.act(async () => root.unmount()); container.remove(); },
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('useReviews', () => {
  it('reloads reviews when the place changes instead of showing the previous place', async () => {
    localStorage.setItem('lakbai-reviews:A', JSON.stringify([{ score: 5, text: 'aaa', at: 1 }]));
    localStorage.setItem('lakbai-reviews:B', JSON.stringify([{ score: 4, text: 'bbb', at: 2 }]));
    const h = await renderProbe('A');
    expect(h.latest.reviews.map(r => r.text)).toEqual(['aaa']);
    await h.rerender('B');
    expect(h.latest.reviews.map(r => r.text)).toEqual(['bbb']);
    expect(h.container.textContent).toContain('bbb');
    await h.unmount();
  });

  it('appends with functional state so rapid adds are both kept', async () => {
    localStorage.setItem('lakbai-reviews:A', JSON.stringify([]));
    const h = await renderProbe('A');
    await React.act(async () => { h.latest.add(5, 'first'); });
    await React.act(async () => { h.latest.add(4, 'second'); });
    expect(h.latest.reviews.map(r => r.text)).toEqual(['first', 'second']);
    await h.unmount();
  });
});

describe('Reviews', () => {
  it('returns null for a missing place instead of crashing', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await React.act(async () => {
      root.render(<Reviews place={null} />);
    });
    expect(container.textContent).toBe('');
    await React.act(async () => root.unmount());
    container.remove();
  });

  it('shows an empty state when there are no reviews', async () => {
    localStorage.setItem('lakbai-reviews:p1', JSON.stringify([]));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await React.act(async () => {
      root.render(<Reviews place={{ id: 'p1', name: 'Test Place' }} />);
    });
    expect(container.textContent).toContain('No reviews yet');
    await React.act(async () => root.unmount());
    container.remove();
  });
});
