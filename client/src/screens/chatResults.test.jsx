// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const CANDIDATES = [
  { name: 'Patar White Sand Beach', hint: 'Bolinao', rating: '4.8', reviews: '351', description: 'Description of place one.', lng: 120.1, lat: 16.1 },
  { name: 'Bolinao Falls', hint: 'Bolinao', rating: '4.5', reviews: '75', description: 'Description of place two.', lng: 120.09, lat: 16.11 },
  { name: 'Cape Bolinao Lighthouse', hint: 'Bolinao', rating: '4.4', reviews: '597', lng: 120.08, lat: 16.12 },
  { name: 'Enchanted Cave', hint: 'Bolinao', rating: '4.2', reviews: '794', lng: 120.07, lat: 16.13 },
  { name: 'Rock View Beach', hint: 'Bolinao', rating: '4.1', reviews: '580', lng: 120.06, lat: 16.14 },
];

const BULLETS = CANDIDATES.map(c => `- **${c.name}** (${c.hint} · ${c.rating}★ · ${c.reviews} reviews) — Description of place one.`).join('\n');

vi.mock('../chatStore.js', () => ({
  latestThread: vi.fn(async () => null),
  listThreads: vi.fn(async () => []),
  saveThread: vi.fn(async (user, thread) => thread),
  cleanMessages: (messages) => messages,
  cachedThreads: () => [],
  threadTitle: () => 'Chat',
}));
vi.mock('../api.js', () => ({
  chat: vi.fn(async () => ({ answer: `Closest to you:\n${BULLETS}`, candidates: [...CANDIDATES] })),
}));
vi.mock('../store.js', () => ({
  saveFavorite: vi.fn(async () => ({})),
  listFavorites: vi.fn(async () => ({ data: [] })),
}));
vi.mock('../spots.js', () => ({ fetchSpots: vi.fn(async () => []) }));

import ChatTab from './ChatTab.jsx';
import { latestThread } from '../chatStore.js';

function click(el){
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

async function mountChat(){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => {
    root.render(<ChatTab user={{ id: 'u1' }} coords={{ lng: 120.2, lat: 16.0 }} push={() => {}} setTab={() => {}} showToast={() => {}} />);
  });
  await React.act(async () => { await Promise.resolve(); });
  return { container, root };
}

async function ask(container){
  const input = container.querySelector('[data-testid="chat-input"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await React.act(async () => {
    setter.call(input, 'beaches please');
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  await React.act(async () => {
    click(container.querySelector('[data-testid="chat-send"]'));
    await Promise.resolve();
  });
  await React.act(async () => { await Promise.resolve(); });
}

async function renderChat(){
  const mounted = await mountChat();
  await ask(mounted.container);
  return mounted;
}

const rows = c => c.querySelectorAll('[data-testid="chat-row"]');

describe('chat result sheet', () => {
  it('leads with one featured card and two refined rows, not a wall of prose', async () => {
    const { container, root } = await renderChat();

    expect(container.querySelector('[data-testid="chat-results"]')).toBeTruthy();

    const hero = container.querySelector('[data-testid="chat-card"]');
    expect(hero).toBeTruthy();
    expect(hero.textContent).toContain('Patar White Sand Beach');
    expect(hero.textContent).toContain('351');
    expect(hero.textContent).toContain('Description of place one.');

    expect(rows(container).length).toBe(2);
    expect(container.textContent).toContain('Closest to you');
    expect(container.textContent).toContain('5 places');
    // The duplicated bullet dump is gone; the cards carry it instead.
    expect(container.textContent).not.toContain('Description of place one. (Bolinao');

    await React.act(async () => root.unmount());
    container.remove();
  });

  it('reveals the remaining places on request, and collapses again', async () => {
    const { container, root } = await renderChat();

    const more = container.querySelector('[data-testid="chat-show-more"]');
    expect(more).toBeTruthy();
    expect(more.textContent).toContain('Show 2 more');

    await React.act(async () => { click(more); });
    expect(rows(container).length).toBe(4);
    expect(container.textContent).toContain('Rock View Beach');
    expect(container.querySelector('[data-testid="chat-show-more"]').textContent).toContain('Show less');

    await React.act(async () => { click(container.querySelector('[data-testid="chat-show-more"]')); });
    expect(rows(container).length).toBe(2);

    await React.act(async () => root.unmount());
    container.remove();
  });

  it('gives every row a working save control', async () => {
    const { container, root } = await renderChat();
    expect(container.querySelectorAll('[data-testid="chat-row-save"]').length).toBe(2);

    await React.act(async () => {
      click(container.querySelector('[data-testid="chat-row-save"]'));
      await Promise.resolve();
    });

    const text = container.textContent;
    expect(text).toContain('Saved to Trips');
    expect(text).toContain("I've added Bolinao Falls to your Trip");

    await React.act(async () => root.unmount());
    container.remove();
  });

  it('renders a saved thread from before the change with the same sheet', async () => {
    latestThread.mockResolvedValueOnce({
      id: 't-old',
      created_at: new Date().toISOString(),
      messages: [
        { id: 'm1', role: 'user', at: 1, text: 'beaches' },
        {
          id: 'm2', role: 'ai', at: 2,
          text: 'Closest to you:\n- **Patar White Sand Beach** (Bolinao · 4.8★) — Description of place one.',
          cards: [{ id: 'patar', name: 'Patar White Sand Beach', hint: 'Bolinao', lng: 120.1, lat: 16.1, description: 'Description of place one.' }],
          more: ['Bolinao Falls — Bolinao', 'Cape Bolinao Lighthouse — Bolinao'],
        },
      ],
    });

    const { container, root } = await mountChat();

    expect(container.querySelector('[data-testid="chat-results"]')).toBeTruthy();
    expect(rows(container).length).toBe(2);
    expect(container.textContent).toContain('3 places');
    expect(container.textContent).toContain('Cape Bolinao Lighthouse');
    // The old plain-text list is gone; the cards carry the same places.
    expect(container.querySelector('[data-testid="chat-more"]')).toBeNull();

    await React.act(async () => root.unmount());
    container.remove();
  });
});
