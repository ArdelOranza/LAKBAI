/** Finger travel, in px, that arms a refresh; releasing past this fires it. */
export const REFRESH_PX = 70;
/** The visual pull is capped so the screen never slides away. */
export const MAX_PULL_PX = 110;

/** Rubber-band resistance for the pull indicator: half the finger, capped. */
export function pullResistance(dy){
  if (!(dy > 0)) return 0;
  return Math.min(MAX_PULL_PX, dy * 0.5);
}

/** Did the traveller pull far enough to refresh? Measured on raw finger travel. */
export function shouldRefresh(dy){
  return dy >= REFRESH_PX;
}
