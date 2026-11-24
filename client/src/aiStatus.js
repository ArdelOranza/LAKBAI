import { apiUrl } from './apiBase.js';

/**
 * The chat header dot has three states: green when the AI works, red when the
 * model is down or the API can't be reached, gray when the browser itself is
 * offline. Kept pure so the mapping is testable without a browser.
 */
export function dotState({ online = true, aiDown = false } = {}){
  if (!online) return 'off';
  return aiDown ? 'down' : 'ok';
}

/**
 * Ask the server whether the model path is usable. Anything short of a clear
 * "yes" (offline, API asleep, breaker armed, no provider key) means the AI is
 * not working, so the dot goes red. Never throws.
 */
export async function checkAiStatus(fetchImpl, { timeoutMs = 8000 } = {}){
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('ai-status timeout')), timeoutMs);
  try {
    const r = await doFetch(apiUrl('/api/ai-status'), { signal: ctrl.signal, cache: 'no-store' });
    if (!r || !r.ok) return false;
    const body = await r.json();
    return Boolean(body && body.ai && body.configured);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
