// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeExternalUrl, openExternal } from './extLinks.js';

describe('safeExternalUrl', () => {
  it('allows plain http(s) URLs through unchanged', () => {
    expect(safeExternalUrl('https://example.com/doc')).toBe('https://example.com/doc');
    expect(safeExternalUrl('http://example.com/doc')).toBe('http://example.com/doc');
    expect(safeExternalUrl('HTTPS://EXAMPLE.COM')).toBe('HTTPS://EXAMPLE.COM');
  });

  it('rejects javascript: URLs (XSS sink)', () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl('JaVaScRiPt:alert(1)')).toBeNull();
  });

  it('rejects every other scheme and junk', () => {
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeExternalUrl('file:///etc/passwd')).toBeNull();
    expect(safeExternalUrl('//cdn.evil/x')).toBeNull();
    expect(safeExternalUrl('')).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });
});

describe('openExternal', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn(() => ({})));
  });

  it('opens http(s) URLs in a new tab without leaking window.opener', () => {
    const ok = openExternal('https://example.com/doc');
    expect(ok).toBe(true);
    expect(window.open).toHaveBeenCalledWith('https://example.com/doc', '_blank', 'noopener,noreferrer');
  });

  it('never opens a non-http(s) URL', () => {
    expect(openExternal("javascript:alert(1)")).toBe(false);
    expect(window.open).not.toHaveBeenCalled();
  });
});
