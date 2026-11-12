// The topic tabs and the follow-up chips both hang off the last answer's
// intent. That intent has to be kept on the message, or the row never changes.
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
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
  chat: vi.fn(async () => ({ intent: 'commute', answer: 'Ordinary is ₱467.50.', candidates: [] })),
}));
vi.mock('../store.js', () => ({
  saveFavorite: vi.fn(async () => ({})),
  listFavorites: vi.fn(async () => ({ data: [] })),
}));
vi.mock('../spots.js', () => ({ fetchSpots: vi.fn(async () => []) }));

import ChatTab from './ChatTab.jsx';

const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

async function askFare(container){
  const input = container.querySelector('[data-testid="chat-input"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await React.act(async () => {
    setter.call(input, 'bus fare from Cubao to Dagupan');
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  await React.act(async () => { click(container.querySelector('[data-testid="chat-send"]')); await Promise.resolve(); });
  await React.act(async () => { await Promise.resolve(); });
}

describe('chat topics after a fare answer', () => {
  it('marks Commute active and offers another fare question', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await React.act(async () => {
      root.render(<ChatTab
        user={{ id: 'u1' }}
        coords={{ lng: 120.3431, lat: 16.0433 }}
        push={() => {}} setTab={() => {}} showToast={() => {}}
      />);
    });
    await React.act(async () => { await Promise.resolve(); });

    await askFare(container);

    const commute = container.querySelector('[data-testid="topic-commute"]');
    expect(commute.getAttribute('aria-selected')).toBe('true');
    expect(container.textContent).toContain('₱467.50');

    const chips = [...container.querySelectorAll('.quick-action')].map(b => b.textContent);
    expect(chips.join(' | ')).toContain('Fare to another town');

    await React.act(async () => root.unmount());
    container.remove();
  });
});
