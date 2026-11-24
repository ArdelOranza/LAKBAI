// The chips above the composer are the fastest way into the assistant, so they
// follow the conversation. Fares are answered when typed but never suggested:
// the chip row must not advertise what the greeting no longer mentions.
import { describe, it, expect } from 'vitest';
import { suggestionsFor } from './chatSuggest.js';

const labels = list => list.map(s => s.label);

describe('suggestionsFor', () => {
  it('offers a place follow-up only after a place answer', () => {
    const list = suggestionsFor({ lastAi: { cards: [{ name: 'Patar White Sand Beach' }] } });
    expect(labels(list)).toEqual(['Plan a day here']);
    expect(list[0].send).toContain('Patar White Sand Beach');
  });

  it('never suggests a fare question, even after a fare answer', () => {
    const list = suggestionsFor({ lastAi: { intent: 'commute', text: 'Ordinary is ₱467.50.' } });
    expect(labels(list)).toEqual(['Beaches near me']);
    expect(list.some(s => /fare|bus/i.test(s.label) || /fare|bus/i.test(s.send))).toBe(false);
  });

  it('falls back to the one general prompt', () => {
    expect(labels(suggestionsFor())).toEqual(['Beaches near me']);
    expect(labels(suggestionsFor({ lastAi: { cards: [] } }))).toEqual(['Beaches near me']);
  });

  it('never returns more than one chip', () => {
    const list = suggestionsFor({ lastAi: { intent: 'commute', cards: [{ name: 'Patar White Sand Beach' }] } });
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
