/**
 * Mouse support for the horizontal card rows (home "Recommended for You").
 *
 * Touch swipes already scroll an overflow-x row, but a desktop browser has no
 * way to drag one: the row looked like a design-only strip. This adds a
 * click-safe drag plus wheel-to-horizontal mapping. Native touch scrolling is
 * left alone.
 */

const SLOP_PX = 4;

/**
 * Attach drag/wheel scrolling to `el`. Returns a cleanup function.
 * A drag that actually moved swallows the click that follows it, so releasing
 * over a card never opens the place the traveller was dragging.
 */
export function attachCarouselDrag(el){
  if (!el || typeof el.addEventListener !== 'function') return () => {};
  let down = false;
  let moved = false;
  let startX = 0;
  let startLeft = 0;
  let suppressClick = false;
  let clickTimer = 0;

  const onDown = e => {
    if (e.button != null && e.button !== 0) return;
    down = true;
    moved = false;
    startX = e.clientX;
    startLeft = el.scrollLeft;
    el.classList.add('dragging');
  };

  const onMove = e => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) <= SLOP_PX) return;
    moved = true;
    el.scrollLeft = startLeft - dx;
    if (e.cancelable && e.preventDefault) e.preventDefault();
  };

  const onUp = () => {
    if (!down) return;
    down = false;
    el.classList.remove('dragging');
    suppressClick = moved;
    moved = false;
    if (suppressClick){
      // A drag released outside the row produces no click; clear the guard so
      // the next real tap is not swallowed.
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => { suppressClick = false; }, 0);
    }
  };

  const onClick = e => {
    if (!suppressClick) return;
    suppressClick = false;
    clearTimeout(clickTimer);
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
  };

  const onWheel = e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const before = el.scrollLeft;
    el.scrollLeft = before + e.deltaY;
    if (el.scrollLeft !== before && e.cancelable && e.preventDefault) e.preventDefault();
  };

  el.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  el.addEventListener('click', onClick, true);
  el.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    clearTimeout(clickTimer);
    el.removeEventListener('mousedown', onDown);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    el.removeEventListener('click', onClick, true);
    el.removeEventListener('wheel', onWheel);
  };
}
