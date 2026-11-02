import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import Splash from './Splash.jsx';

describe('Splash', () => {
  const html = renderToString(<Splash onGetStarted={() => {}} onLogIn={() => {}} />);

  it('uses the Hundred Islands photo as the full-bleed backdrop', () => {
    expect(html).toContain('src="/intro-hundred-islands.jpg"');
    expect(html).toContain('Hundred Islands, Alaminos, Pangasinan');
  });

  it('keeps the original onboarding layout', () => {
    expect(html).toContain('data-testid="get-started"');
    expect(html).toContain('Get Started');
    expect(html).toContain('Log In');
    expect(html).toContain('Lakbai, smarter, not harder.');
  });

  it('uses the supplied wordmark image as the text logo', () => {
    expect(html).toContain('src="/lakbai-wordmark.png"');
    expect(html).toContain('alt="LakbAI"');
    expect(html).not.toContain('>LakbAI<');
  });

  it('adds the Google sign-in option above the existing buttons', () => {
    expect(html).toContain('data-testid="google-signin"');
    expect(html).toContain('Continue with Google');
    expect(html.indexOf('Continue with Google')).toBeLessThan(html.indexOf('Get Started'));
  });

  it('draws the four-colour Google mark inline', () => {
    expect(html).toContain('#4285F4');
    expect(html).toContain('#EA4335');
    expect(html).toContain('#FBBC05');
    expect(html).toContain('#34A853');
  });

  it('has no leftover placeholder hero art', () => {
    expect(html).not.toContain('/hero.svg');
  });
});
