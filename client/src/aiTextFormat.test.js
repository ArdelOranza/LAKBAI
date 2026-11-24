// Chat answers are markdown-lite (paragraphs, **bold**, "-" bullets, ### heads).
// Tailwind's preflight removes list markers, which turned a fare table or a day
// plan into one undifferentiated block. These rules put the structure back.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');

describe('chat answer formatting', () => {
  it('keeps bullet and number markers inside an answer', () => {
    expect(css).toMatch(/\.ai-text ul\{[^}]*list-style:disc/);
    expect(css).toMatch(/\.ai-text ol\{[^}]*list-style:decimal/);
  });

  it('gives list items, paragraphs and headings breathing room', () => {
    expect(css).toMatch(/\.ai-text li\{[^}]*margin:/);
    expect(css).toMatch(/\.ai-text p\{[^}]*margin:/);
    expect(css).toMatch(/\.ai-text h3,[^{]*\{[^}]*margin:/);
  });

  it('does not let the first or last block double the bubble padding', () => {
    expect(css).toMatch(/\.ai-text p:first-child\{[^}]*margin-top:0/);
    expect(css).toMatch(/\.ai-text p:last-child\{[^}]*margin-bottom:0/);
  });
});
