// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import Emergency from './Emergency.jsx';

describe('Emergency with missing coords', () => {
  it('renders the safety screen instead of crashing when coords is null', () => {
    const html = renderToString(<Emergency coords={null} pop={() => {}} showToast={() => {}} />);
    expect(html).toContain('emergency-page');
  });

  it('renders gracefully when coords is undefined', () => {
    const html = renderToString(<Emergency coords={undefined} pop={() => {}} showToast={() => {}} />);
    expect(html).toContain('emergency-page');
  });
});

describe('Emergency hospital directions', () => {
  it('never queries the fallback centre as the traveler location', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ hospitals: [], police: [] }) }));
    vi.stubGlobal('fetch', fetchMock);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(<Emergency coords={{ lng: 120.23, lat: 16.03 }} pop={() => {}} showToast={() => {}} />);
    });
    await React.act(async () => { await Promise.resolve(); });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Location is off');

    await React.act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('guides to a nearby hospital in the app instead of linking out to Google Maps', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        hospitals: [{ name: 'Pangasinan Provincial Hospital', lng: 120.5, lat: 15.98, address: 'San Carlos City' }],
        police: [],
      }),
    })));
    const openDirections = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(<Emergency coords={{ lng: 120.34, lat: 16.043 }} pop={() => {}} showToast={() => {}} openDirections={openDirections} />);
    });
    await React.act(async () => { await Promise.resolve(); });
    await React.act(async () => { await Promise.resolve(); });

    const row = container.querySelector('[data-testid="emg-place"]');
    expect(row).toBeTruthy();
    expect(container.querySelector('a[href^="https://www.google.com/maps"]')).toBeNull();

    await React.act(async () => {
      row.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    expect(openDirections).toHaveBeenCalledWith(expect.objectContaining({ name: 'Pangasinan Provincial Hospital' }));

    await React.act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
});
