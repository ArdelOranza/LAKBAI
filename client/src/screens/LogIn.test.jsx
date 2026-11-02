import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import LogIn from './LogIn.jsx';

describe('LogIn', () => {
  it('shows the "confirm your email" notice handed over from Sign Up', () => {
    const html = renderToString(<LogIn onAuthed={() => {}} onSwitchToSignup={() => {}} notice="Check your email to confirm your account, then log in." />);
    expect(html).toContain('data-testid="login-notice"');
    expect(html).toContain('Check your email to confirm your account');
  });

  it('has no notice when arriving straight from the intro', () => {
    const html = renderToString(<LogIn onAuthed={() => {}} onSwitchToSignup={() => {}} />);
    expect(html).not.toContain('data-testid="login-notice"');
    expect(html).toContain('data-testid="login-email"');
    expect(html).toContain('data-testid="login-send"');
  });
});
