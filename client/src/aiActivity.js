// Counts AI requests that are currently in flight. The shell renders one shared
// backdrop from this, so every AI screen lights it up without per-screen wiring.
let active = 0;
const listeners = new Set();

function emit(){
  const busy = active > 0;
  listeners.forEach(fn => { try { fn(busy); } catch { /* a bad listener must not break the request */ } });
}

export function aiBegin(){
  active += 1;
  emit();
}

export function aiEnd(){
  active = Math.max(0, active - 1);
  emit();
}

export function aiBusy(){
  return active > 0;
}

/** Subscribe to activity changes; the callback runs once with the current state. */
export function subscribeAiActivity(fn){
  listeners.add(fn);
  fn(active > 0);
  return () => { listeners.delete(fn); };
}