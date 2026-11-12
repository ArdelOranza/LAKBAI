// @vitest-environment happy-dom
// The APK loads its bundle from https://localhost, so window.location is not a
// link anyone else can open. Anything we hand to another person must point at
// the public website instead.
import { describe, it, expect, beforeEach } from 'vitest';
import { shareUrl, PUBLIC_ORIGIN } from './siteLinks.js';

beforeEach(() => { delete window.Capacitor; });

describe('shareUrl', () => {
  it('shares the public site from inside the APK, never the WebView origin', () => {
    window.Capacitor = { isNativePlatform: () => true };
    const url = shareUrl();
    expect(url).toBe(PUBLIC_ORIGIN + '/');
    expect(url).not.toContain('localhost');
  });

  it('shares the current page on the website', () => {
    expect(shareUrl()).toBe(window.location.href);
  });
});
