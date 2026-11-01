import { describe, it, expect } from 'vitest';
import { FESTIVALS, nextOccurrence, upcomingFestivals, thisMonthFestivals, monthOrNextFestivals } from './festivals.js';

const make = (month, day, endMonth = month, endDay = day) => ({
  id: `f-${month}-${day}`, name: 'Fest', town: 'Bolinao',
  month, day, endMonth, endDay, lng: 119.86, lat: 16.3,
});

describe('nextOccurrence', () => {
  it('keeps this year when the start is still ahead', () => {
    const d = nextOccurrence(make(12, 1), new Date(2026, 10, 1, 9));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(11);
  });

  it('rolls to next year once the edition has ended', () => {
    const d = nextOccurrence(make(4, 17, 4, 24), new Date(2026, 10, 1, 9));
    expect(d.getFullYear()).toBe(2027);
  });

  it('keeps this year while the edition is still running', () => {
    const d = nextOccurrence(make(4, 24, 5, 1), new Date(2026, 4, 1, 9));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
  });
});

describe('upcomingFestivals', () => {
  it('sorts soonest first across the year boundary', () => {
    const list = [make(4, 17), make(12, 1), make(3, 19)];
    const out = upcomingFestivals(list, new Date(2026, 10, 1, 9));
    expect(out.map(f => f.month)).toEqual([12, 3, 4]);
    expect(out[0].starts.getFullYear()).toBe(2026);
    expect(out[1].starts.getFullYear()).toBe(2027);
  });

  it('carries start and end dates for the rendered edition', () => {
    const [row] = upcomingFestivals([make(4, 24, 5, 1)], new Date(2026, 10, 1, 9));
    expect(row.starts.getMonth()).toBe(3);
    expect(row.ends.getMonth()).toBe(4);
    expect(row.ends.getDate()).toBe(1);
  });
});

describe('thisMonthFestivals', () => {
  it('keeps only editions overlapping the current month', () => {
    const list = [make(12, 1, 12, 9), make(4, 17, 4, 24)];
    const out = thisMonthFestivals(list, new Date(2026, 11, 5, 9));
    expect(out).toHaveLength(1);
    expect(out[0].month).toBe(12);
  });

  it('includes a festival that started last month but runs into this one', () => {
    const list = [make(4, 24, 5, 1)];
    const out = thisMonthFestivals(list, new Date(2026, 4, 1, 9));
    expect(out).toHaveLength(1);
  });

  it('empty when nothing falls in the month', () => {
    expect(thisMonthFestivals([make(12, 1)], new Date(2026, 10, 1, 9))).toEqual([]);
  });
});

describe('monthOrNextFestivals', () => {
  it('returns the month list when the month has festivals', () => {
    const list = [make(12, 1, 12, 9), make(1, 5)];
    const out = monthOrNextFestivals(list, new Date(2026, 11, 5, 9));
    expect(out.fallback).toBe(false);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].month).toBe(12);
  });

  it('falls back to the single next festival when the month is empty', () => {
    const list = [make(1, 5), make(12, 1)];
    const out = monthOrNextFestivals(list, new Date(2026, 10, 1, 9));
    expect(out.fallback).toBe(true);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].month).toBe(12);
  });

  it('has nothing to fall back to when the list is empty', () => {
    const out = monthOrNextFestivals([], new Date(2026, 10, 1, 9));
    expect(out).toEqual({ fallback: false, rows: [] });
  });

  it('November in the real dataset falls back to Galicayo in December', () => {
    const out = monthOrNextFestivals(FESTIVALS, new Date(2026, 10, 1, 9));
    expect(out.fallback).toBe(true);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].id).toBe('galicayo-festival');
  });
});

describe('FESTIVALS dataset', () => {
  it('lists the 30 curated festivals with unique ids', () => {
    expect(FESTIVALS).toHaveLength(30);
    expect(new Set(FESTIVALS.map(f => f.id)).size).toBe(FESTIVALS.length);
  });

  it('every festival has a name, town, valid month and an end after its start', () => {
    for (const f of FESTIVALS) {
      expect(f.name).toBeTruthy();
      expect(f.town).toBeTruthy();
      expect(f.month).toBeGreaterThanOrEqual(1);
      expect(f.month).toBeLessThanOrEqual(12);
      const { starts, ends } = upcomingFestivals([f], new Date(2026, 0, 1))[0];
      expect(ends >= starts).toBe(true);
    }
  });

  it('every bundled photo path points at a real file in public/', async () => {
    const { existsSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const bundled = FESTIVALS.flatMap(f => f.photos || []).filter(u => u.startsWith('/'));
    expect(bundled.length).toBeGreaterThan(0);
    for (const u of bundled) {
      const file = fileURLToPath(new URL('../public' + u, import.meta.url));
      expect(existsSync(file), u).toBe(true);
    }
  });
});
