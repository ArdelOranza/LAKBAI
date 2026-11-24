import { describe, it, expect } from 'vitest';
import { dotState, checkAiStatus } from './aiStatus.js';

describe('dotState', () => {
  it('is gray whenever the browser is offline, regardless of the AI', () => {
    expect(dotState({ online: false, aiDown: false })).toBe('off');
    expect(dotState({ online: false, aiDown: true })).toBe('off');
  });

  it('is red when online but the AI is not working', () => {
    expect(dotState({ online: true, aiDown: true })).toBe('down');
  });

  it('is green when online and the AI works', () => {
    expect(dotState({ online: true, aiDown: false })).toBe('ok');
  });
});

describe('checkAiStatus', () => {
  it('is true only when reachable, AI on and configured', async () => {
    const ok = async () => ({ ok: true, json: async () => ({ ai: true, configured: true }) });
    expect(await checkAiStatus(ok)).toBe(true);
  });

  it('is false when the breaker is armed', async () => {
    const down = async () => ({ ok: true, json: async () => ({ ai: false, configured: true }) });
    expect(await checkAiStatus(down)).toBe(false);
  });

  it('is false when no provider key is configured', async () => {
    const noKey = async () => ({ ok: true, json: async () => ({ ai: true, configured: false }) });
    expect(await checkAiStatus(noKey)).toBe(false);
  });

  it('is false when the API cannot be reached', async () => {
    const boom = async () => { throw new Error('offline'); };
    expect(await checkAiStatus(boom)).toBe(false);
  });

  it('is false on a non-2xx response', async () => {
    const bad = async () => ({ ok: false, status: 503 });
    expect(await checkAiStatus(bad)).toBe(false);
  });
});
