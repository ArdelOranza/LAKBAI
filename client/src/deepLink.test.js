import { describe, it, expect } from 'vitest';
import { tabFromSearch } from './deepLink.js';

describe('tabFromSearch', () => {
  it('reads a valid tab from the query string (app shortcut targets)', () => {
    expect(tabFromSearch('?tab=map')).toBe('map');
    expect(tabFromSearch('?tab=chat')).toBe('chat');
    expect(tabFromSearch('?tab=saved')).toBe('saved');
    expect(tabFromSearch('?tab=home')).toBe('home');
  });

  it('ignores missing, empty or unknown tabs', () => {
    expect(tabFromSearch('')).toBeNull();
    expect(tabFromSearch('?tab=hack')).toBeNull();
    expect(tabFromSearch('?q=falls&page=2')).toBeNull();
  });
});