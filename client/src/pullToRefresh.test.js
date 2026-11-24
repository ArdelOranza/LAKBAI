import { describe, it, expect } from 'vitest';
import { pullResistance, shouldRefresh, REFRESH_PX } from './pullToRefresh.js';

describe('pullResistance', () => {
  it('eases the pull and never goes negative', () => {
    expect(pullResistance(0)).toBe(0);
    expect(pullResistance(-5)).toBe(0);
    expect(pullResistance(20)).toBe(10);
  });

  it('caps the pull so the screen never slides away', () => {
    expect(pullResistance(10000)).toBeLessThanOrEqual(120);
    expect(pullResistance(10000)).toBeGreaterThan(0);
  });
});

describe('shouldRefresh', () => {
  it('fires only past the threshold', () => {
    expect(shouldRefresh(REFRESH_PX - 1)).toBe(false);
    expect(shouldRefresh(REFRESH_PX)).toBe(true);
  });
});
