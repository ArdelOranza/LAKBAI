// @vitest-environment happy-dom
// The AI avatar is the LakbAI mark, not a generic compass icon.
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import AiAvatar from './aiAvatar.jsx';

describe('AiAvatar', () => {
  it('renders the LakbAI logo mark', () => {
    const html = renderToString(<AiAvatar/>);
    expect(html).toContain('ai-avatar');
    expect(html).toContain('viewBox="0 0 45 48"');
    expect(html).not.toContain('lucide-compass');
  });
});