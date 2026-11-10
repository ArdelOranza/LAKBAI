// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

// A cloud that never answers on its own: this reproduces a slow connection,
// where the old screen painted the welcome card first and the thread "came
// back" only when Supabase replied.
const cloud = vi.hoisted(() => {
  const state = { pending: [] };
  const result = () => ({
    select: () => ({ eq: () => ({ order: () => ({ limit: () => new Promise(resolve => state.pending.push(resolve)) }) }) }),
  });
  return {
    state,
    supabase: {
      from: result,
      upsert: () => Promise.resolve({ error: null }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    },
  };
});

vi.mock('../supabaseClient.js', () => ({ supabase: cloud.supabase }));
vi.mock('../api.js', () => ({ chat: vi.fn(async () => ({ answer: '', candidates: [] })) }));
vi.mock('../store.js', () => ({
  saveFavorite: vi.fn(async () => ({})),
  listFavorites: vi.fn(async () => ({ data: [] })),
}));
vi.mock('../spots.js', () => ({ fetchSpots: vi.fn(async () => []) }));

import ChatTab from './ChatTab.jsx';

const THREAD = {
  id: 't-cache',
  title: 'Where can I swim?',
  created_at: '2026-01-01T08:00:00.000Z',
  updated_at: '2026-01-01T08:00:00.000Z',
  messages: [
    { id: 'm1', role: 'user', text: 'Where can I swim?', at: 1 },
    { id: 'm2', role: 'ai', text: 'Patar Beach is the clearest water in Bolinao.', at: 2 },
  ],
};

function mount(){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  React.act(() => {
    root.render(<ChatTab user={{ id: 'u1' }} coords={{ lng: 120.2, lat: 16.0 }} push={() => {}} setTab={() => {}} showToast={() => {}} />);
  });
  return { container, root };
}

async function settle(){
  await React.act(async () => { await Promise.resolve(); });
}

describe('chat local cache', () => {
  beforeEach(() => {
    localStorage.clear();
    cloud.state.pending.length = 0;
  });

  it('paints the last conversation from the local mirror before the network replies', () => {
    localStorage.setItem('lakbai.chat:u1', JSON.stringify([THREAD]));

    const { container, root } = mount();

    expect(container.textContent).toContain('Where can I swim?');
    expect(container.textContent).toContain('Patar Beach is the clearest water');
    // No welcome-card flash while waiting for Supabase.
    expect(container.textContent).not.toContain("Hi! I'm LakbAI");

    React.act(() => root.unmount());
    container.remove();
  });

  it('adopts a newer thread from another device once the cloud answers', async () => {
    localStorage.setItem('lakbai.chat:u1', JSON.stringify([THREAD]));

    const { container, root } = mount();
    const fromPhone = {
      ...THREAD,
      id: 't-cloud',
      updated_at: '2026-02-02T08:00:00.000Z',
      messages: [{ id: 'm9', role: 'user', text: 'Opened on my phone', at: 9 }],
    };
    await React.act(async () => {
      for (const resolve of cloud.state.pending) resolve({ data: [fromPhone], error: null });
      await Promise.resolve();
    });
    await settle();

    expect(container.textContent).toContain('Opened on my phone');

    React.act(() => root.unmount());
    container.remove();
  });
});
