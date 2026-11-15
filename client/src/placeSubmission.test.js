import { describe, it, expect } from 'vitest';
import {
  TOWNS, CATEGORIES, PROVINCE_BBOX, NOTE_MAX,
  inProvince, pointLabel, resolvePoint, continueHint,
  detailsComplete, submissionRow, statusLabel, canWithdraw,
} from './placeSubmission.js';

describe('place submission vocabulary', () => {
  it('offers the province\'s towns, cleaned of the directory\'s parentheticals', () => {
    // Every town the app already holds places in must be selectable.
    for (const t of ['Urdaneta City', 'Rosales', 'Lingayen', 'Villasis', 'Binalonan', 'Dagupan City']) {
      expect(TOWNS).toContain(t);
    }
    expect(TOWNS.some(t => /\(/.test(t))).toBe(false);
    expect(new Set(TOWNS).size).toBe(TOWNS.length);
  });

  it('offers only the words the app already sorts places by', () => {
    expect(CATEGORIES).toEqual(['Beach', 'Nature', 'Food', 'Stay', 'Culture', 'Event']);
  });
});

describe('inProvince', () => {
  it('accepts a point inside Pangasinan', () => {
    expect(inProvince(120.572, 15.976)).toBe(true);
  });

  it('refuses a point outside the province box', () => {
    expect(inProvince(121.0, 15.976)).toBe(false); // east of the bbox
    expect(inProvince(120.572, 14.6)).toBe(false);  // south of the bbox
    expect(inProvince(NaN, 15.976)).toBe(false);
    expect(PROVINCE_BBOX).toEqual({ minLng: 119.7, minLat: 15.7, maxLng: 120.7, maxLat: 16.5 });
  });
});

describe('pointLabel', () => {
  it('reads lat first, lng second, four decimals — the way a map does', () => {
    expect(pointLabel({ lng: 120.34312, lat: 16.04335 })).toBe('16.0434, 120.3431');
  });

  it('is empty with no point', () => {
    expect(pointLabel(null)).toBe('');
  });
});

describe('resolvePoint', () => {
  it('uses the map centre when the traveller chose on the map', () => {
    expect(resolvePoint({ mode: 'map', mapCenter: { lng: 120.5, lat: 16.0 } })).toEqual({ lng: 120.5, lat: 16.0 });
  });

  it('refuses a map centre that sits outside the province', () => {
    expect(resolvePoint({ mode: 'map', mapCenter: { lng: 121.5, lat: 16.0 } })).toBeNull();
  });

  it('needs a real fix in "use my location" mode, and never falls back on its own', () => {
    expect(resolvePoint({ mode: 'gps', fix: null })).toBeNull();
    expect(resolvePoint({ mode: 'gps' })).toBeNull();
  });

  it('refuses a fix that lands outside the province', () => {
    expect(resolvePoint({ mode: 'gps', fix: { lng: 121.4, lat: 16.0 } })).toBeNull();
  });

  it('uses the fix when one has arrived', () => {
    expect(resolvePoint({ mode: 'gps', fix: { lng: 120.23, lat: 16.02 } })).toEqual({ lng: 120.23, lat: 16.02 });
  });
});

describe('continueHint', () => {
  it('says why it is waiting instead of showing a dead button', () => {
    expect(continueHint({ mode: 'gps', fix: null })).toBe('Waiting for GPS...');
  });

  it('is silent once a point exists', () => {
    expect(continueHint({ mode: 'map', mapCenter: { lng: 120.5, lat: 16.0 } })).toBeNull();
  });
});

describe('detailsComplete', () => {
  it('needs a name, one category and a town — nothing else', () => {
    expect(detailsComplete({ name: 'Kapwa Garden Cafe', category: 'Food', town: 'Urdaneta City' })).toBe(true);
  });

  it('rejects a one-letter name, an unknown category or an unknown town', () => {
    expect(detailsComplete({ name: 'A', category: 'Food', town: 'Urdaneta City' })).toBe(false);
    expect(detailsComplete({ name: 'Kapwa Cafe', category: 'Whatever', town: 'Urdaneta City' })).toBe(false);
    expect(detailsComplete({ name: 'Kapwa Cafe', category: 'Food', town: 'Baguio' })).toBe(false);
  });
});

describe('submissionRow', () => {
  it('stores one category, trims text and leaves empty optional fields null', () => {
    const row = submissionRow('u1', {
      name: '  Kapwa Garden Cafe  ', town: 'Urdaneta City', barangay: '  ', category: 'Food',
      lng: '120.57', lat: '15.98', note: '  Beside the plaza  ', hours: '', price: '',
    });
    expect(row).toEqual({
      user_id: 'u1', name: 'Kapwa Garden Cafe', town: 'Urdaneta City', barangay: null,
      categories: ['Food'], lng: 120.57, lat: 15.98, note: 'Beside the plaza',
      hours: null, price: null, photo_path: null,
    });
  });

  it('keeps the reviewer note within the column\'s limit', () => {
    const row = submissionRow('u1', { name: 'X Cafe', town: 'Urdaneta City', category: 'Food', lng: 120, lat: 16, note: 'z'.repeat(NOTE_MAX + 50) });
    expect(row.note).toHaveLength(NOTE_MAX);
  });

  it('carries the uploaded photo path when there is one', () => {
    const row = submissionRow('u1', { name: 'X Cafe', town: 'Villasis', category: 'Food', lng: 120, lat: 16, photoPath: 'u1/abc.jpg' });
    expect(row.photo_path).toBe('u1/abc.jpg');
  });
});

describe('statusLabel and canWithdraw', () => {
  it('names the three states the traveller sees', () => {
    expect(statusLabel('pending').text).toBe('Pending');
    expect(statusLabel('approved').text).toBe('Live');
    expect(statusLabel('rejected').text).toBe('Not added');
  });

  it('only an unreviewed row can be taken back', () => {
    expect(canWithdraw('pending')).toBe(true);
    expect(canWithdraw('approved')).toBe(false);
    expect(canWithdraw('rejected')).toBe(false);
  });
});
