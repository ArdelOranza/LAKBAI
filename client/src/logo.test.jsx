import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import Logo from './logo.jsx';

describe('Logo component', () => {
  it('renders SVG icon by default', () => {
    const html = renderToString(<Logo />);
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 0 45 48"');
    expect(html).toContain('width="40"');
    expect(html).toContain('id="lg_b"');
    expect(html).toContain('id="lg_t"');
    expect(html).not.toContain('Lakbai, smarter, not harder.');
  });

  it('respects custom size prop', () => {
    const html = renderToString(<Logo size={64} />);
    expect(html).toContain('width="64"');
    expect(html).toContain('height="68"');
  });

  it('renders wordmark when withWordmark is true', () => {
    const html = renderToString(<Logo size={50} withWordmark={true} />);
    expect(html).toContain('LakbAI');
    expect(html).toContain('Lakbai, smarter, not harder.');
    expect(html).toContain('id="lgw_b"');
    expect(html).toContain('id="lgw_t"');
  });
});

