import { describe, it, expect, vi, afterEach } from 'vitest';
import { aiBegin, aiEnd, aiBusy, subscribeAiActivity } from './aiActivity.js';
import { chat } from './api.js';

afterEach(() => {
  vi.unstubAllGlobals();
  while (aiBusy()) aiEnd(); // never leak a counter between tests
});

describe('aiActivity', () => {
  it('tells a new subscriber the current state right away', () => {
    const seen = [];
    const off = subscribeAiActivity(v => seen.push(v));
    expect(seen).toEqual([false]);
    off();
  });

  it('stays busy until every concurrent request finishes', () => {
    const seen = [];
    const off = subscribeAiActivity(v => seen.push(v));
    aiBegin();
    aiBegin();
    expect(aiBusy()).toBe(true);
    aiEnd();
    expect(aiBusy()).toBe(true);
    aiEnd();
    expect(aiBusy()).toBe(false);
    expect(seen).toEqual([false, true, true, true, false]);
    off();
  });

  it('never drops below zero', () => {
    aiEnd();
    aiEnd();
    expect(aiBusy()).toBe(false);
    aiBegin();
    expect(aiBusy()).toBe(true);
    aiEnd();
    expect(aiBusy()).toBe(false);
  });

  it('stops notifying once unsubscribed', () => {
    const seen = [];
    const off = subscribeAiActivity(v => seen.push(v));
    off();
    aiBegin();
    aiEnd();
    expect(seen).toEqual([false]);
  });

  it('wraps a real AI request in an activity window', async () => {
    const seen = [];
    const off = subscribeAiActivity(v => seen.push(v));
    let release;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(r => { release = r; })));

    const pending = chat('beaches near me');
    expect(seen[seen.length - 1]).toBe(true);

    release({ ok: true, json: async () => ({ answer: 'ok' }) });
    await pending;

    expect(seen[seen.length - 1]).toBe(false);
    off();
  });

  it('clears the activity window when the request fails', async () => {
    const seen = [];
    const off = subscribeAiActivity(v => seen.push(v));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, statusText: 'boom', json: async () => ({}) })));

    await expect(chat('beaches near me')).rejects.toThrow();
    expect(seen[seen.length - 1]).toBe(false);
    off();
  });
});