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
    expect(html).toContain('LakbAI');
    expect(html).toContain("Hi! I&#x27;m LakbAI");
    expect(html).toContain('data-testid="chat-input"');
  });

  it('caps the composer at the server message limit', () => {
    // The API answers 400 "Message too long." past 500 characters; the input
    // must not let the traveler get there in the first place.
    expect(html).toMatch(/maxlength="500"/i);
  });
});
