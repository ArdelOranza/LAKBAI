// The pin name is a Google-Maps-style map label: text beside the pin with a
// white halo, never a white pill floating under it. The name sits to the left
// of the marker by default and flips right only when that would run off-screen.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
const rule = name => {
  const m = css.match(new RegExp(`\\.${name}\\{([^}]*)\\}`));
  if (!m) throw new Error('missing CSS rule .' + name);
  return m[1];
};

describe('map pin names', () => {
  it('anchors the name to the left of the pin, without a pill', () => {
    const label = rule('pin-name');
    expect(label).toMatch(/right:calc\(100% \+ 5px\)/);
    expect(label).toMatch(/left:auto/);
    expect(label).toMatch(/text-align:right/);
    expect(label).not.toMatch(/background:rgba\(255,255,255/);
    expect(label).not.toMatch(/border-radius:999px/);
    expect(label).not.toMatch(/box-shadow:(?!none)/);
  });

  it('uses a white text halo like a map label', () => {
    expect(rule('pin-name')).toMatch(/text-shadow:[^;]*#fff/);
  });

  it('uses Google Maps label sizing, not a tiny pill caption', () => {
    expect(rule('pin-name')).toMatch(/font-size:13px/);
    expect(rule('pin-name')).toMatch(/font-weight:500/);
    expect(css).toMatch(/\.spot-pin\.bubble \.pin-name\{[^}]*font-size:13px/);
  });

  it('flips to the right of the pin when the left edge would clip it', () => {
    expect(css).toMatch(/\.spot-pin\.label-right \.pin-name\{[^}]*left:calc\(100% \+ 5px\)[^}]*text-align:left/);
  });

  it('keeps names mounted at every zoom so they are readable without hover', () => {
    expect(rule('pin-name')).toMatch(/opacity:1/);
  });
});
