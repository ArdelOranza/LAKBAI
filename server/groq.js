// Groq (OpenAI-compatible) — the last model provider in the chain.
//
// Used when Gemini's quota is exhausted and the lite model is unavailable too.
// Same contract as callGeminiForPlan(sys, msg): returns the raw JSON string.
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

async function callGroq(system, payload, opts = {}){
  const key = process.env.GROQ_API_KEY;
  if (!key) throw Object.assign(new Error('Missing GROQ_API_KEY'), { status: 503 });
  const r = await fetch(opts.endpoint || ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model: opts.model || DEFAULT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: payload },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });
  if (!r.ok) throw Object.assign(new Error('Groq error ' + r.status), { status: r.status || 502 });
  const data = await r.json();
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

module.exports = { callGroq, DEFAULT_MODEL };
