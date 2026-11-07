// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import Emergency from './Emergency.jsx';

describe('Emergency with missing coords', () => {
  it('renders the safety screen instead of crashing when coords is null', () => {
    const html = renderToString(<Emergency coords={null} pop={() => {}} showToast={() => {}} />);
    expect(html).toContain('emergency-page');
  });

  it('renders gracefully when coords is undefined', () => {
    const html = renderToString(<Emergency coords={undefined} pop={() => {}} showToast={() => {}} />);
    expect(html).toContain('emergency-page');
  });
});
