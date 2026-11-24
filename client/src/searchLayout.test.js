// Long search cards must stay inside the 430 px app frame. A grid track sized
// from the card's min-content let the row grow to 984 px on a desktop browser,
// so the name, address and chevron were clipped off-screen.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
const rule = name => {
  const m = css.match(new RegExp(`\\.${name}\\{([^}]*)\\}`));
  if (!m) throw new Error('missing CSS rule .' + name);
  return m[1];
};

describe('search result card width', () => {
  it('gives the result grid a shrinkable column instead of a min-content track', () => {
    expect(rule('result-list')).toMatch(/grid-template-columns:minmax\(0,1fr\)/);
  });

  it('lets the card itself shrink inside that column', () => {
    expect(rule('result-card')).toMatch(/min-width:0/);
  });
});
