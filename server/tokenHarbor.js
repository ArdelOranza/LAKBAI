// Token Harbor — one OpenAI-compatible key over many models, with free routes.
//
// This is the chat chain's first provider: its free routes accept our full
// grounded context (1M window) and do not charge the balance, so an exhausted
// Gemini free quota is no longer a dead end. Model ids ending in `:free` never
// bill; the account can be topped up later for the paid catalog without a code
// change, only TOKEN_HARBOR_MODEL.
const { openAiChat, DEFAULT_MAX_TOKENS } = require('./openaiCompat.js');

const ENDPOINT = 'https://tokenharbor.ai/v1/chat/completions';
const DEFAULT_MODEL = process.env.TOKEN_HARBOR_MODEL || 'deepseek-v4.1-flash:free';

async function callTokenHarbor(system, payload, opts = {}){
  return openAiChat({
    endpoint: opts.endpoint || process.env.TOKEN_HARBOR_URL || ENDPOINT,
    key: process.env.TOKEN_HARBOR_API_KEY,
    model: opts.model || DEFAULT_MODEL,
    system,
    payload,
    maxTokens: opts.maxTokens || DEFAULT_MAX_TOKENS,
    label: 'Token Harbor',
    missingKeyMessage: 'Missing TOKEN_HARBOR_API_KEY',
  });
}

module.exports = { callTokenHarbor, DEFAULT_MODEL, ENDPOINT };