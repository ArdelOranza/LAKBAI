import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import ChatTab from './ChatTab.jsx';

const html = renderToString(
  <ChatTab user={null} coords={{ lng: 120.33, lat: 16.04 }} push={() => {}} setTab={() => {}} showToast={() => {}} />
);

describe('ChatTab', () => {
  it('keeps the chat background plain — no animated gradient wash', () => {
    expect(html).not.toContain('data-testid="ai-backdrop"');
  });

  it('keeps the header, welcome copy and composer', () => {
    expect(html).toContain('LakbAI Assistant');
    expect(html).toContain("Hi! I&#x27;m LakbAI");
    expect(html).toContain('data-testid="chat-input"');
  });
});
