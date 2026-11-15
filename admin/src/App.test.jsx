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
  listSubmissions: vi.fn(async () => ({ submissions: [{
    id: 'sub-1',
    status: 'pending',
    name: 'Tondol Sunset Grill',
    town: 'Anda',
    barangay: 'Tondol',
    categories: ['Food'],
    note: 'Beside the beach, open at sunset.',
    hours: '4pm - 10pm',
    price: '150-400',
    lng: 119.9502,
    lat: 16.2903,
    email: 'ana@example.com',
    photo_path: 'user-1/sub-1.jpg',
    created_at: '2026-11-14T10:00:00.000Z',
  }] })),
  approveSubmission: vi.fn(async () => ({ submission: { id: 'sub-1', status: 'approved' } })),
  rejectSubmission: vi.fn(async (id, note) => ({ submission: { id, status: 'rejected', review_note: note } })),
  submissionPhoto: vi.fn(async () => ({ url: 'https://example.com/signed/tondol.jpg' })),
}));
vi.mock('./api.js', () => ({
  getToken: () => 't',
  setToken: () => {},
  api: {
    list: mocks.list, update: mocks.update, create: vi.fn(), remove: vi.fn(), findPhoto: vi.fn(),
    places: mocks.places, setPhotos: mocks.setPhotos,
    listSubmissions: mocks.listSubmissions,
    approveSubmission: mocks.approveSubmission,
    rejectSubmission: mocks.rejectSubmission,
    submissionPhoto: mocks.submissionPhoto,
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

  // --- submissions queue -------------------------------------------------
  const click = async el => { await React.act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };

  async function openSubmissions(){
    const h = await mount();
    await click(h.container.querySelector('[data-testid="tab-subs"]'));
    await React.act(async () => {});
    return h;
  }

  it('shows the pending queue with a count, and opens a submission for review', async () => {
    const h = await openSubmissions();
    const tab = h.container.querySelector('[data-testid="tab-subs"]');
    expect(tab.textContent).toContain('1');
    expect(mocks.listSubmissions).toHaveBeenCalledWith('pending');

    await click(h.container.querySelector('[data-testid="sub-row"]'));
    expect(h.container.querySelector('[data-testid="sub-editor"]').textContent).toContain('Tondol Sunset Grill');
    expect(h.container.querySelector('[data-testid="sub-editor"]').textContent).toContain('ana@example.com');
    // The photo is private until approval: it comes from a short-lived URL.
    expect(mocks.submissionPhoto).toHaveBeenCalledWith('sub-1');
    expect(h.container.querySelector('[data-testid="sub-photo"]')).not.toBeNull();
    await h.unmount();
  });

  it('approves a submission through the token-guarded endpoint', async () => {
    const h = await openSubmissions();
    await click(h.container.querySelector('[data-testid="sub-row"]'));
    await click(h.container.querySelector('[data-testid="sub-approve"]'));
    expect(mocks.approveSubmission).toHaveBeenCalledWith('sub-1');
    expect(h.container.textContent).toContain('Approved');
    await h.unmount();
  });

  it('will not reject without a reason of 5-200 characters', async () => {
    const h = await openSubmissions();
    await click(h.container.querySelector('[data-testid="sub-row"]'));
    const note = h.container.querySelector('[data-testid="sub-note"]');
    await React.act(async () => { type(note, 'no'); });
    await click(h.container.querySelector('[data-testid="sub-reject"]'));
    expect(mocks.rejectSubmission).not.toHaveBeenCalled();
    expect(h.container.querySelector('[data-testid="sub-note-error"]')).not.toBeNull();

    await React.act(async () => { type(note, 'Already on the map as Tondol Beach Grill.'); });
    await click(h.container.querySelector('[data-testid="sub-reject"]'));
    expect(mocks.rejectSubmission).toHaveBeenCalledWith('sub-1', 'Already on the map as Tondol Beach Grill.');
    await h.unmount();
  });

  it('blocks approval when the pin lands on an existing place with the same name', async () => {
    mocks.list.mockResolvedValueOnce({ spots: [
      { id: 'tondol-grill', name: 'Tondol Sunset Grill', town: 'Anda', district: '1', categories: ['Food'], blurb: '', lng: 119.95025, lat: 16.29031, photos: [] },
    ] });
    const h = await openSubmissions();
    await click(h.container.querySelector('[data-testid="sub-row"]'));
    const approve = h.container.querySelector('[data-testid="sub-approve"]');
    expect(approve.disabled).toBe(true);
    const guard = h.container.querySelector('[data-testid="sub-duplicate"]');
    expect(guard.textContent).toContain('Tondol Sunset Grill');
    expect(guard.textContent).toContain('Reject');
    await h.unmount();
  });
});
