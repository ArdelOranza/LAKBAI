// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../store.js', () => ({
  listPlans: vi.fn(async () => ({ data: [] })),
}));
vi.mock('../AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

import Itineraries from './Itineraries.jsx';

async function mount(){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const props = { pop: vi.fn(), push: vi.fn(), setTab: vi.fn() };
  await React.act(async () => { root.render(<Itineraries {...props}/>); });
  return {
    container, root, props,
    async click(sel){
      const el = container.querySelector(sel);
      await React.act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    },
    async key(sel, key){
      const el = container.querySelector(sel);
      await React.act(async () => {
        el.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      });
    },
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('Itineraries "Generate New AI Itinerary"', () => {
  it('leaves this stacked screen for Saved instead of doing nothing', async () => {
    const h = await mount();
    await h.click('[data-testid="generate-new"]');
    // Stacked over Saved: setTab alone is invisible because this screen is still
    // on top — the screen must pop itself off the stack first.
    expect(h.props.pop).toHaveBeenCalledTimes(1);
    expect(h.props.setTab).toHaveBeenCalledWith('saved');
    await h.unmount();
  });

  it('works from the keyboard with Enter too', async () => {
    const h = await mount();
    const el = h.container.querySelector('[data-testid="generate-new"]');
    await React.act(async () => {
      el.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    expect(h.props.pop).toHaveBeenCalledTimes(1);
    expect(h.props.setTab).toHaveBeenCalledWith('saved');
    await h.unmount();
  });
});
