import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiUrl } from './apiBase.js';

afterEach(() => vi.unstubAllEnvs());

describe('apiUrl', () => {
  it('keeps requests relative when VITE_API_URL is unset (dev proxy)', () => {
    vi.stubEnv('VITE_API_URL', '');
    expect(apiUrl('/api/spots')).toBe('/api/spots');
  });

  it('prefixes the configured API origin and trims trailing slashes', () => {
    vi.stubEnv('VITE_API_URL', 'https://lakbai-api.onrender.com/');
    expect(apiUrl('/api/places?q=falls')).toBe('https://lakbai-api.onrender.com/api/places?q=falls');
  });

  it('never produces a double slash', () => {
    vi.stubEnv('VITE_API_URL', 'https://lakbai-api.onrender.com///');
    expect(apiUrl('/api/spots')).toBe('https://lakbai-api.onrender.com/api/spots');
  });
});
