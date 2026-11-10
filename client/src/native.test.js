import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = rel => readFileSync(fileURLToPath(new URL('../' + rel, import.meta.url)), 'utf8');
const html = read('index.html');
const vite = read('vite.config.js');
const css = read('src/index.css');

describe('native install shell', () => {
  it('declares one viewport and keeps viewport-fit=cover for the notch', () => {
    const metas = html.match(/<meta name="viewport"[^>]*>/g) || [];
    expect(metas).toHaveLength(1);
    expect(metas[0]).toContain('viewport-fit=cover');
  });

  it('adds the iOS/Android standalone metas so it opens without browser chrome', () => {
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('mobile-web-app-capable');
    expect(html).toContain('apple-mobile-web-app-status-bar-style');
    expect(html).toContain('apple-mobile-web-app-title');
  });

  it('manifest opts into native launch behaviour and shortcuts', () => {
    expect(vite).toContain('launch_handler');
    expect(vite).toContain('handle_links');
    expect(vite).toContain('shortcuts');
    expect(vite).toContain("display: 'standalone'");
  });

  it('css removes web-only scroll, zoom and selection behaviour', () => {
    expect(css).toContain('overscroll-behavior:none');
    expect(css).toContain('touch-action:manipulation');
    expect(css).toContain('user-select:none');
    expect(css).toContain('--safe-top');
    expect(css).toContain('::-webkit-scrollbar');
  });
});