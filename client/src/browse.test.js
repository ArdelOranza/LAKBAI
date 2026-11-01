import { describe, it, expect } from 'vitest';
import { browseRows, townsFor, nearestTown, cuisineTags } from './browse.js';

const S = [
  { id: 'a', name: 'Patar Beach', town: 'Bolinao', categories: ['Beach', 'Nature'], lng: 119.869, lat: 16.303 },
  { id: 'b', name: 'Sungayan Grill', town: 'Bolinao', categories: ['Food', 'Dining'], lng: 119.875, lat: 16.31 },
  { id: 'c', name: 'Pisces Coffee Hub', town: 'San Carlos City', categories: ['Food', 'Dining'], lng: 120.348, lat: 15.924 },
  { id: 'd', name: 'Bolinao Falls 1', town: 'Bolinao', categories: ['Beach', 'Nature'], lng: 119.905, lat: 16.34 },
  { id: 'e', name: 'Tondol Beach', town: 'Anda', categories: ['Beach', 'Nature'], lng: 119.91, lat: 16.335 },
  { id: 'f', name: 'Silverios', town: 'Dagupan', categories: ['Food', 'Dining'], lng: 120.336, lat: 16.037 },
];
const BOLINAO = { lng: 119.869, lat: 16.303 };

describe('townsFor', () => {
  it('lists only towns with matches, sorted', () => {
    expect(townsFor(S, 'beaches')).toEqual(['Anda', 'Bolinao']);
    expect(townsFor(S, 'dining')).toEqual(['Bolinao', 'Dagupan', 'San Carlos City']);
  });
});

describe('nearestTown', () => {
  it('picks the closest town that has matches', () => {
    expect(nearestTown(S, BOLINAO, 'beaches')).toBe('Bolinao');
    expect(nearestTown(S, { lng: 120.34, lat: 15.93 }, 'dining')).toBe('San Carlos City');
  });
});

describe('cuisineTags', () => {
  it('derives cuisine facets from the place name', () => {
    expect(cuisineTags('Sungayan Grill')).toContain('Seafood');
    expect(cuisineTags('Pisces Coffee Hub')).toContain('Cafés');
    expect(cuisineTags('Silverios')).toEqual([]);
  });
});

describe('browseRows', () => {
  it('filters by kind and town', () => {
    expect(browseRows(S, { kind: 'dining', town: 'Bolinao' }).map(r => r.id)).toEqual(['b']);
    expect(browseRows(S, { kind: 'beaches', town: 'Bolinao' }).map(r => r.id)).toEqual(['a', 'd']);
  });

  it('sorts nearest first and carries the distance', () => {
    const rows = browseRows(S, { kind: 'beaches', town: 'Bolinao', coords: BOLINAO });
    expect(rows[0].id).toBe('a');
    expect(rows[0].km).toBeLessThan(0.1);
  });

  it('applies the dining facets', () => {
    expect(browseRows(S, { kind: 'dining', facet: 'Seafood' }).map(r => r.id)).toEqual(['b']);
    expect(browseRows(S, { kind: 'dining', facet: 'Cafés' }).map(r => r.id)).toEqual(['c']);
    expect(browseRows(S, { kind: 'dining', facet: 'More' }).map(r => r.id)).toEqual(['f']);
  });

  it('applies the beach distance facets', () => {
    const near = browseRows(S, { kind: 'beaches', facet: 'Within 5km', coords: BOLINAO });
    expect(near.map(r => r.id)).toEqual(['a']);
    const wide = browseRows(S, { kind: 'beaches', facet: 'Within 10km', coords: BOLINAO });
    expect(wide.map(r => r.id)).toEqual(['a', 'd', 'e']);
  });
});
