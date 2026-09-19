const STOP_MIN = 90, TRAVEL_MIN = 30;
function fmt(totalMin){
  const h = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
  const m = String(totalMin % 60).padStart(2, '0');
  return `${h}:${m}`;
}
function buildItinerary(places, hours, startHour = 9){
  const budget = Math.max(1, hours) * 60;
  let cursor = startHour * 60;
  const end = cursor + budget;
  const schedule = [];
  for (const p of places) {
    if (cursor + STOP_MIN > end) break;
    schedule.push({ placeId: p.id, name: p.name, arrive: fmt(cursor), depart: fmt(cursor + STOP_MIN) });
    cursor += STOP_MIN + TRAVEL_MIN;
  }
  return { schedule };
}
module.exports = { buildItinerary };
