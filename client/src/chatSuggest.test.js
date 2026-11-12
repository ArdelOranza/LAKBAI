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
  it('offers more fare questions right after a fare answer', () => {
    const list = suggestionsFor({ lastAi: { intent: 'commute', text: 'Ordinary is ₱467.50.' } });
    expect(labels(list)).toContain('Fare to another town');
    expect(labels(list)).toContain('Closest terminal');
    expect(labels(list)).not.toContain('Plan a day here');
  });

  it('keeps the place follow-ups after a place answer', () => {
    const list = suggestionsFor({ lastAi: { cards: [{ name: 'Patar White Sand Beach' }] } });
    expect(labels(list)).toContain('Plan a day here');
    expect(labels(list)).toContain('More like this');
    expect(list.find(s => s.label === 'Plan a day here').send).toContain('Patar White Sand Beach');
  });

  it('knows which town the traveler is standing in', () => {
    const list = suggestionsFor({ coords: DAGUPAN });
    expect(labels(list)).toContain('Bus from Cubao to Dagupan');
    expect(labels(list)).not.toContain('Beaches near me');
  });

  it('falls back to general prompts when the fix is outside Pangasinan', () => {
    const list = suggestionsFor({ coords: FAR_AWAY });
    expect(labels(list)).toContain('Beaches near me');
    expect(labels(list)).toContain('Festivals this month');
  });

  it('never repeats a chip and never returns more than four', () => {
    const list = suggestionsFor({
      lastAi: { intent: 'commute', cards: [{ name: 'Patar White Sand Beach' }] },
      coords: DAGUPAN,
    });
    expect(list.length).toBeLessThanOrEqual(4);
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
