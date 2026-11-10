// Deep links from PWA app shortcuts (`/?tab=map`). Only the real tab ids are
// honoured so a hand-typed query string can never route somewhere unexpected.
const TABS = new Set(['home', 'map', 'chat', 'saved', 'profile']);

export function tabFromSearch(search){
  try {
    const tab = new URLSearchParams(search || '').get('tab');
    return tab && TABS.has(tab) ? tab : null;
  } catch {
    return null;
  }
}
