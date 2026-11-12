// The traveler profile line comes from the browser, so it is data — one flat,
// bounded line that can never smuggle a second instruction block or an
// oversized prompt. It is also part of the cache key: two travelers asking the
// same question must not share one personalized answer.
const crypto = require('node:crypto');

const MAX_CONTEXT = 240;

function sanitizeChatContext(raw){
  if (typeof raw !== 'string') return '';
  return raw
    // Newlines/tabs/control characters collapse to a single space, so the
    // profile stays on one labeled line in the prompt.
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CONTEXT);
}

/** Short, stable fingerprint of the personalized inputs for the cache key. */
function profileHash(context, hasFix){
  const stamp = `${hasFix === false ? 'nofix' : 'fix'}|${context || ''}`;
  return crypto.createHash('sha1').update(stamp).digest('hex').slice(0, 10);
}

module.exports = { sanitizeChatContext, profileHash, MAX_CONTEXT };
