// @vitest-environment happy-dom
// The boot screen runs before the session check settles (up to 8 s on a hung
// network). It must look like LakbAI immediately, never like a blank page.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const auth = vi.hoisted(() => ({ state: { user: null, loading: true, recovery: false } }));
vi.mock('./AuthContext.jsx', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => auth.state,
}));

import App from './App.jsx';

async function mount(){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => { root.render(<App/>); });
  return {
    container,
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  auth.state = { user: null, loading: true, recovery: false };
});

describe('boot loading screen', () => {
  it('paints a branded frame, not a bare white page', async () => {
    const h = await mount();
    const screen = h.container.querySelector('[data-testid="boot-loading"]');
    expect(screen).not.toBeNull();
    expect(screen.getAttribute('aria-busy')).toBe('true');
    // Same mark + wordmark as the splash, so the hand-off is seamless.
    expect(screen.querySelector('svg')).not.toBeNull();
    expect(screen.querySelector('img[src="/lakbai-wordmark.png"]')).not.toBeNull();
    expect(screen.textContent).toContain('Lakbai, smarter, not harder.');
    // The splash photo is the backdrop; the gradient underneath guarantees a
    // painted frame before the photo decodes.
    expect(screen.querySelector('img[src="/intro-hundred-islands.jpg"]')).not.toBeNull();
    expect(screen.className).toContain('boot-loading');
    await h.unmount();
  });

  it('shows an accessible progress indicator while auth resolves', async () => {
    const h = await mount();
    const bar = h.container.querySelector('[data-testid="boot-progress"]');
    expect(bar).not.toBeNull();
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-label')).toBe('Loading LakbAI');
    expect(h.container.textContent).toContain('Loading Lakbai');
    await h.unmount();
  });

  it('leaves the loading frame as soon as auth settles', async () => {
    auth.state = { user: null, loading: false, recovery: false };
    const h = await mount();
    expect(h.container.querySelector('[data-testid="boot-loading"]')).toBeNull();
    expect(h.container.querySelector('[data-testid="get-started"]')).not.toBeNull();
    await h.unmount();
  });
});
