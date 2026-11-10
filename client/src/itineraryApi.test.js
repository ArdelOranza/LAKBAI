// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { itineraryFromSaved } from './api.js';

const PLAN = { title: 'Near you', schedule: [] };

function okFetch(){
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => PLAN }));
}

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('itineraryFromSaved', () => {
  it('sends the traveler fix so the server can stay within 50 km', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const f = okFetch();
    vi.stubGlobal('fetch', f);

    await itineraryFromSaved(['Patar Beach'], 8, 9, '119.79,16.12');

    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.proximity).toBe('119.79,16.12');
  });

  it('never reuses a plan cached for a different location', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const f = okFetch();
    vi.stubGlobal('fetch', f);

    await itineraryFromSaved(['Patar Beach'], 8, 9, '119.79,16.12');
    await itineraryFromSaved(['Patar Beach'], 8, 9, '120.33,16.04');

    expect(f).toHaveBeenCalledTimes(2);
  });

  it('reuses the cached plan for the same place and fix', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const f = okFetch();
    vi.stubGlobal('fetch', f);

    await itineraryFromSaved(['Patar Beach'], 8, 9, '119.79,16.12');
    await itineraryFromSaved(['Patar Beach'], 8, 9, '119.79,16.12');

    expect(f).toHaveBeenCalledTimes(1);
  });
});