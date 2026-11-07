// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { mdInline, mdBlocks, MdText } from './mdText.jsx';

describe('mdInline', () => {
  it('turns **bold** spans into bold segments without losing any text', () => {
    const segs = mdInline('**Binmaley Beach** Located along the eastern coast.');
    expect(segs).toEqual([
      { t: 'bold', v: 'Binmaley Beach' },
      { t: 'plain', v: ' Located along the eastern coast.' },
    ]);
  });

  it('handles several bold spans and plain-only text', () => {
    expect(mdInline('a **b** c **d** e')).toEqual([
      { t: 'plain', v: 'a ' },
      { t: 'bold', v: 'b' },
      { t: 'plain', v: ' c ' },
      { t: 'bold', v: 'd' },
      { t: 'plain', v: ' e' },
    ]);
    expect(mdInline('no formatting here')).toEqual([{ t: 'plain', v: 'no formatting here' }]);
    expect(mdInline('')).toEqual([]);
    expect(mdInline(null)).toEqual([]);
  });

  it('ignores a lone unmatched ** instead of bolding the rest of the string', () => {
    const segs = mdInline('**unmatched bold here');
    expect(segs).toEqual([{ t: 'plain', v: '**unmatched bold here' }]);
  });
});

describe('mdBlocks', () => {
  it('splits paragraphs on blank lines', () => {
    const blocks = mdBlocks('para one\ncontinues\n\npara two');
    expect(blocks).toEqual([
      { type: 'p', segs: [{ t: 'plain', v: 'para one\ncontinues' }] },
      { type: 'p', segs: [{ t: 'plain', v: 'para two' }] },
    ]);
  });

  it('groups consecutive bullet lines into one list', () => {
    const blocks = mdBlocks('Intro\n- Binmaley Beach\n• San Fabian Beach\n- Toboan Beach');
    expect(blocks).toEqual([
      { type: 'p', segs: [{ t: 'plain', v: 'Intro' }] },
      { type: 'ul', items: [
        [{ t: 'plain', v: 'Binmaley Beach' }],
        [{ t: 'plain', v: 'San Fabian Beach' }],
        [{ t: 'plain', v: 'Toboan Beach' }],
      ]},
    ]);
  });

  it('keeps bold segments inside list items', () => {
    const blocks = mdBlocks('- **Bolo Beach** quiet, family-friendly');
    expect(blocks[0].type).toBe('ul');
    expect(blocks[0].items[0]).toEqual([
      { t: 'bold', v: 'Bolo Beach' },
      { t: 'plain', v: ' quiet, family-friendly' },
    ]);
  });
});

describe('MdText', () => {
  it('renders <strong> instead of literal ** stars', () => {
    const html = renderToString(<MdText text={'**Binmaley Beach & Baywalk** • 4.6 ★'} />);
    expect(html).toContain('<strong>Binmaley Beach &amp; Baywalk</strong>');
    expect(html).not.toContain('**');
  });

  it('renders lists as <ul><li> and paragraphs as <p>', () => {
    const html = renderToString(<MdText text={'Intro\n\n- one\n- two\n\nClosing para'} />);
    expect(html).toContain('<ul>');
    expect((html.match(/<li>/g) || []).length).toBe(2);
    expect((html.match(/<p>/g) || []).length).toBe(2);
  });
});
