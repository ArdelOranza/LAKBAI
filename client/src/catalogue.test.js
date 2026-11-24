// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { fetchCatalogue, dedupeCatalogue } from './catalogue.js';

const PATAR = { id: 'patar-beach-bolinao', name: 'Patar Beach', town: 'Bolinao', lng: 119.79, lat: 16.32, categories: ['Beach'] };
const ANON = { id: 'ds-anon', name: 'The Anonymous Garden', town: 'Dagupan City', lng: 120.34, lat: 16.04, categories: ['restaurant'] };
// The same building as PATAR, arriving from the dataset layer ~50 m away.
const PATAR_DUP = { id: 'ds-patar', name: 'Patar Beach', town: 'Bolinao', lng: 119.7905, lat: 16.3203, categories: ['Beach & Coastal'] };

beforeEach(() => { localStorage.clear(); });

describe('dedupeCatalogue', () => {
  it('keeps the first layer and drops a later duplicate of the same building', () => {
    expect(dedupeCatalogue([PATAR, ANON, PATAR_DUP]).map(p => p.id)).toEqual(['patar-beach-bolinao', 'ds-anon']);
  });

  it('never keeps an entry without a usable point', () => {
    expect(dedupeCatalogue([PATAR, { id: 'x', name: 'No Point', lng: null, lat: null }]).map(p => p.id))
      .toEqual(['patar-beach-bolinao']);
  });
});

describe('fetchCatalogue', () => {
  it('reads /api/catalogue, dedupes it, and caches the result', async () => {
    const f = async () => ({ ok: true, json: async () => ({ places: [PATAR, ANON, PATAR_DUP] }) });
    const out = await fetchCatalogue({ fetchImpl: f });
    expect(out.map(p => p.id)).toEqual(['patar-beach-bolinao', 'ds-anon']);
    expect(JSON.parse(localStorage.getItem('lakbai.catalogue'))).toHaveLength(2);
  });

  it('falls back to the cached list when the network fails', async () => {
    localStorage.setItem('lakbai.catalogue', JSON.stringify([PATAR]));
    const f = async () => { throw new Error('offline'); };
    await expect(fetchCatalogue({ fetchImpl: f })).resolves.toEqual([PATAR]);
  });

  it('throws when offline with nothing cached', async () => {
    const f = async () => { throw new Error('offline'); };
    await expect(fetchCatalogue({ fetchImpl: f })).rejects.toThrow('offline');
  });
});