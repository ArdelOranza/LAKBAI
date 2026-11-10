// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

// A request that only settles when the traveler stops it.
const chat = vi.fn((q, proximity, signal) => new Promise((resolve, reject) => {
  signal.addEventListener('abort', () => reject(new Error('stopped by traveler')));
}));

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

async function renderChat(){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => {
    root.render(<ChatTab user={{ id: 'u1' }} coords={{ lng: 120.2, lat: 16.0 }} push={() => {}} setTab={() => {}} showToast={() => {}} />);
  });
  await React.act(async () => { await Promise.resolve(); });

  const input = container.querySelector('[data-testid="chat-input"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await React.act(async () => {
    setter.call(input, 'plan a day');
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  await React.act(async () => {
    click(container.querySelector('[data-testid="chat-send"]'));
    await Promise.resolve();
  });
  return { container, root, input };
}

describe('stop control', () => {
  it('turns the send button into the stop control while an answer is in flight', async () => {
    const { container, root } = await renderChat();

    const btn = container.querySelector('[data-testid="chat-send"]');
    expect(btn.getAttribute('aria-label')).toBe('Stop the answer');
    expect(btn.disabled).toBe(false);
    // No second stop button inside the message bubble.
    expect(container.querySelector('[data-testid="chat-stop"]')).toBeNull();
    expect(container.textContent).toContain('Searching places');

    await React.act(async () => {
      click(btn);
      await Promise.resolve();
    });
    await React.act(async () => { await Promise.resolve(); });

    expect(container.textContent).toContain('the request was stopped');
    const after = container.querySelector('[data-testid="chat-send"]');
    expect(after.getAttribute('aria-label')).toBe('Send');
    expect(after.disabled).toBe(false);

    await React.act(async () => root.unmount());
    container.remove();
  });
});
