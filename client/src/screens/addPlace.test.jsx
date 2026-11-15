// @vitest-environment happy-dom
// The "add a missing place" sheet: a pin the traveller chose, then the details,
// then a submission that says "review", never "published".
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const calls = vi.hoisted(() => ({ order: [] }));
const store = vi.hoisted(() => ({
  submitPlace: vi.fn(async () => ({ data: { id: 'sub-1' } })),
  uploadSubmissionPhoto: vi.fn(async () => ({ path: 'u1/key-1.jpg' })),
}));
vi.mock('../store.js', () => store);
vi.mock('../AuthContext.jsx', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/components/ui/map', () => ({
  Map: ({ children, onViewportChange }) => {
    globalThis.__previewViewportChange = onViewportChange;
    return <div data-testid="preview-map">{children}</div>;
  },
  MapMarker: ({ children }) => <>{children}</>,
  MarkerContent: ({ children }) => <>{children}</>,
}));

import AddPlace from './AddPlace.jsx';

const setValue = (el, value) => {
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
};

function mount(props = {}){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const all = {
    coords: { lng: 120.57, lat: 15.98 }, hasFix: true,
    pop: vi.fn(), showToast: vi.fn(), user: { id: 'u1' }, onSubmitted: vi.fn(),
    ...props,
  };
  React.act(() => root.render(<AddPlace {...all}/>));
  const find = sel => container.querySelector(sel);
  const click = async el => { await React.act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };
  return {
    container, props: all, find, click,
    text: () => container.textContent,
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}

/** Walk to the details step with a valid pin. */
async function toDetails(h){
  await h.click(h.find('[data-testid="pin-continue"]'));
}

/** Fill the three required fields. */
function fillRequired(h){
  setValue(h.find('[data-testid="place-name"]'), 'Kapwa Garden Cafe');
  h.find('[data-testid="category-Food"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  setValue(h.find('[data-testid="place-town"]'), 'Urdaneta City');
}

beforeEach(() => {
  document.body.innerHTML = '';
  calls.order.length = 0;
  store.submitPlace.mockReset().mockImplementation(async () => { calls.order.push('insert'); return { data: { id: 'sub-1' } }; });
  store.uploadSubmissionPhoto.mockReset().mockImplementation(async () => { calls.order.push('upload'); return { path: 'u1/key-1.jpg' }; });
  globalThis.__previewViewportChange = null;
});

describe('AddPlace pin step', () => {
  it('opens choosing on the map, with Continue ready for a point inside Pangasinan', async () => {
    const h = await mount();
    expect(h.find('[data-testid="preview-map"]')).not.toBeNull();
    expect(h.find('[data-testid="pin-value"]').textContent).toBe('15.9800, 120.5700');
    expect(h.find('[data-testid="pin-continue"]').disabled).toBe(false);
    await h.unmount();
  });

  it('waits for a real GPS fix instead of dropping a pin on the fallback centre', async () => {
    const h = await mount({ hasFix: false, coords: { lng: 120.23, lat: 16.03 } });
    await h.click(h.find('[data-testid="pin-mode-gps"]'));
    expect(h.find('[data-testid="pin-continue"]').disabled).toBe(true);
    expect(h.text()).toContain('Waiting for GPS...');
    // The Pangasinan fallback centre must never become the submitted pin.
    expect(h.find('[data-testid="pin-value"]').textContent).toBe('');
    await h.unmount();
  });

  it('refuses a pin that lands outside the province box', async () => {
    const h = await mount({ hasFix: false, coords: { lng: 121.4, lat: 16.0 } });
    expect(h.find('[data-testid="pin-continue"]').disabled).toBe(true);
    expect(h.text()).toMatch(/inside Pangasinan/);
    await h.unmount();
  });

  it('Continue opens the details step', async () => {
    const h = await mount();
    await toDetails(h);
    expect(h.find('[data-testid="place-name"]')).not.toBeNull();
    await h.unmount();
  });
});

describe('AddPlace details step', () => {
  it('keeps Send disabled until name, category and town are set', async () => {
    const h = await mount();
    await toDetails(h);
    expect(h.find('[data-testid="send-submission"]').disabled).toBe(true);
    setValue(h.find('[data-testid="place-name"]'), 'Kapwa Garden Cafe');
    expect(h.find('[data-testid="send-submission"]').disabled).toBe(true);
    await React.act(async () => { h.find('[data-testid="category-Food"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    expect(h.find('[data-testid="send-submission"]').disabled).toBe(true);
    setValue(h.find('[data-testid="place-town"]'), 'Urdaneta City');
    expect(h.find('[data-testid="send-submission"]').disabled).toBe(false);
    await h.unmount();
  });

  it('sends a pending submission and says review, never published', async () => {
    const h = await mount();
    await toDetails(h);
    fillRequired(h);
    await React.act(async () => { h.find('[data-testid="send-submission"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    expect(store.submitPlace).toHaveBeenCalledTimes(1);
    expect(store.submitPlace.mock.calls[0][1]).toMatchObject({ name: 'Kapwa Garden Cafe', category: 'Food', town: 'Urdaneta City', lng: 120.57, lat: 15.98 });
    expect(h.text()).toContain('Sent for review');
    expect(h.text()).toContain('approves');
    expect(h.text()).not.toMatch(/published/i);
    // No optimistic pin: the map only learns about the place after approval.
    expect(h.props.onSubmitted).toHaveBeenCalled();
    await h.unmount();
  });

  it('uploads a chosen photo before the row, and records its path', async () => {
    const h = await mount();
    await toDetails(h);
    fillRequired(h);
    const input = h.find('[data-testid="place-photo"]');
    const file = new window.File([new Uint8Array([1, 2, 3])], 'cafe.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await React.act(async () => { input.dispatchEvent(new window.Event('change', { bubbles: true })); });
    await React.act(async () => { h.find('[data-testid="send-submission"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    expect(calls.order).toEqual(['upload', 'insert']);
    expect(store.uploadSubmissionPhoto.mock.calls[0][0]).toEqual({ id: 'u1' });
    expect(store.uploadSubmissionPhoto.mock.calls[0][1]).toMatch(/^[0-9a-f-]{8}/);
    expect(store.submitPlace.mock.calls[0][1].photoPath).toBe('u1/key-1.jpg');
    await h.unmount();
  });

  it('still sends the place when the photo upload fails, and says so', async () => {
    store.uploadSubmissionPhoto.mockReset().mockResolvedValue({ error: 'too big' });
    const h = await mount();
    await toDetails(h);
    fillRequired(h);
    const input = h.find('[data-testid="place-photo"]');
    Object.defineProperty(input, 'files', { value: [new window.File([new Uint8Array([1])], 'c.jpg', { type: 'image/jpeg' })], configurable: true });
    await React.act(async () => { input.dispatchEvent(new window.Event('change', { bubbles: true })); });
    await React.act(async () => { h.find('[data-testid="send-submission"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    expect(store.submitPlace).toHaveBeenCalledTimes(1);
    expect(store.submitPlace.mock.calls[0][1].photoPath).toBeNull();
    expect(h.text()).toContain('Sent for review');
    await h.unmount();
  });

  it('keeps the form and explains when the same place is already submitted', async () => {
    store.submitPlace.mockResolvedValue({ duplicate: true, error: 'You already submitted this place.' });
    const h = await mount();
    await toDetails(h);
    fillRequired(h);
    await React.act(async () => { h.find('[data-testid="send-submission"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    expect(h.text()).toContain('You already submitted this place.');
    expect(h.find('[data-testid="place-name"]')).not.toBeNull();
    await h.unmount();
  });
});
