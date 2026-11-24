import { describe, it, expect } from 'vitest';
import { popupBlurb } from './popupBlurb.js';

describe('popupBlurb', () => {
  it('keeps a curated blurb that already fits', () => {
    expect(popupBlurb({ name: 'Patar Beach', town: 'Bolinao', blurb: 'White sand and a long shallow shelf.' }))
      .toBe('White sand and a long shallow shelf.');
  });

  it('cuts a long dataset description at its first sentence', () => {
    const text = 'Founded in 1928, the restaurant has served heirloom recipes for nearly a century. Its seafood is the reason people queue from all over Pangasinan, and the queue starts before noon on weekends.';
    expect(popupBlurb({ name: 'Dagupeña', town: 'Dagupan City', description: text }))
      .toBe('Founded in 1928, the restaurant has served heirloom recipes for nearly a century.');
  });

  it('ellipsizes a first sentence that is still too long for a sheet', () => {
    const text = 'A very long single sentence that never ends because the writer kept adding clause after clause about the many things this place offers to every visitor who walks through the door of the old house by the road';
    const out = popupBlurb({ name: 'Long', town: 'Dagupan City', description: text });
    expect(out.length).toBeLessThanOrEqual(161);
    expect(out.endsWith('…')).toBe(true);
    expect(text.startsWith(out.slice(0, -1).trimEnd())).toBe(true);
  });

  it('never invents a blurb: a place with no copy says only where it is', () => {
    expect(popupBlurb({ name: 'Kuya J', town: 'Urdaneta City' }))
      .toBe('Kuya J is in Urdaneta City — save it and let LakbAI sequence your day around it.');
  });

  it('survives an empty place', () => {
    expect(popupBlurb(null)).toContain('Pangasinan');
  });
});