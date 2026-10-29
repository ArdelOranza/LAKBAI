import { it, expect } from 'vitest';
import { dateRange } from './festival.js';
it('extracts "Oct 24 – Oct 25" style ranges', () => {
  expect(dateRange('Mangunguna Festival Oct 24 – Oct 25 in Poblacion')).toBe('OCT 24 – OCT 25');
});
it('extracts single dates', () => {
  expect(dateRange('Held every May 5')).toBe('MAY 5');
});
it('null when no date present', () => { expect(dateRange('no festival')).toBeNull(); });
