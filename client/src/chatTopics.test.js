// Topic tabs above the composer: five fixed intents whose *question* follows the
// conversation (the place you just looked at, or the town you're standing in).
// Pure, so the wording and the active tab are testable without rendering.
import { describe, it, expect } from 'vitest';
import { topicTabs, TOPICS } from './chatTopics.js';

const DAGUPAN = { lng: 120.3431, lat: 16.0433 };
const SEND = list => list.map(t => t.send);

describe('topicTabs', () => {
  it('always offers the five topics in a stable order', () => {
    const tabs = topicTabs();
    expect(tabs.map(t => t.id)).toEqual(['places', 'food', 'events', 'commute', 'plan']);
    expect(TOPICS.map(t => t.label)).toEqual(['Places', 'Food', 'Events', 'Commute', 'Plan']);
    tabs.forEach(t => expect(t.send.length).toBeGreaterThan(0));
  });

  it('aims every question at the place the traveler just asked about', () => {
    const tabs = topicTabs({ lastAi: { intent: 'discover', cards: [{ name: 'Patar White Sand Beach' }] } });
    expect(SEND(tabs)).toContain('Show me places like Patar White Sand Beach');
    expect(SEND(tabs)).toContain('Where should I eat near Patar White Sand Beach?');
    expect(SEND(tabs)).toContain('Plan a day trip to Patar White Sand Beach');
  });

  it('uses the town the fix is in when there is no place yet', () => {
    const tabs = topicTabs({ coords: DAGUPAN });
    expect(SEND(tabs)).toContain('How much is the bus fare from Cubao to Dagupan?');
    expect(SEND(tabs)).toContain('Where should I eat in Dagupan?');
  });

  it('stays province-wide when it knows neither place nor town', () => {
    const tabs = topicTabs();
    expect(SEND(tabs)).toContain('Where should I eat in Pangasinan?');
    expect(SEND(tabs)).toContain('How much is the bus fare to Dagupan?');
    expect(SEND(tabs)).toContain('Plan a day trip in Pangasinan');
  });

  it('never names the fallback town when there is no GPS fix', () => {
    // The app keeps a Lingayen-area fallback centre before GPS arrives; with no
    // fix that point is not where the traveler is, so the chips must stay
    // province-wide instead of claiming "in Lingayen".
    const FALLBACK = { lng: 120.23, lat: 16.03 };
    const tabs = topicTabs({ coords: FALLBACK, hasFix: false });
    expect(SEND(tabs)).toContain('Where should I eat in Pangasinan?');
    expect(SEND(tabs)).toContain('How much is the bus fare to Dagupan?');
    expect(SEND(tabs).some(q => /Lingayen/.test(q))).toBe(false);
  });

  it('marks the tab the last answer came from', () => {
    const active = intent => topicTabs({ lastAi: { intent } }).find(t => t.active)?.id ?? null;
    expect(active('food')).toBe('food');
    expect(active('event')).toBe('events');
    expect(active('commute')).toBe('commute');
    expect(active('plan')).toBe('plan');
    expect(active('discover')).toBe('places');
    expect(active('nearby')).toBe('places');
    expect(active(undefined)).toBe(null);
  });
});
