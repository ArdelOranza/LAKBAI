// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

vi.mock('../AuthContext.jsx', () => ({
  useAuth: () => ({
    signUp: vi.fn(async () => ({})),
    signInWithPassword: vi.fn(async () => ({})),
    signInWithGoogle: vi.fn(async () => ({})),
    resetPassword: vi.fn(async () => ({})),
    resendConfirmation: vi.fn(async () => ({})),
    configured: true,
  }),
}));

import LogIn from './LogIn.jsx';
import SignUp from './SignUp.jsx';

const read = rel => readFileSync(fileURLToPath(new URL('../../' + rel, import.meta.url)), 'utf8');

async function mount(ui){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => { root.render(ui); });
  return {
    container,
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}

// The eye control belongs *inside* the textbox shell, not in a circle beside it.
function assertToggleInside(input, container){
  expect(input).not.toBeNull();
  const shell = input.closest('.field');
  expect(shell).not.toBeNull();
  expect(input.parentElement.className).toContain('field');
  const toggle = shell.querySelector('[aria-label="Toggle password"], [aria-label="Toggle confirm"]');
  expect(toggle).not.toBeNull();
  // No stray control in a sibling flex row next to the shell.
  expect(container.querySelectorAll('.field [aria-label^="Toggle"]').length).toBeGreaterThan(0);
}

describe('textbox icons live inside the field', () => {
  it('Log In puts the password eye inside the password box', async () => {
    const h = await mount(<LogIn onAuthed={() => {}} onSwitchToSignup={() => {}}/>);
    assertToggleInside(h.container.querySelector('[data-testid="login-password"]'), h.container);
    await h.unmount();
  });

  it('Sign Up puts each eye inside its own password box', async () => {
    const h = await mount(<SignUp onAuthed={() => {}} onSwitchToLogin={() => {}}/>);
    assertToggleInside(h.container.querySelector('[data-testid="signup-password"]'), h.container);
    assertToggleInside(h.container.querySelector('[data-testid="signup-confirm"]'), h.container);
    await h.unmount();
  });

  it('every auth textbox uses the same shell', async () => {
    const h = await mount(<LogIn onAuthed={() => {}} onSwitchToSignup={() => {}}/>);
    for (const id of ['login-email', 'login-password']) {
      expect(h.container.querySelector(`[data-testid="${id}"]`).closest('.field')).not.toBeNull();
    }
    await h.unmount();
  });
});

describe('focus is quiet', () => {
  it('no text field paints the blue brand colour on focus', () => {
    const css = read('src/index.css');
    const focusRules = css.split('}').filter(r => /input:focus|textarea:focus|select:focus/.test(r));
    expect(focusRules.length).toBeGreaterThan(0);
    for (const rule of focusRules) expect(rule).not.toContain('var(--primary)');
  });

  it('the field shell shows focus by darkening its own border', () => {
    expect(read('src/index.css')).toMatch(/\.field:focus-within\{[^}]*border-color:/);
  });

  it('the in-field icon has no button chrome of its own', () => {
    const rule = read('src/index.css').match(/\.field-btn\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule[1]).toContain('background:none');
    expect(rule[1]).toContain('border:none');
  });
});
