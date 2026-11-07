// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const auth = vi.hoisted(() => ({ state: { user: null, loading: true, recovery: false } }));
vi.mock('./AuthContext.jsx', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => auth.state,
}));
// Any screen crash under test (Logo exploded) must land in the screen fallback,
// not take the whole shell down.
vi.mock('./logo.jsx', () => ({
  default: function ExplodingLogo(){ throw new Error('boom'); },
}));

import App from './App.jsx';

async function mountApp(){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let caught = null;
  await React.act(async () => {
    try { root.render(<App/>); } catch (e) { caught = e; }
  });
  return {
    container, caught,
    html: () => container.innerHTML,
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}

beforeEach(() => { document.body.innerHTML = ''; auth.state = { user: null, loading: true, recovery: false }; });

describe('App screen error boundary scope', () => {
  it('a crash while the loading screen renders shows the fallback, not a dead app', async () => {
    const h = await mountApp();
    expect(h.caught).toBeNull();
    expect(h.html()).toContain('This screen couldn’t load');
    await h.unmount();
  });

  it('a crash on the Splash (logged-out) screen keeps the rest of the shell alive', async () => {
    auth.state = { user: null, loading: false, recovery: false };
    const h = await mountApp();
    expect(h.caught).toBeNull();
    expect(h.html()).toContain('This screen couldn’t load');
    await h.unmount();
  });
});
