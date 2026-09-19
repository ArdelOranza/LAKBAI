const MODEL = 'gemini-3.6-flash';
const SYSTEM = `You are Lakbai, a Pangasinan (Philippines) travel guide. Scope: ONLY Pangasinan province. Out-of-scope requests get intent "redirect" with an empty candidates list and a friendly redirect in answer. Never invent places, ratings, hours, or prices. Respond with JSON only: {"intent":"discover|food|event|itinerary|nearby|emergency|redirect","answer":"short markdown","candidates":[{"name":"exact place name","hint":"town or barangay","reason":"one grounded why"}],"spotlight":{"name":"...","reason":"..."}|null,"sources":["url"]}. Max 8 candidates. Spotlight = one non-obvious hidden gem from candidates, else null.`;
function parseAgentJson(raw){
  const m = String(raw).match(/\{[\s\S]*\}/);
  if (!m) throw Object.assign(new Error('Could not parse agent JSON'), { status: 502 });
  const obj = JSON.parse(m[0]);
  if (!obj.intent || !Array.isArray(obj.candidates) || !Array.isArray(obj.sources)) {
    throw Object.assign(new Error('Could not parse agent JSON'), { status: 502 });
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
  if (!r.ok) { const e = new Error('Gemini error ' + r.status); e.status = r.status || 502; throw e; }
  const data = await r.json();
  return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
}
async function chatRecommend(message){
  const payload = `User request (Pangasinan, Philippines): ${message}`;
  try {
    return parseAgentJson(await callGemini(payload, true));
  } catch (e) {
    if ([400, 429, 500, 503].includes(e.status)) return parseAgentJson(await callGemini(payload, false));
    throw e;
  }
}
module.exports = { chatRecommend, parseAgentJson };
