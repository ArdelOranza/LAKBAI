import { describe, it, expect } from 'vitest';
import { dragOffset, shouldDismiss, DISMISS_PX } from './sheetDrag.js';

describe('sheetDrag', () => {
  it('follows the finger downwards', () => {
    expect(dragOffset(200, 260)).toBe(60);
  });

  it('never lets the sheet move above its resting place', () => {
    expect(dragOffset(200, 120)).toBe(0);
    expect(dragOffset(200, 200)).toBe(0);
  });

  it('dismisses only after a real downward pull', () => {
    expect(shouldDismiss(0)).toBe(false);
    expect(shouldDismiss(DISMISS_PX - 1)).toBe(false);
    expect(shouldDismiss(DISMISS_PX)).toBe(true);
    expect(shouldDismiss(DISMISS_PX + 40)).toBe(true);
  });
});