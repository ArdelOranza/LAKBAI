// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('./api.js', () => ({
  recommend: vi.fn(() => new Promise(() => {})), // never settles: pending stays observable
}));
vi.mock('./store.js', () => ({
  postReview: vi.fn(async () => ({})),
  flushOutbox: vi.fn(async () => {}),
}));

import { NearbyButton } from './Panels.jsx';

function geoloc(impl){
  Object.defineProperty(window.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: impl },
  });
}

async function mount(){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const props = { onResults: vi.fn(), onNotice: vi.fn(), onFix: vi.fn() };
  await React.act(async () => {
    root.render(<NearbyButton {...props}/>);
  });
  return {
    container, root, props,
    async click(){
      const el = container.querySelector('[data-testid="nearby-btn"]');
      await React.act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    },
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}

beforeEach(() => {
  // start each test with no geolocation at all
  delete window.navigator.geolocation;
});

describe('NearbyButton', () => {
  it('is a plain button with a discovery affordance even without a fix yet', async () => {
    const h = await mount();
    const btn = h.container.querySelector('[data-testid="nearby-btn"]');
    expect(btn.getAttribute('type')).toBe('button');
    await h.unmount();
  });

  it('notices instead of throwing when geolocation is missing entirely', async () => {
    const h = await mount();
    await h.click();
    expect(h.props.onNotice).toHaveBeenCalledWith('GPS unavailable — showing Pangasinan');
    await h.unmount();
  });

  it('goes busy (disabled + aria-busy) while locating and stays honest on errors', async () => {
    let hold, called;
    geoloc((ok, err) => { called = true; hold = err; });
    const h = await mount();
    await h.click();
    const btn = h.container.querySelector('[data-testid="nearby-btn"]');
    expect(btn.disabled).toBe(true);        // no double-locate spam
    expect(btn.getAttribute('aria-busy')).toBe('true');
    await React.act(async () => { hold(new Error('denied')); });
    expect(h.container.querySelector('[data-testid="nearby-btn"]').disabled).toBe(false);
    expect(h.props.onNotice).toHaveBeenCalledWith('GPS unavailable — showing Pangasinan');
    await h.unmount();
  });
});
