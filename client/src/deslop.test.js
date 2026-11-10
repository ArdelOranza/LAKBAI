import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = rel => readFileSync(fileURLToPath(new URL('../' + rel, import.meta.url)), 'utf8');

describe('de-slop guard', () => {
  it('the chat has no sparkle avatar or AI-brand label', () => {
    const chat = read('src/screens/ChatTab.jsx');
    expect(chat).not.toContain('Sparkles');
    expect(chat).not.toContain('LakbAI Guide');
    expect(chat).not.toContain('LakbAI Assistant');
  });

  it('the map spot sheet has no sparkle fallback', () => {
    expect(read('src/screens/SpotPopup.jsx')).not.toContain('Sparkles');
  });

  it('css keeps no shimmer animation or gradient tokens', () => {
    const css = read('src/index.css');
    expect(css).not.toContain('@keyframes shimmer');
    expect(css).not.toContain('--grad-a');
  });
});
