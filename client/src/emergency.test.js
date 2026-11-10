import { describe, it, expect } from 'vitest';
import { telHref, directionsHref, awayLabel } from './emergency.js';

describe('telHref', () => {
  it('keeps short national hotlines dialable', () => {
    expect(telHref('911')).toBe('tel:911');
    expect(telHref('143')).toBe('tel:143');
  });

  it('turns a local landline into a +63 number', () => {
    expect(telHref('(075) 542-6802')).toBe('tel:+63755426802');
  });

  it('leaves an already-international number alone', () => {
    expect(telHref('+63 2 8527 8481')).toBe('tel:+63285278481');
  });

  it('returns null when there is nothing to dial', () => {
    expect(telHref('')).toBeNull();
    expect(telHref(null)).toBeNull();
    expect(telHref('—')).toBeNull();
  });
});

describe('directionsHref', () => {
  it('links to the exact point in driving mode and starts navigation', () => {
    const href = directionsHref(16.03, 120.23);
    expect(href).toBe('https://www.google.com/maps/dir/?api=1&destination=16.03,120.23&travelmode=driving&dir_action=navigate');
  });

  it('returns null without coordinates', () => {
    expect(directionsHref(null, 120.23)).toBeNull();
    expect(directionsHref(16.03, undefined)).toBeNull();
  });
});

describe('awayLabel', () => {
  it('uses metres under a kilometre and one decimal above', () => {
    expect(awayLabel(0.42)).toBe('420 m away');
    expect(awayLabel(2.44)).toBe('2.4 km away');
  });

  it('is empty when distance is unknown', () => {
    expect(awayLabel(null)).toBe('');
    expect(awayLabel(undefined)).toBe('');
  });
});