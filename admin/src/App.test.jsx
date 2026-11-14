// @vitest-environment happy-dom
// Admin smoke: list loads, edit + save goes through the token-guarded API.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const mocks = vi.hoisted(() => ({
  list: vi.fn(async () => ({ spots: [{ id: 'patar-beach-bolinao', name: 'Patar Beach', town: 'Bolinao', district: '1', categories: ['Beach'], blurb: 'x', lng: 119.84, lat: 16.2, photos: [] }] })),
  update: vi.fn(async (id, data) => ({ spot: { ...data, id } })),
  places: vi.fn(async () => ({ places: [{ id: 'ChIJtest1', name: 'Test Resto', town: 'Dagupan City', address: 'Dagupan', categories: ['restaurant'], rating: '4.5', reviews: '10', photos: [] }] })),
  setPhotos: vi.fn(async (id, photos) => ({ place: { id, photos } })),
}));
vi.mock('./api.js', () => ({
  getToken: () => 't',
  setToken: () => {},
  api: {
    list: mocks.list, update: mocks.update, create: vi.fn(), remove: vi.fn(), findPhoto: vi.fn(),
    places: mocks.places, setPhotos: mocks.setPhotos,
  },
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

/** Happy-dom input helper: React's value tracker needs the native setter. */
function type(el, value){
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
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

  it('adds multiple photo rows and saves them as an array', async () => {
    const h = await mount();
    const row = h.container.querySelector('[data-testid="row"]');
    await React.act(async () => { row.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });

    await React.act(async () => { h.container.querySelector('[data-testid="add-photo"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    const first = h.container.querySelector('[data-testid="f-photo-0"]');
    await React.act(async () => { type(first, 'https://example.com/one.jpg'); });

    await React.act(async () => { h.container.querySelector('[data-testid="add-photo"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    const second = h.container.querySelector('[data-testid="f-photo-1"]');
    await React.act(async () => { type(second, 'https://example.com/two.jpg'); });

    await React.act(async () => { h.container.querySelector('[data-testid="save"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    expect(mocks.update).toHaveBeenLastCalledWith('patar-beach-bolinao', expect.objectContaining({
      photos: ['https://example.com/one.jpg', 'https://example.com/two.jpg'],
    }));

    // remove the first row, save, and only the second URL remains
    await React.act(async () => { h.container.querySelector('[data-testid="remove-photo-0"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    await React.act(async () => { h.container.querySelector('[data-testid="save"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    expect(mocks.update).toHaveBeenLastCalledWith('patar-beach-bolinao', expect.objectContaining({
      photos: ['https://example.com/two.jpg'],
    }));
    await h.unmount();
  });

  it('lists restaurants and saves their photos through the restaurant endpoint', async () => {
    const h = await mount();
    await React.act(async () => { h.container.querySelector('[data-testid="tab-restos"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    expect(mocks.places).toHaveBeenCalled();
    expect(h.container.textContent).toContain('Test Resto');

    const row = [...h.container.querySelectorAll('[data-testid="row"]')].find(r => r.textContent.includes('Test Resto'));
    await React.act(async () => { row.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    await React.act(async () => { h.container.querySelector('[data-testid="add-photo"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    const input = h.container.querySelector('[data-testid="f-photo-0"]');
    await React.act(async () => { type(input, 'https://example.com/resto.jpg'); });
    await React.act(async () => { h.container.querySelector('[data-testid="save-photos"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });

    expect(mocks.setPhotos).toHaveBeenCalledWith('ChIJtest1', ['https://example.com/resto.jpg']);
    await h.unmount();
  });
});
