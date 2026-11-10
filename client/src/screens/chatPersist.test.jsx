// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../chatStore.js', () => ({
  latestThread: vi.fn(),
  listThreads: vi.fn(),
  saveThread: vi.fn(async (user, thread) => thread),
  cleanMessages: (messages) => messages,
  threadTitle: () => 'Chat',
}));
vi.mock('../api.js', () => ({
  chat: vi.fn(async () => ({ answer: 'Patar is in Bolinao, near the lighthouse.', candidates: [] })),
}));
vi.mock('../store.js', () => ({
  saveFavorite: vi.fn(async () => ({})),
  listFavorites: vi.fn(async () => ({ data: [] })),
}));
vi.mock('../spots.js', () => ({ fetchSpots: vi.fn(async () => []) }));

import ChatTab from './ChatTab.jsx';
import { latestThread, listThreads, saveThread } from '../chatStore.js';

const THREAD = {
  id: 'cloud-1',
  title: 'Where is Patar Beach?',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:01.000Z',
  messages: [
    { id: 'm1', role: 'user', text: 'Where is Patar Beach?', at: 1700000000000 },
    { id: 'm2', role: 'ai', text: 'Patar is in Bolinao, near the lighthouse.', at: 1700000001000 },
  ],
};

function reset(){
  latestThread.mockReset();
  listThreads.mockReset();
  saveThread.mockClear();
}

async function renderChat(){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => {
    root.render(<ChatTab user={{ id: 'u1' }} coords={{ lng: 120.2, lat: 16.0 }} push={() => {}} setTab={() => {}} showToast={() => {}} />);
  });
  await React.act(async () => { await Promise.resolve(); });
  return { container, root };
}

function click(el){
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

beforeEach(reset);

describe('ChatTab persistence', () => {
  it('reopens the last saved conversation after a reload', async () => {
    latestThread.mockResolvedValue(THREAD);
    listThreads.mockResolvedValue([THREAD]);
    const { container, root } = await renderChat();

    expect(container.textContent).toContain('Where is Patar Beach?');
    expect(container.textContent).toContain('near the lighthouse');

    await React.act(async () => root.unmount());
    container.remove();
  });

  it('saves what the traveler asked instead of discarding it', async () => {
    latestThread.mockResolvedValue(null);
    listThreads.mockResolvedValue([]);
    const { container, root } = await renderChat();

    const input = container.querySelector('[data-testid="chat-input"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await React.act(async () => {
      setter.call(input, 'Hello LakbAI');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await React.act(async () => {
      click(container.querySelector('[data-testid="chat-send"]'));
      await Promise.resolve();
    });

    expect(saveThread).toHaveBeenCalled();
    const stored = saveThread.mock.calls.some(c => (c[1].messages || []).some(m => m.role === 'user' && m.text === 'Hello LakbAI'));
    expect(stored).toBe(true);
    expect(container.textContent).toContain('near the lighthouse');

    await React.act(async () => root.unmount());
    container.remove();
  });

  it('archives the old thread on New chat and keeps it in history', async () => {
    latestThread.mockResolvedValue(THREAD);
    listThreads.mockResolvedValue([THREAD]);
    const { container, root } = await renderChat();

    await React.act(async () => {
      click(container.querySelector('[data-testid="chat-menu"]'));
    });
    await React.act(async () => {
      click(container.querySelector('[data-testid="chat-new"]'));
    });

    // Back to a clean welcome screen...
    expect(container.querySelectorAll('.chat-user')).toHaveLength(0);
    expect(container.textContent).toContain("Hi! I'm LakbAI");

    // ...but the old conversation is still listed, not deleted.
    await React.act(async () => {
      click(container.querySelector('[data-testid="chat-menu"]'));
    });
    const threads = container.querySelectorAll('[data-testid="chat-thread"]');
    expect(threads.length).toBeGreaterThan(0);
    expect(container.textContent).toContain('Where is Patar Beach?');

    await React.act(async () => root.unmount());
    container.remove();
  });
});