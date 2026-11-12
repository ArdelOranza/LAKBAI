// The dot must report where the traveler is now. These tests pin the two ways
// a naive filter lies: averaging the whole history (lag) and accepting a
// teleport from a vague reading (a 100 m jump onto the wrong road).
import { describe, it, expect } from 'vitest';
import { nextFix } from './geo.js';

const DAGUPAN = { lng: 120.34, lat: 16.043, accuracy: 10, at: 0 };

describe('nextFix', () => {
  it('takes the first fix exactly', () => {
    const fix = nextFix(null, { lng: 120.34, lat: 16.043, accuracy: 12 });
    expect(fix.lng).toBe(120.34);
    expect(fix.lat).toBe(16.043);
    expect(fix.accuracy).toBe(12);
  });

  it('rejects a fix too vague to place the traveler', () => {
    expect(nextFix(DAGUPAN, { lng: 120.35, lat: 16.05, accuracy: 420 }, 5000)).toBe(DAGUPAN);
    expect(nextFix(null, { lng: 120.35, lat: 16.05, accuracy: 420 })).toBeNull();
  });

  it('follows a precise fix without snapping to every jitter', () => {
    const fix = nextFix(DAGUPAN, { lng: 120.341, lat: 16.043, accuracy: 10 }, 5000);
    expect(fix.lng).toBeGreaterThan(120.34);
    expect(fix.lng).toBeLessThan(120.341);
    expect(fix.lng).toBeCloseTo(120.3408, 4);
  });

  it('refuses a teleport from an imprecise reading', () => {
    const fix = nextFix(DAGUPAN, { lng: 121.5, lat: 17.5, accuracy: 250 }, 1000);
    expect(fix.lng).toBe(120.34);
    expect(fix.lat).toBe(16.043);
  });

  it('accepts a precise reading even when it lands far away', () => {
    const fix = nextFix(DAGUPAN, { lng: 121.5, lat: 17.5, accuracy: 8 }, 60000);
    expect(fix.lng).toBeGreaterThan(120.9);
  });

  it('reports the accuracy of this reading, not the best ever', () => {
    const fix = nextFix(
      { lng: 120.34, lat: 16.043, accuracy: 5, at: 0 },
      { lng: 120.3405, lat: 16.0435, accuracy: 40 },
      3000,
    );
    expect(fix.accuracy).toBe(40);
  });

  it('keeps the last known fix when the reading is unusable', () => {
    expect(nextFix(DAGUPAN, { lng: null, lat: 16.05, accuracy: 10 })).toBe(DAGUPAN);
    expect(nextFix(DAGUPAN, null)).toBe(DAGUPAN);
  });
});
