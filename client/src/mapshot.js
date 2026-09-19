const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
export function thumbUrl(place, w = 400, h = 300){
  if (!TOKEN || place.lng === undefined || place.lat === undefined) return '';
  const lng = Number(place.lng).toFixed(5);
  const lat = Number(place.lat).toFixed(5);
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+EA580C(${lng},${lat})/${lng},${lat},14/${w}x${h}?access_token=${TOKEN}`;
}
