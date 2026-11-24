/**
 * The one paragraph a place popup shows.
 *
 * Curated spots carry a short hand-written blurb. Dataset rows carry a long
 * description (some run to ~900 characters), and a bottom sheet is not the
 * place for an essay — so the popup keeps the first sentence when there is one,
 * and ellipsizes at a word boundary when even that sentence is too long.
 *
 * Nothing here invents copy: with no blurb and no description the popup only
 * says where the place is.
 */
const MAX = 160;

function fallback(spot){
  const name = String(spot?.name || '').trim() || 'This place';
  const town = String(spot?.town || '').trim() || 'Pangasinan';
  return `${name} is in ${town} — save it and let LakbAI sequence your day around it.`;
}

export function popupBlurb(spot){
  const text = String(spot?.blurb || spot?.description || '').trim();
  if (!text) return fallback(spot);
  if (text.length <= MAX) return text;

  // Prefer a real sentence ending, as long as it leaves a useful sentence.
  const cut = text.slice(0, MAX);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentenceEnd >= 60) return cut.slice(0, sentenceEnd + 1);

  const space = cut.lastIndexOf(' ');
  const head = (space >= 60 ? cut.slice(0, space) : cut).trimEnd();
  return head + '…';
}