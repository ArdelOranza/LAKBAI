const PRIMARY_MODEL = 'gemini-3.6-flash';
const FALLBACK_MODEL = 'gemini-flash-lite-latest';
const SYSTEM = `You are Lakbai, a Pangasinan (Philippines) travel guide. Scope: ONLY Pangasinan province. Out-of-scope requests get intent "redirect" with an empty candidates list and a friendly redirect in answer. Never invent places, ratings, hours, or prices. Travel-related Pangasinan requests only. Anything else (homework, code, general chat) gets intent "refuse" with empty candidates and a one-line polite refusal in answer. Respond with JSON only: {"intent":"discover|food|event|nearby|emergency|plan|redirect|refuse","answer":"short markdown","candidates":[{"name":"exact place name","hint":"town or barangay","reason":"one grounded why","description":"one-two sentence grounded description","festival":"local festival or event tied to this place, else empty","fees":"entrance or activity fees with peso amounts, else empty"}],"spotlight":{"name":"...","reason":"..."}|null,"sources":["url"]}. Max 8 candidates. Spotlight = one non-obvious hidden gem from candidates, else null. Leave description, festival, or fees empty when the sources do not state them.`;
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
async function callGemini(payload, useTools, model){
  const key = process.env.GEMINI_API_KEY;
  if (!key) { const e = new Error('Missing GEMINI_API_KEY'); e.status = 503; throw e; }
  const body = { system_instruction: { parts: [{ text: SYSTEM }] }, contents: [{ parts: [{ text: payload }] }], generationConfig: { responseMimeType: 'application/json' } };
  if (useTools) body.tools = [{ google_search: {} }];
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!r.ok) { const e = new Error('Gemini error ' + r.status); e.status = r.status || 502; throw e; }  const data = await r.json();
  return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
}
async function callDeepSeek(payload){
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) { const e = new Error('Missing DEEPSEEK_API_KEY'); e.status = 503; throw e; }
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: payload }
      ],
      response_format: { type: 'json_object' }
    })
  });
  if (!r.ok) { const e = new Error('DeepSeek error ' + r.status); e.status = r.status || 502; throw e; }
  const data = await r.json();
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}
const RETRYABLE = [400, 429, 500, 502, 503];
function busyErr(){
  return Object.assign(new Error('AI is busy right now — try again in a minute.'), { status: 503 });
}
const BACKOFF_MS = [0, 1500, 3000];
async function chatRecommend(message, opts = {}){
  const wait = opts.wait || (ms => new Promise(r => setTimeout(r, ms)));
  const payload = `User request (Pangasinan, Philippines): ${message}`;
  let attempt = 0;
  const attempts = [
    { kind: 'gemini', model: PRIMARY_MODEL, tools: true },
    { kind: 'gemini', model: PRIMARY_MODEL, tools: false },
    { kind: 'gemini', model: FALLBACK_MODEL, tools: false }
  ];
  if (process.env.DEEPSEEK_API_KEY) attempts.push({ kind: 'deepseek' });
  for (const a of attempts){
    if (attempt > 0) await wait(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]);
    try {
      const text = a.kind === 'deepseek'
        ? await callDeepSeek(payload).catch(() => { throw busyErr(); })
        : await callGemini(payload, a.tools, a.model);
      return parseAgentJson(text);
    } catch (e) {
      if (!RETRYABLE.includes(e.status)) throw e;
      if (attempt === attempts.length - 1) throw busyErr();
      if (e.status === 429 || e.status === 503) e.message = 'AI is busy right now — try again in a moment.';
      attempt++;
    }
  }
  throw busyErr();
}
async function runSteps(wait, steps){
  for (let i = 0; i < steps.length; i++){
    if (i > 0) await wait(BACKOFF_MS[Math.min(i, BACKOFF_MS.length - 1)]);
    try {
      return await steps[i]();
    } catch (e) {
      if (!RETRYABLE.includes(e.status)) throw e;
      if (i === steps.length - 1) throw busyErr();
      if (e.status === 429 || e.status === 503) e.message = 'AI is busy right now — try again in a moment.';
    }
  }
  throw busyErr();
}
async function callGeminiForPlan(sys, msg, opts = {}){
  const wait = opts.wait || (ms => new Promise(r => setTimeout(r, ms)));
  const attempt = async () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) { const e = new Error('Missing GEMINI_API_KEY'); e.status = 503; throw e; }
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${PRIMARY_MODEL}:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: [{ parts: [{ text: `Trip request: ${msg}` }] }], generationConfig: { responseMimeType: 'application/json' } })
    });
    if (!r.ok) { const e = new Error('Gemini error ' + r.status); e.status = r.status || 502; throw e; }
    const data = await r.json();
    return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  };
  const ds = async () => {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) { const e = new Error('Missing DEEPSEEK_API_KEY'); e.status = 503; throw e; }
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: `Trip request: ${msg}` }
        ],
        response_format: { type: 'json_object' }
      })
    });
    if (!r.ok) { const e = new Error('DeepSeek error ' + r.status); e.status = r.status || 502; throw e; }
    const data = await r.json();
    return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  };
  const steps = [attempt, attempt];
  if (process.env.DEEPSEEK_API_KEY) steps.push(ds);
  return runSteps(wait, steps);
}
module.exports = { chatRecommend, parseAgentJson, callGeminiForPlan, extractJson };
