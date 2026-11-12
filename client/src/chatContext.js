/**
 * What the chat AI should know about the person without asking a single
 * question: how to address them, what they already said they like, and what
 * time it is where they are. Coordinates are already sent as `proximity`.
 *
 * Deliberately small and derived from what the app already stores. No email,
 * no account id, no surname — the model never needs them to answer a travel
 * question.
 */
const MAX_INTERESTS = 6;
const MAX_NAME = 40;

function firstNameOf(user){
  const meta = (user && user.user_metadata) || {};
  const raw = String(meta.full_name || meta.name || meta.display_name || '').trim();
  // Never derive a name from the email: that is a guess about a person, and
  // the local part is not a name.
  if (!raw) return '';
  return raw.split(/\s+/)[0].slice(0, MAX_NAME);
}

function zoneOf(tz){
  if (tz){
    try { new Intl.DateTimeFormat('en-GB', { timeZone: tz }); return tz; } catch { /* invalid, fall through */ }
  }
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila'; } catch { return 'Asia/Manila'; }
}

function localTimeLabel(now, zone){
  try {
    const time = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zone,
    }).format(now);
    const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: zone }).format(now);
    return `${day} ${time} (${zone})`;
  } catch {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  }
}

/** One compact line of profile facts, or just the local time for a guest. */
export function buildChatContext({ user = null, prefs = [], now = new Date(), tz } = {}){
  const bits = [];
  const name = firstNameOf(user);
  if (name) bits.push(name);

  const interests = [...new Set(
    (Array.isArray(prefs) ? prefs : [])
      .map(p => String(p).trim())
      .filter(Boolean),
  )].slice(0, MAX_INTERESTS);
  if (interests.length) bits.push(`Interests: ${interests.join(', ')}`);

  bits.push(`Local time: ${localTimeLabel(now, zoneOf(tz))}`);
  return bits.join('. ') + '.';
}
