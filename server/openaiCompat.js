// Shared client for OpenAI-compatible chat endpoints (Groq, Token Harbor).
//
// Both providers speak the same /chat/completions contract and both report a
// rate-limit window inside the error body or a retry-after header. Keeping the
// request shape and the retry-window parsing in one place means a provider
// cannot drift from the breaker's expectations.
const DEFAULT_MAX_TOKENS = 1600;

/** The wait a provider asked for, in ms: retry-after header first, then prose. */
function retryAfterMsOf(r, body){
  const header = Number(r.headers && typeof r.headers.get === 'function' ? r.headers.get('retry-after') : NaN);
  if (Number.isFinite(header) && header > 0) return Math.round(header * 1000);
  const m = String(body || '').match(/try again in\s+([\d.]+)\s*s/i);
  return m ? Math.round(Number(m[1]) * 1000) : null;
}

async function failureFor(label, r){
  let body = '';
  try { body = typeof r.text === 'function' ? await r.text() : ''; } catch { body = ''; }
  const err = Object.assign(new Error(label + ' error ' + r.status), { status: r.status || 502 });
  const wait = retryAfterMsOf(r, body);
  if (wait != null) err.retryAfterMs = wait;
  throw err;
}

/**
 * One non-streaming chat completion. Throws on a missing key, a non-2xx
 * response (carrying `retryAfterMs` when the provider named a window) and on
 * empty content — callers must not parse an empty string.
 */
async function openAiChat({
  endpoint, key, model, system, payload,
  maxTokens = DEFAULT_MAX_TOKENS, label = 'Model',
  missingKeyMessage, timeoutMs = 30000,
}){
  if (!key) throw Object.assign(new Error(missingKeyMessage || ('Missing ' + label + ' key')), { status: 503 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(label + ' request timed out')), timeoutMs);
  let r;
  try {
    r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: payload },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) await failureFor(label, r);
  const data = await r.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw Object.assign(new Error(label + ' returned empty content'), { status: 502 });
  }
  return content;
}

module.exports = { openAiChat, retryAfterMsOf, DEFAULT_MAX_TOKENS };