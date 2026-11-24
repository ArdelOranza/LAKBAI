import { useEffect, useRef, useState } from 'react';
import { pullResistance, shouldRefresh, MAX_PULL_PX } from './pullToRefresh.js';

/** Nearest scrollable ancestor of `node` (bounded by `root`), or null. */
function scrollableFrom(node, root){
  let el = node;
  while (el && el !== root){
    if (el.scrollHeight > el.clientHeight + 1){
      const oy = typeof getComputedStyle === 'function' ? getComputedStyle(el).overflowY : '';
      if (oy === 'auto' || oy === 'scroll') return el;
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * Pull-to-refresh for a screen: drag down from the top of the content to run
 * `onRefresh`, a short pull snaps back. `enabled={false}` renders the children
 * untouched — the Map screen opts out.
 */
export default function PullToRefresh({ onRefresh, enabled = true, children }){
  const wrapRef = useRef(null);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const scrollRef = useRef(null);
  const startY = useRef(0);
  const rawY = useRef(0);
  const armed = useRef(false);
  const busyRef = useRef(false);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !enabled) return undefined;
    const onStart = e => {
      if (busyRef.current || e.touches.length !== 1){ armed.current = false; return; }
      startY.current = e.touches[0].clientY;
      rawY.current = 0;
      const scroller = scrollableFrom(e.target, el);
      scrollRef.current = scroller;
      armed.current = !scroller || scroller.scrollTop <= 0;
    };
    const onMove = e => {
      if (!armed.current || busyRef.current) return;
      const dy = e.touches[0].clientY - startY.current;
      rawY.current = dy;
      const scroller = scrollRef.current;
      if (dy <= 0 || (scroller && scroller.scrollTop > 0)){ armed.current = false; setPull(0); return; }
      setPull(pullResistance(dy));
      if (e.cancelable && e.preventDefault) e.preventDefault();
    };
    const finish = () => {
      const dy = rawY.current;
      armed.current = false;
      rawY.current = 0;
      if (shouldRefresh(dy) && !busyRef.current){
        busyRef.current = true;
        setBusy(true);
        setPull(Math.min(MAX_PULL_PX, 56));
        Promise.resolve(refreshRef.current ? refreshRef.current() : undefined).finally(() => {
          busyRef.current = false;
          setBusy(false);
          setPull(0);
        });
      } else {
        setPull(0);
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', finish);
    el.addEventListener('touchcancel', finish);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', finish);
      el.removeEventListener('touchcancel', finish);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled){ setPull(0); setBusy(false); busyRef.current = false; }
  }, [enabled]);

  if (!enabled) return children;

  return (
    <div
      ref={wrapRef}
      className="ptr-wrap"
      data-testid="ptr-wrap"
      style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}
    >
      <div
        className={'ptr-bar' + (busy ? ' busy' : '')}
        style={{ height: pull }}
        role={busy ? 'status' : undefined}
        aria-label={busy ? 'Refreshing' : undefined}
        aria-hidden={busy ? undefined : true}
      >
        <span className="ptr-spin"/>
      </div>
      <div className="ptr-body" style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
        {children}
      </div>
    </div>
  );
}
