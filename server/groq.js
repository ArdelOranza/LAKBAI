// Groq (OpenAI-compatible) — the last model provider in the chain.
//
// Used when Gemini's quota is exhausted and the lite model is unavailable too.
// Same contract as callGeminiForPlan(sys, msg): returns the raw JSON string.
//
// The free tier counts tokens per minute, and a rejection says when the window
// clears ("Please try again in 42s"), so failures carry `retryAfterMs` for the
// caller's breaker instead of making every following message pay the backoff.
const { openAiChat, DEFAULT_MAX_TOKENS } = require('./openaiCompat.js');

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

async function callGroq(system, payload, opts = {}){
  return openAiChat({
    endpoint: opts.endpoint || ENDPOINT,
    key: process.env.GROQ_API_KEY,
    model: opts.model || DEFAULT_MODEL,
    system,
    payload,
    // Bounded completion: a runaway answer must not eat the minute's budget.
    maxTokens: opts.maxTokens || DEFAULT_MAX_TOKENS,
    label: 'Groq',
    missingKeyMessage: 'Missing GROQ_API_KEY',
  });
}

module.exports = { callGroq, DEFAULT_MODEL, DEFAULT_MAX_TOKENS };