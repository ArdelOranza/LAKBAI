// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { TAGS, toggleTag, readLocalPrefs, writeLocalPrefs, savePrefs } from './prefs.js';
beforeEach(() => { localStorage.clear(); });
describe('prefs', () => {
  it('TAGS covers the mockup tag grid', () => {
    ['Beaches','Food & Dining','History','Nature','Cafés','Hidden Gems'].forEach(t => expect(TAGS).toContain(t));
  });
  it('toggleTag adds then removes', () => {
    let t = toggleTag([], 'Beaches');
    expect(t).toEqual(['Beaches']);
    t = toggleTag(t, 'Nature');
    expect(t).toEqual(['Beaches', 'Nature']);
    t = toggleTag(t, 'Beaches');
    expect(t).toEqual(['Nature']);
    t = toggleTag(t, 'Nature');
    expect(t).toEqual([]);
  });
  it('readLocalPrefs / writeLocalPrefs round-trip', () => {
    writeLocalPrefs(['Nature', 'Cafés']);
    expect(readLocalPrefs()).toEqual(['Nature', 'Cafés']);
    expect(readLocalPrefs()).toEqual(['Nature', 'Cafés']);
  });
  it('savePrefs without supabase still mirrors locally', async () => {
    const tags = ['Hidden Gems'];
    await savePrefs(null, tags);
    expect(readLocalPrefs()).toEqual(tags);
  });
});
