// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import PullToRefresh from './PullToRefresh.jsx';

// happy-dom lacks a real TouchEvent; a plain Event with `touches` is enough for
// the handler, which only reads touches[0].clientY.
function touch(type, y){
  const e = new window.Event(type, { bubbles: true, cancelable: true });
  e.touches = (type === 'touchend' || type === 'touchcancel') ? [] : [{ clientY: y }];
  e.changedTouches = [{ clientY: y }];
  return e;
}

async function mount(props){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => {
    root.render(<PullToRefresh {...props}><div className="content">hi</div></PullToRefresh>);
  });
  return {
    container, root,
    async gesture(from, to){
      const el = container.firstChild;
      await React.act(async () => {
        el.dispatchEvent(touch('touchstart', from));
        el.dispatchEvent(touch('touchmove', to));
        el.dispatchEvent(touch('touchend', to));
      });
    },
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}

describe('PullToRefresh', () => {
  it('refreshes after a pull past the threshold', async () => {
    const onRefresh = vi.fn(async () => {});
    const h = await mount({ onRefresh });
    await h.gesture(0, 120);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    await h.unmount();
  });

  it('does nothing for a short pull', async () => {
    const onRefresh = vi.fn(async () => {});
    const h = await mount({ onRefresh });
    await h.gesture(0, 20);
    expect(onRefresh).not.toHaveBeenCalled();
    await h.unmount();
  });

  it('is inert when disabled — the screen opts out of the gesture', async () => {
    const onRefresh = vi.fn(async () => {});
    const h = await mount({ onRefresh, enabled: false });
    expect(h.container.querySelector('.ptr-wrap')).toBeNull();
    expect(h.container.textContent).toContain('hi');
    await h.unmount();
  });
});
