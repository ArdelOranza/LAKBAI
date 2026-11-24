import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import AiStatusDot from './AiStatusDot.jsx';

describe('AiStatusDot', () => {
  it('is green (no modifier class) when online and working', () => {
    const html = renderToString(<AiStatusDot online aiDown={false} />);
    expect(html).toContain('class="online-dot"');
    expect(html).not.toContain(' down');
    expect(html).not.toContain(' off');
  });

  it('is red when the AI is down', () => {
    const html = renderToString(<AiStatusDot online aiDown />);
    expect(html).toContain('online-dot down');
    expect(html).toContain('unavailable');
  });

  it('is gray when offline', () => {
    const html = renderToString(<AiStatusDot online={false} />);
    expect(html).toContain('online-dot off');
    expect(html).toContain('Offline');
  });
});
