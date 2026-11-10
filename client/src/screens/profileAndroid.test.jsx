// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('./store.js', () => ({
  listPlans: vi.fn(async () => ({ data: [] })),
  listMyReviews: vi.fn(async () => []),
}));
vi.mock('./prefs.js', () => ({
  loadPrefs: vi.fn(async () => ({})),
}));
vi.mock('./AuthContext.jsx', () => ({
  useAuth: () => ({ user: null }),
}));

import Profile from './Profile.jsx';

const props = { push: () => {}, setTab: () => {}, user: { id: 'u1', email: 'debug@lakbai.app' }, signOut: async () => {} };

afterEach(() => {
  delete window.Capacitor;
});

describe('Profile → Android app download', () => {
  it('links the APK served from the site root', () => {
    const html = renderToString(<Profile {...props} />);
    expect(html).toContain('data-testid="menu-android"');
    expect(html).toContain('href="/LakbAI.apk"');
    expect(html).toContain('Get the Android app');
  });

  it('hides the row inside the native Android shell', () => {
    window.Capacitor = { isNativePlatform: () => true };
    const html = renderToString(<Profile {...props} />);
    expect(html).not.toContain('data-testid="menu-android"');
  });
});
