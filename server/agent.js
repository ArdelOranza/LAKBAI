const MODEL = 'gemini-3.6-flash';
const SYSTEM = `You are Lakbai, a Pangasinan (Philippines) travel guide. Scope: ONLY Pangasinan province. Out-of-scope requests get intent "redirect" with an empty candidates list and a friendly redirect in answer. Never invent places, ratings, hours, or prices. Respond with JSON only: {"intent":"discover|food|event|itinerary|nearby|emergency|redirect","answer":"short markdown","candidates":[{"name":"exact place name","hint":"town or barangay","reason":"one grounded why"}],"spotlight":{"name":"...","reason":"..."}|null,"sources":["url"]}. Max 8 candidates. Spotlight = one non-obvious hidden gem from candidates, else null.`;
function parseFail(){
  throw Object.assign(new Error('Could not parse agent JSON'), { status: 502 });
}
function extractJson(raw){
  const text = String(raw).replace(/```(?:json)?/gi, '').replace(/```/g, '');
  const start = text.indexOf('{');
  if (start === -1) parseFail();
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++){
    const ch = text[i];
    if (inStr){
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}'){
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  parseFail();
}
function parseAgentJson(raw){
  let obj;
  try {
    obj = JSON.parse(extractJson(raw));
  } catch (e) {
    if (e.status === 502) throw e;
    parseFail();
  }
  if (!obj || !obj.intent || !Array.isArray(obj.candidates) || !Array.isArray(obj.sources)) {
    parseFail();
  }
  return obj;
}
async function callGemini(payload, useTools){
  const key = process.env.GEMINI_API_KEY;
  if (!key) { const e = new Error('Missing GEMINI_API_KEY'); e.status = 503; throw e; }
  const body = { system_instruction: { parts: [{ text: SYSTEM }] }, contents: [{ parts: [{ text: payload }] }], generationConfig: { responseMimeType: 'application/json' } };
  if (useTools) body.tools = [{ google_search: {} }];
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!r.ok) { const e = new Error('Gemini error ' + r.status); e.status = r.status || 502; throw e; }  const data = await r.json();
  return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
}
const RETRYABLE = [400, 429, 500, 502, 503];
const BACKOFF_MS = [0, 1500, 3000];
async function chatRecommend(message, opts = {}){
  const wait = opts.wait || (ms => new Promise(r => setTimeout(r, ms)));
  const payload = `User request (Pangasinan, Philippines): ${message}`;
  let firstErr, attempt = 0;
  for (const useTools of [true, false, false]){
    if (attempt > 0) await wait(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]);
    try {
      return parseAgentJson(await callGemini(payload, useTools));
    } catch (e) {
      if (!RETRYABLE.includes(e.status)) throw e;
      if (e.status === 429 || e.status === 503) e.message = 'AI is busy right now — try again in a moment.';
      firstErr = e;
      attempt++;
    }
  }
  throw firstErr;
}
module.exports = { chatRecommend, parseAgentJson };
