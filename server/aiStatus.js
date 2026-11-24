// Whether the AI model path is usable right now — the signal behind the app's
// chat status dot. Kept pure and dependency-free so the mapping from the
// breaker / off-switch / provider keys to a boolean is testable on its own.
//
// A cold process starts with the breaker closed (downUntil 0), so a fresh
// deploy reads as usable until a real model call fails and arms it.

/** True when at least one model provider key is present in the environment. */
function keyConfigured(env = process.env){
  return Boolean(env && (env.TOKEN_HARBOR_API_KEY || env.GEMINI_API_KEY || env.GROQ_API_KEY || env.DEEPSEEK_API_KEY));
}

/**
 * The model path is usable when AI is switched on, the breaker has not tripped,
 * and a provider key exists. `downUntil` is the ms timestamp the breaker clears.
 */
function aiStatus({ useAi = true, downUntil = 0, now = Date.now(), env = process.env } = {}){
  return {
    ai: Boolean(useAi) && now > downUntil,
    configured: keyConfigured(env),
    useAi: Boolean(useAi),
  };
}

module.exports = { aiStatus, keyConfigured };
