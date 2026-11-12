// @vitest-environment happy-dom
// The chat must tell the server where the traveler is only when there really is
// a fix. Sending the province fallback point made terminal answers claim a
// distance from the wrong town.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const chat = vi.fn(async () => ({ intent: 'discover', answer: 'ok', candidates: [] }));

vi.mock('../chatStore.js', () => ({
  latestThread: vi.fn(async () => null),
  listThreads: vi.fn(async () => []),
  saveThread: vi.fn(async (user, thread) => thread),
  cleanMessages: (messages) => messages,
  cachedThreads: () => [],
  threadTitle: () => 'Chat',
}));
vi.mock('../api.js', () => ({ chat: (...args) => chat(...args) }));
vi.mock('../store.js', () => ({
  saveFavorite: vi.fn(async () => ({})),
  listFavorites: vi.fn(async () => ({ data: [] })),
}));
vi.mock('../spots.js', () => ({ fetchSpots: vi.fn(async () => []) }));

import ChatTab from './ChatTab.jsx';

function click(el){
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

async function send(coords, hasFix){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => {
    root.render(<ChatTab user={{ id: 'u1' }} coords={coords} hasFix={hasFix} push={() => {}} setTab={() => {}} showToast={() => {}} />);
  });
  await React.act(async () => { await Promise.resolve(); });

  const input = container.querySelector('[data-testid="chat-input"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await React.act(async () => {
    setter.call(input, 'which terminal is closest to me');
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  await React.act(async () => {
    click(container.querySelector('[data-testid="chat-send"]'));
    await Promise.resolve();
  });
  await React.act(async () => root.unmount());
  container.remove();
}

describe('chat proximity', () => {
  beforeEach(() => chat.mockClear());

  it('sends nothing when there is no fix, even though coords are set', async () => {
    await send({ lng: 120.23, lat: 16.03 }, false);
    expect(chat).toHaveBeenCalledTimes(1);
    expect(chat.mock.calls[0][1]).toBe('');
  });

  it('sends the coordinates when there is a real fix', async () => {
    await send({ lng: 120.34, lat: 16.043 }, true);
    expect(chat).toHaveBeenCalledTimes(1);
    expect(chat.mock.calls[0][1]).toBe('120.34,16.043');
  });
});
