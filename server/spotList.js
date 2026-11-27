// What /api/spots answers with: the curated catalogue, plus every community
// place an admin has approved.
//
// Kept out of index.js so the composition is testable on its own — and so the
// map can never go blank because Supabase is unreachable or the submissions
// migration has not been run yet. A failure there degrades to the file
// catalogue, it does not take the map down with it.
const adminStore = require('./adminSpots.js');
const community = require('./communityPlaces.js');

function createSpotList({ listCurated = () => adminStore.listSpots(), approved = () => community.approvedSpots() } = {}){
  async function listSpots(){
    // With the Supabase backend the admin document loads asynchronously; wait
    // for it so the first request after a cold start already sees every edit.
    try { await adminStore.ready(); } catch { /* degrade to the file/default list */ }
    const curated = await listCurated();
    let extra = [];
    try {
      extra = await approved();
    } catch {
      // The curated list is the floor: a broken submissions backend must not
      // cost travellers the 81 spots they already had.
      return curated;
    }
    const community = (Array.isArray(extra) ? extra : []).filter(s => s && s.id && Number.isFinite(s.lat) && Number.isFinite(s.lng));
    return community.length ? [...curated, ...community] : curated;
  }
  return { listSpots };
}

const spotList = createSpotList();

module.exports = { createSpotList, ...spotList };
