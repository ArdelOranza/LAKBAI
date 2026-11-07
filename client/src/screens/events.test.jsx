// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../store.js', () => ({
  saveFavorite: vi.fn(async () => ({})),
}));

import Events from './Events.jsx';

const COORDS = { lng: 120.33, lat: 16.04 };

async function mount(){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const props = { coords: COORDS, push: vi.fn(), pop: vi.fn(), showToast: vi.fn() };
  await React.act(async () => { root.render(<Events {...props}/>); });
  return {
    container, root, props,
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

describe('Events keyboard access', () => {
  it('the featured banner is a focusable button-like card that opens on Enter', async () => {
    const h = await mount();
    const feature = h.container.querySelector('[data-testid="event-feature"]');
    expect(feature.getAttribute('role')).toBe('button');
    expect(feature.getAttribute('tabindex')).toBe('0');
    await h.key('[data-testid="event-feature"]', 'Enter');
    expect(h.props.push).toHaveBeenCalledTimes(1);
    expect(h.props.push.mock.calls[0][0].name).toBe('detail');
    await h.unmount();
  });

  it('the featured banner opens on Space too', async () => {
    const h = await mount();
    await h.key('[data-testid="event-feature"]', ' ');
    expect(h.props.push).toHaveBeenCalledTimes(1);
    await h.unmount();
  });

  it('list rows are focusable and open on Enter', async () => {
    const h = await mount();
    const row = h.container.querySelector('[data-testid="event-row"]');
    expect(row.getAttribute('role')).toBe('button');
    expect(row.getAttribute('tabindex')).toBe('0');
    await h.key('[data-testid="event-row"]', 'Enter');
    expect(h.props.push).toHaveBeenCalledTimes(1);
    await h.unmount();
  });

  it('the Save button inside a row does not also navigate (no propagation through the keydown)', async () => {
    const h = await mount();
    const row = h.container.querySelector('[data-testid="event-row"]');
    const save = row.querySelector('[data-testid="event-add"]');
    await React.act(async () => {
      save.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    expect(h.props.push).not.toHaveBeenCalled();
  });
});
