import { describe, it, expect } from 'vitest';
import { planStatus, matchesFilter } from './planStatus.js';
const NOW = new Date('2026-10-24T12:00:00Z');
describe('planStatus', () => {
  it('future → Upcoming, same day → Active, past → Completed, missing → null', () => {
    expect(planStatus('2026-11-02T00:00:00Z', NOW)).toBe('Upcoming');
    expect(planStatus('2026-10-24T00:00:00Z', NOW)).toBe('Active');
    expect(planStatus('2026-09-01T00:00:00Z', NOW)).toBe('Completed');
    expect(planStatus(null, NOW)).toBeNull();
  });
  it('null status only matches All', () => {
    expect(matchesFilter(null, 'all')).toBe(true);
    expect(matchesFilter(null, 'active')).toBe(false);
    expect(matchesFilter(null, 'past')).toBe(false);
  });
  it('Active goes to active, Completed goes to past', () => {
    expect(matchesFilter('Active', 'active')).toBe(true);
    expect(matchesFilter('Active', 'past')).toBe(false);
    expect(matchesFilter('Completed', 'past')).toBe(true);
    expect(matchesFilter('Upcoming', 'active')).toBe(false);
  });
});
