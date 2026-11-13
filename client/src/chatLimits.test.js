import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_MESSAGE, clampMessage } from './chatLimits.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('clampMessage', () => {
  it('matches the server-side message limit', () => {
    // Pin to the server's own constant so the two can never drift apart.
    const src = fs.readFileSync(path.join(repoRoot, 'server/index.js'), 'utf8');
    const serverMax = Number(/const MESSAGE_MAX = (\d+);/.exec(src)?.[1]);
    expect(serverMax).toBeGreaterThan(0);
    expect(MAX_MESSAGE).toBe(serverMax);
  });

  it('trims and caps an over-long message', () => {
    const out = clampMessage('  ' + 'a'.repeat(700) + '  ');
    expect(out).toHaveLength(MAX_MESSAGE);
    expect(out).toBe('a'.repeat(MAX_MESSAGE));
  });

  it('leaves a normal message alone', () => {
    expect(clampMessage('  Beaches near me  ')).toBe('Beaches near me');
    expect(clampMessage(null)).toBe('');
  });
});
