// How long to stop calling the model after a failure.
//
// A provider that is out of quota or credit needs the full cooldown: retrying
// on every message would just burn the client's 60 s budget. A rate limit is
// different — the provider says exactly when the window clears, so the breaker
// should open for that long instead of five minutes. Groq's free tier, for
// example, answers "Please try again in 42s", and serving dataset answers for
// five minutes after that would look like the AI is broken.
const FULL_MS = 5 * 60000;
// Never arm for less than this even when the provider whispers a tiny window:
// a breaker that reopens constantly is worse than not tripping at all.
const MIN_RATE_MS = 15 * 1000;

/** Cooldown for a failed model call, honouring a provider's retry hint. */
function cooldownFor(err){
  // `Number(null)` is 0, so an absent hint must be checked before converting.
  const raw = err && err.retryAfterMs;
  if (raw == null) return FULL_MS;
  const hint = Number(raw);
  if (!Number.isFinite(hint) || hint < 0) return FULL_MS;
  return Math.min(FULL_MS, Math.max(MIN_RATE_MS, Math.round(hint) + 2000));
}

module.exports = { cooldownFor, FULL_MS, MIN_RATE_MS };