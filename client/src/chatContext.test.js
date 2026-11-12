// @vitest-environment happy-dom
// What the chat AI knows about the person: where they are (coords travel with
// every request), what they like, how to address them, and what time it is for
// them. Built from what the app already stores — no extra form.
import { describe, it, expect } from 'vitest';
import { buildChatContext } from './chatContext.js';

const NOW = new Date('2026-11-12T06:05:00Z'); // 14:05 in Manila

describe('buildChatContext', () => {
  it('describes the traveler with a first name, interests and local time', () => {
    const line = buildChatContext({
      user: { id: 'u1', email: 'ana@example.com', user_metadata: { full_name: 'Ana Reyes' } },
      prefs: ['Beaches', 'Food & Dining'],
      now: NOW,
      tz: 'Asia/Manila',
    });

    expect(line).toContain('Ana');
    expect(line).toContain('Interests: Beaches, Food & Dining');
    expect(line).toContain('Thu 14:05');
    expect(line).toContain('Asia/Manila');
  });

  it('never leaks the email, the account id or a surname', () => {
    const line = buildChatContext({
      user: { id: 'u1', email: 'ana@example.com', user_metadata: { full_name: 'Ana Reyes' } },
      prefs: [],
      now: NOW,
      tz: 'Asia/Manila',
    });

    expect(line).not.toContain('ana@example.com');
    expect(line).not.toContain('u1');
    expect(line).not.toContain('Reyes');
  });

  it('does not invent a name from the email when none is set', () => {
    const line = buildChatContext({
      user: { id: 'u2', email: 'ana@example.com' },
      prefs: [],
      now: NOW,
      tz: 'Asia/Manila',
    });

    expect(line).not.toContain('ana');
    expect(line).toContain('Thu 14:05');
  });

  it('works signed out: time only, no empty labels', () => {
    const line = buildChatContext({ user: null, prefs: [], now: NOW, tz: 'Asia/Manila' });

    expect(line).toContain('Thu 14:05');
    expect(line.toLowerCase()).not.toContain('interests');
    expect(line).not.toContain('undefined');
  });

  it('caps interests at six and removes duplicates', () => {
    const line = buildChatContext({
      user: { user_metadata: { full_name: 'Ben Cruz' } },
      prefs: ['Beaches', 'Beaches', 'Food & Dining', 'History', 'Nature', 'Nightlife', 'Museums', 'Hiking & Camping'],
      now: NOW,
      tz: 'Asia/Manila',
    });

    const interests = line.match(/Interests: ([^.]+)/)[1].split(', ');
    expect(interests).toHaveLength(6);
    expect(new Set(interests).size).toBe(6);
  });
});
