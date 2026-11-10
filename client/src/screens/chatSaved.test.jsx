// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../chatStore.js', () => ({
  latestThread: vi.fn(async () => null),
  listThreads: vi.fn(async () => []),
  saveThread: vi.fn(async (user, thread) => thread),
  cleanMessages: (messages) => messages,
  cachedThreads: () => [],
  threadTitle: () => 'Chat',
}));
vi.mock('../api.js', () => ({
  chat: vi.fn(async () => ({
    answer: 'Patar White Sand Beach is the golden beach in Bolinao.',
    candidates: [{ name: 'Patar White Sand Beach', hint: 'Bolinao', rating: '4.8' }],
  })),
}));
vi.mock('../store.js', () => ({
  saveFavorite: vi.fn(async () => ({})),
  listFavorites: vi.fn(),
}));
vi.mock('../spots.js', () => ({
  fetchSpots: vi.fn(async () => ([{
    id: 'patar', name: 'Patar White Sand Beach', town: 'Bolinao',
    lng: 120.1, lat: 16.1, categories: ['Beach'],
  }])),
}));

import ChatTab from './ChatTab.jsx';
import { listFavorites } from '../store.js';

function click(el){
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

async function renderChat(setTab){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => {
    root.render(<ChatTab user={{ id: 'u1' }} coords={{ lng: 120.2, lat: 16.0 }} push={() => {}} setTab={setTab} showToast={() => {}} />);
  });
  await React.act(async () => { await Promise.resolve(); });
  return { container, root };
}

async function ask(container){
  const input = container.querySelector('[data-testid="chat-input"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await React.act(async () => {
    setter.call(input, 'beach please');
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  await React.act(async () => {
    click(container.querySelector('[data-testid="chat-send"]'));
    await Promise.resolve();
  });
  await React.act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  listFavorites.mockReset();
});

describe('dynamic Saved to Trips confirmation', () => {
  it('shows the real saved count and just-saved place, not a fixed sentence', async () => {
    // Mount sees no saved places; the save then makes two places real.
    listFavorites
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValue({ data: [{ place_id: 'other' }, { place_id: 'patar' }] });

    const setTab = vi.fn();
    const { container, root } = await renderChat(setTab);
    await ask(container);

    expect(container.querySelector('[data-testid="chat-card-save"]')).toBeTruthy();
    await React.act(async () => {
      click(container.querySelector('[data-testid="chat-card-save"]'));
      await Promise.resolve();
    });
    await React.act(async () => { await Promise.resolve(); });

    const text = container.textContent;
    expect(text).toContain('Saved to Trips');
    expect(text).toContain('2 places saved');
    expect(text).toContain("I've added Patar White Sand Beach to your Trip");
    expect(text).toContain('Go to Trips Tab');

    // The confirmation is a route into the Saved tab, not a dead end.
    await React.act(async () => {
      click(container.querySelector('[data-testid="saved-to-trips-go"]'));
    });
    expect(setTab).toHaveBeenCalledWith('saved');

    await React.act(async () => root.unmount());
    container.remove();
  });

  it('reads the count live: one saved place reads singular', async () => {
    listFavorites
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValue({ data: [{ place_id: 'patar' }] });

    const { container, root } = await renderChat(() => {});
    await ask(container);
    await React.act(async () => {
      click(container.querySelector('[data-testid="chat-card-save"]'));
      await Promise.resolve();
    });
    await React.act(async () => { await Promise.resolve(); });

    expect(container.textContent).toContain('1 place saved');
    expect(container.textContent).not.toContain('2 places saved');

    await React.act(async () => root.unmount());
    container.remove();
  });
});
