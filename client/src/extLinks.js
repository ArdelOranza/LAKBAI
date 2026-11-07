// External-link hardening for one shared sink. Every `window.open` and every
// source href goes through here: only http(s) passes, and popups open without
// handing their opener reference to the opened page (tabnabbing).
const SAFE = /^https?:\/\//i;

/** http(s) URL unchanged; anything else (javascript:, data:, //host, junk) → null. */
export function safeExternalUrl(url){
  const s = String(url ?? '');
  return SAFE.test(s) ? s : null;
}

/** Open a trusted-http popup tab. Returns false (and opens nothing) for unsafe URLs. */
export function openExternal(url){
  const href = safeExternalUrl(url);
  if (!href) return false;
  window.open(href, '_blank', 'noopener,noreferrer');
  return true;
}
