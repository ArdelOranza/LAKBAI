// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';

vi.mock('../AuthContext.jsx', () => ({
  useAuth: () => ({
    signUp: vi.fn(async () => ({})),
    signInWithGoogle: vi.fn(async () => ({})),
    configured: true,
  }),
}));

import SignUp from './SignUp.jsx';
import LogIn from './LogIn.jsx';

async function mount(ui){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => { root.render(ui); });
  return {
    container, root,
    async click(el){
      await React.act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    },
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}

describe('SignUp password reveal', () => {
  it('toggling shows the password instead of staying masked forever', async () => {
    const h = await mount(<SignUp onAuthed={() => {}} onSwitchToLogin={() => {}}/>);
    const pw = h.container.querySelector('[data-testid="signup-password"]');
    expect(pw.type).toBe('password');
    await h.click(h.container.querySelector('[aria-label="Toggle password"]'));
    expect(pw.type).toBe('text');          // the reveal must actually reveal
    expect(h.container.querySelector('[data-testid="signup-confirm"]').type).toBe('password'); // fields toggles are independent
    await h.unmount();
  });

  it('toggling twice re-masks the password', async () => {
    const h = await mount(<SignUp onAuthed={() => {}} onSwitchToLogin={() => {}}/>);
    const pw = h.container.querySelector('[data-testid="signup-password"]');
    await h.click(h.container.querySelector('[aria-label="Toggle password"]'));
    await h.click(h.container.querySelector('[aria-label="Toggle password"]'));
    expect(pw.type).toBe('password');
    await h.unmount();
  });
});

describe('auth switch controls', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('SignUp offers a real Log In button, not a dead anchor', async () => {
    const h = await mount(<SignUp onAuthed={() => {}} onSwitchToLogin={() => {}}/>);
    const html = renderToString(<SignUp onAuthed={() => {}} onSwitchToLogin={() => {}}/>);
    expect(html).not.toContain('href="#"');
    const btn = h.container.querySelector('[data-testid="switch-login"]');
    expect(btn).not.toBeNull();
    await h.unmount();
  });

  it('clicking the Log In switch hands over to Log In', async () => {
    const onSwitchToLogin = vi.fn();
    const h = await mount(<SignUp onAuthed={() => {}} onSwitchToLogin={onSwitchToLogin}/>);
    await h.click(h.container.querySelector('[data-testid="switch-login"]'));
    expect(onSwitchToLogin).toHaveBeenCalledTimes(1);
    await h.unmount();
  });

  it('LogIn offers a real Sign Up button, not a dead anchor', () => {
    const html = renderToString(<LogIn onAuthed={() => {}} onSwitchToSignup={() => {}}/>);
    expect(html).not.toContain('href="#"');
    expect(html).toContain('data-testid="switch-signup"');
  });

  it('clicking the Sign Up switch on Log In moves to signup', async () => {
    const onSwitch = vi.fn();
    const h = await mount(<LogIn onAuthed={() => {}} onSwitchToSignup={onSwitch}/>);
    await h.click(h.container.querySelector('[data-testid="switch-signup"]'));
    expect(onSwitch).toHaveBeenCalledTimes(1);
    await h.unmount();
  });
});
