import { it, expect } from 'vitest';
import { dateRange, shortDate, bannerDate } from './festival.js';
it('extracts "Oct 24 – Oct 25" style ranges', () => {
  expect(dateRange('Mangunguna Festival Oct 24 – Oct 25 in Poblacion')).toBe('OCT 24 – OCT 25');
});
it('extracts single dates', () => {
  expect(dateRange('Held every May 5')).toBe('MAY 5');
});
it('null when no date present', () => { expect(dateRange('no festival')).toBeNull(); });

it('shortDate pads a same-month range', () => {
  expect(shortDate(12, 1, 12, 9)).toBe('DEC 01 – DEC 09');
});
it('shortDate keeps a cross-month range', () => {
  expect(shortDate(1, 25, 2, 3)).toBe('JAN 25 – FEB 03');
});
it('shortDate collapses a single day', () => {
  expect(shortDate(12, 6, 12, 6)).toBe('DEC 06');
});
it('shortDate null without a month or day', () => {
  expect(shortDate(undefined, 6)).toBeNull();
  expect(shortDate(12, undefined)).toBeNull();
});
it('bannerDate reads the festival fields, not the prose label', () => {
  expect(bannerDate({ month: 12, day: 1, endMonth: 12, endDay: 9, dateLabel: 'December 1 - December 9 (extends into the 3rd week of December)' }))
    .toBe('DEC 01 – DEC 09');
  expect(bannerDate(null)).toBeNull();
});