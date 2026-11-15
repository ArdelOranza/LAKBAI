// The chips above the composer are the fastest way into the assistant, so they
// have to follow the conversation: a fare answer should offer another fare
// question, not "plan a day here". Pure function, no React, so the rules stay
// testable.
import { describe, it, expect } from 'vitest';
import { suggestionsFor } from './chatSuggest.js';

const DAGUPAN = { lng: 120.3431, lat: 16.0433 };
const FAR_AWAY = { lng: 121.0, lat: 14.6 };

const labels = list => list.map(s => s.label);

describe('suggestionsFor', () => {
  it('offers the single best next question after a fare answer', () => {
    const list = suggestionsFor({ lastAi: { intent: 'commute', text: 'Ordinary is ₱467.50.' } });
    expect(labels(list)).toEqual(['Fare to another town']);
    expect(labels(list)).not.toContain('Plan a day here');
  });

  it('keeps the place follow-up after a place answer', () => {
    const list = suggestionsFor({ lastAi: { cards: [{ name: 'Patar White Sand Beach' }] } });
    expect(labels(list)).toEqual(['Plan a day here']);
    expect(list[0].send).toContain('Patar White Sand Beach');
  });

  it('knows which town the traveler is standing in', () => {
    const list = suggestionsFor({ coords: DAGUPAN });
    expect(labels(list)).toEqual(['Bus from Cubao to Dagupan']);
    expect(labels(list)).not.toContain('Beaches near me');
  });

  it('falls back to the one general prompt when the fix is outside Pangasinan', () => {
    const list = suggestionsFor({ coords: FAR_AWAY });
    expect(labels(list)).toEqual(['Beaches near me']);
  });

  it('does not name the fallback town when there is no GPS fix', () => {
    // The Lingayen-area fallback centre is not where the traveler is, so it must
    // not become a "Bus from Cubao to Lingayen" chip.
    const FALLBACK = { lng: 120.23, lat: 16.03 };
    const list = suggestionsFor({ coords: FALLBACK, hasFix: false });
    expect(labels(list)).not.toContain('Bus from Cubao to Lingayen');
    expect(labels(list)).toEqual(['Beaches near me']);
  });

  it('never repeats a chip and never returns more than one', () => {
    const list = suggestionsFor({
      lastAi: { intent: 'commute', cards: [{ name: 'Patar White Sand Beach' }] },
      coords: DAGUPAN,
    });
    expect(list.length).toBe(1);
    expect(new Set(labels(list)).size).toBe(list.length);
  });

  it('is safe with nothing at all', () => {
    const list = suggestionsFor();
    expect(list.length).toBeGreaterThan(0);
    list.forEach(s => {
      expect(typeof s.label).toBe('string');
      expect(typeof s.send).toBe('string');
      expect(s.send.length).toBeGreaterThan(0);
    });
  });
});
