/** Pull distance, in px, that closes the map spot sheet. */
export const DISMISS_PX = 90;

/** Downward drag offset, clamped so the sheet never slides up past its rest. */
export function dragOffset(startY, currentY){
  return Math.max(0, currentY - startY);
}

/** Should releasing at this offset dismiss the sheet? */
export function shouldDismiss(offset){
  return offset >= DISMISS_PX;
}