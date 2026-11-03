import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import LogIn from './LogIn.jsx';

describe('LogIn', () => {
  it('shows the "confirm your email" notice handed over from Sign Up', () => {
    const html = renderToString(<LogIn onAuthed={() => {}} onSwitchToSignup={() => {}} notice="Check your email to confirm your account, then log in." />);
    expect(html).toContain('data-testid="login-notice"');
    expect(html).toContain('Check your email to confirm your account');
    expect(html).toContain('data-testid="resend-confirm"');
  });

  it('pre-fills the email handed over from Sign Up so Resend works', () => {
    const html = renderToString(<LogIn onAuthed={() => {}} onSwitchToSignup={() => {}} notice="Confirm it." defaultEmail="traveler@example.com" />);
    expect(html).toContain('traveler@example.com');
  });

  it('has no notice when arriving straight from the intro', () => {
    const html = renderToString(<LogIn onAuthed={() => {}} onSwitchToSignup={() => {}} />);
    expect(html).not.toContain('data-testid="login-notice"');
    expect(html).toContain('data-testid="login-email"');
    expect(html).toContain('data-testid="login-send"');
  });
});
