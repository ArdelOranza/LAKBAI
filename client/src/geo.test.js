import { describe, it, expect } from 'vitest';
import { haversineKm, driveMinutes, sunsetUTC, timeHint, formatDistance } from './geo.js';
describe('haversineKm', () => {
  it('computes a known short distance', () => {
    const km = haversineKm(120.0876, 16.1617, 120.2899, 16.0327); // Alaminos ≈ Dagupan
    expect(km).toBeGreaterThan(24);
    expect(km).toBeLessThan(27);
  });
  it('returns null on missing coordinates (no NaN reaches the UI)', () => {
    expect(haversineKm(120.2, 16.0, undefined, 16.1)).toBeNull();
  });
});
describe('driveMinutes', () => {
  it('40 km/h heuristic, minimum 1', () => {
    expect(driveMinutes(40)).toBe(60);
    expect(driveMinutes(0.1)).toBe(1);
    expect(driveMinutes(undefined)).toBeNull();
  });
});
describe('sunsetUTC', () => {
  it('Patar 2026-10-29 sunset ≈ 9:5x-10:0x UTC (≈6:0x PM PHT), within ±30 min', () => {
    const m = sunsetUTC(120.23, 16.03, new Date('2026-10-29T00:00:00Z'));
    expect(m).toBeGreaterThan(570);
    expect(m).toBeLessThan(630);
  });
});
describe('formatDistance', () => {
  it('meters under 1 km, km above, empty for null', () => {
    expect(formatDistance(null)).toBe('');
    expect(formatDistance(0.24)).toBe('240 m');
    expect(formatDistance(2.4)).toBe('2.4 km');
  });
});
describe('timeHint', () => {
  it('beaches get sunset hint, dining gets dinner window, others empty', () => {
    expect(timeHint('Beach / Coastal', '5:46 PM')).toBe('Optimal sunset: 5:46 PM');
    expect(timeHint('Restaurant', '')).toBe('Ideal dinner: 6:30 PM');
    expect(timeHint('Park', '')).toBe('');
  });
});
