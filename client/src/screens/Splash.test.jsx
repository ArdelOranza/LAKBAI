import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import Splash from './Splash.jsx';

describe('Splash', () => {
  const html = renderToString(<Splash onGetStarted={() => {}} onLogIn={() => {}} />);

  it('uses the Hundred Islands photo as the full-bleed backdrop', () => {
    expect(html).toContain('src="/intro-hundred-islands.jpg"');
    expect(html).toContain('Hundred Islands National Park');
    expect(html).toContain('class="intro-photo"');
  });

  it('offers Google and email sign-in paths', () => {
    expect(html).toContain('data-testid="google-signin"');
    expect(html).toContain('Continue with Google');
    expect(html).toContain('data-testid="get-started"');
    expect(html).toContain('Continue with email');
    expect(html).toContain('Log in');
  });

  it('draws the four-colour Google mark inline', () => {
    expect(html).toContain('#4285F4');
    expect(html).toContain('#EA4335');
    expect(html).toContain('#FBBC05');
    expect(html).toContain('#34A853');
  });

  it('has no leftover placeholder hero art', () => {
    expect(html).not.toContain('/hero.svg');
    expect(html).not.toContain('Get Started');
  });
});
