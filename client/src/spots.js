export async function fetchSpots(){
  let local = [];
  try { local = JSON.parse(localStorage.getItem('lakbai.spots') || '[]'); } catch { local = []; }
  if (local.length) return local; // instant pins, even offline
  const r = await fetch('/api/spots');
  if (!r.ok) throw new Error('spots unavailable');
  const { spots } = await r.json();
  try { localStorage.setItem('lakbai.spots', JSON.stringify(spots)); } catch { /* full storage */ }
  return spots;
}
