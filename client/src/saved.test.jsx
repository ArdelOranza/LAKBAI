// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('./AuthContext.jsx', () => ({
  useAuth: () => ({ user: null, loading: false, signOut: () => {} }),
}));
vi.mock('./store.js', () => ({
  listFavorites: vi.fn(async () => ({ data: [] })),
  listHistory: vi.fn(async () => []),
  postReview: vi.fn(async () => ({})),
  flushOutbox: vi.fn(async () => {}),
}));

import Saved from './Saved.jsx';

describe('Saved', () => {
  it('shows a sign-in prompt when logged out instead of crashing on a deleted component', () => {
    const html = renderToString(<Saved />);
    expect(html).toContain('saved-login');
    expect(html).toContain('Sign in to view saved places');
  });
});
