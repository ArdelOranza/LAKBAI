// @vitest-environment happy-dom
// The home "Recommended for You" row is a real carousel: on a desktop browser
// a mouse drag and a vertical wheel move it sideways, and the click that ends a
// drag must not open the card the traveller was dragging.
import { describe, it, expect, vi } from 'vitest';
import { attachCarouselDrag } from './carousel.js';

function mount(){
  const el = document.createElement('div');
  el.innerHTML = '<article id="card">card</article>';
  document.body.appendChild(el);
  el.scrollLeft = 0;
  const off = attachCarouselDrag(el);
  return { el, off };
}

describe('home carousel drag', () => {
  it('scrolls horizontally when the mouse is dragged', () => {
    const { el, off } = mount();
    el.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, clientX: 220, button: 0 }));
    window.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 120, button: 0 }));
    expect(el.scrollLeft).toBe(100);
    window.dispatchEvent(new window.MouseEvent('mouseup', { clientX: 120 }));
    expect(el.classList.contains('dragging')).toBe(false);
    off();
  });

  it('does not scroll before the drag passes the slop threshold', () => {
    const { el, off } = mount();
    el.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, clientX: 220, button: 0 }));
    window.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 218, button: 0 }));
    expect(el.scrollLeft).toBe(0);
    window.dispatchEvent(new window.MouseEvent('mouseup', { clientX: 218 }));
    off();
  });

  it('swallows the click after a drag so the card does not open', () => {
    const { el, off } = mount();
    const onClick = vi.fn();
    el.querySelector('#card').addEventListener('click', onClick);
    el.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, clientX: 220, button: 0 }));
    window.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 120, button: 0 }));
    window.dispatchEvent(new window.MouseEvent('mouseup', { clientX: 120 }));
    el.querySelector('#card').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(onClick).not.toHaveBeenCalled();
    // A later, real tap still works.
    el.querySelector('#card').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
    off();
  });

  it('maps a vertical wheel to sideways movement', () => {
    const { el, off } = mount();
    const wheel = new window.Event('wheel', { bubbles: true, cancelable: true });
    Object.defineProperty(wheel, 'deltaY', { value: 60 });
    Object.defineProperty(wheel, 'deltaX', { value: 0 });
    el.dispatchEvent(wheel);
    expect(el.scrollLeft).toBe(60);
    off();
  });

  it('detaches every listener on cleanup', () => {
    const { el, off } = mount();
    off();
    el.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, clientX: 220, button: 0 }));
    window.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 120 }));
    window.dispatchEvent(new window.MouseEvent('mouseup'));
    expect(el.scrollLeft).toBe(0);
  });
});
