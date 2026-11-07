// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../api.js', () => ({
  recommend: vi.fn(async () => ({ places: [] })),
}));
vi.mock('../geocode.js', () => ({
  reverseGeocode: vi.fn(async () => 'Alaminos City, Pangasinan'),
}));

import Home from './Home.jsx';

const FALLBACK_CENTER = { lng: 120.23, lat: 16.03 };
const REAL_FIX = { lng: 120.031, lat: 16.161 }; // Alaminos area, not the fallback centre
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ features: [] }) })));

describe('Home', () => {
  it('renders the explore header when given the app props', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await React.act(async () => {
      root.render(
        <Home
          coords={REAL_FIX}
          push={() => {}}
          showToast={() => {}}
          setTab={() => {}}
          user={{ id: 'u1', email: 'a@b.com' }}
        />
      );
    });
    expect(container.textContent).toContain('Explore Pangasinan');
    // U12: the location line under the header reflects the real fix, not a static label
    expect(container.textContent).toContain('Alaminos City, Pangasinan');
    await React.act(async () => root.unmount());
    container.remove();
  });

  it('mic tap without SpeechRecognition shows a toast instead of throwing', async () => {
    const showToast = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    // happy-dom has no SpeechRecognition; ensure deleted
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    await React.act(async () => {
      root.render(
        <Home
          coords={FALLBACK_CENTER}
          push={() => {}}
          showToast={showToast}
          setTab={() => {}}
          user={{ id: 'u1', email: 'a@b.com' }}
        />
      );
    });
    const btn = container.querySelector('button[aria-label="Voice Search"]') ||
      container.querySelector('[data-testid="voice-search"]') ||
      Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('mic') || b.getAttribute('aria-label')?.includes('Voice'));
    // Fallback: click the mic icon button (first button with Mic svg)
    const micBtn = btn || container.querySelector('button');
    await React.act(async () => {
      micBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    // No ReferenceError; unsupported SR must toast
    expect(showToast).toHaveBeenCalledWith('Voice search not supported here', 'error');
    await React.act(async () => root.unmount());
    container.remove();
  });
});
