// The catalogue is longer than the viewport: 81 spots, 77 restaurants. The
// list box must scroll inside itself. `.list` declared overflow:auto and then
// overflow:hidden in the same rule, so the hidden won and every row past the
// first screenful was unreachable — the list looked "incomplete".
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

/** The declaration block for the first exact `.list{...}` rule. */
function block(selector){
  const at = css.indexOf(selector + '{');
  expect(at, selector + ' rule missing').toBeGreaterThan(-1);
  return css.slice(at + selector.length + 1, css.indexOf('}', at));
}

describe('admin catalogue list', () => {
  it('scrolls instead of clipping the rows past the fold', () => {
    const body = block('.list');
    expect(body).not.toMatch(/overflow\s*:\s*hidden/);
    expect(body).toMatch(/overflow(-y)?\s*:\s*auto/);
  });
});