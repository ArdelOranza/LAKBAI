// @vitest-environment happy-dom
// Admin smoke: list loads, edit + save goes through the token-guarded API.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const mocks = vi.hoisted(() => ({
  list: vi.fn(async () => ({ spots: [{ id: 'patar-beach-bolinao', name: 'Patar Beach', town: 'Bolinao', district: '1', categories: ['Beach'], blurb: 'x', lng: 119.84, lat: 16.2, photos: [] }] })),
  update: vi.fn(async (id, data) => ({ spot: { ...data, id } })),
}));
vi.mock('./api.js', () => ({
  getToken: () => 't',
  setToken: () => {},
  api: { list: mocks.list, update: mocks.update, create: vi.fn(), remove: vi.fn(), findPhoto: vi.fn() },
}));

import App from './App.jsx';

async function mount(){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => { root.render(<App />); });
  await React.act(async () => {});
  return { container, root,
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}

describe('admin app', () => {
  it('lists spots from the admin API and can save an edit', async () => {
    const h = await mount();
    expect(h.container.textContent).toContain('Patar Beach');
    const row = h.container.querySelector('[data-testid="row"]');
    await React.act(async () => { row.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    const name = h.container.querySelector('[data-testid="f-name"]');
    name.value = 'Patar Beach (edited)';
    name.dispatchEvent(new window.Event('input', { bubbles: true }));
    await React.act(async () => { h.container.querySelector('[data-testid="save"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0][0]).toBe('patar-beach-bolinao');
    await h.unmount();
  });
});
