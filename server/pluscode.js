// Open Location Code (plus codes) — encode/decode + recoverNearest, enough for
// the Google Maps plus codes in the restaurant dataset.
const ALPHABET = '23456789CFGHJMPQRVWX';
const SEP = '+';

function encode(lat, lng, length = 10){
  let latVal = Math.min(90, Math.max(-90, lat)) + 90;
  let lngVal = ((lng + 180) % 360 + 360) % 360;
  let code = '';
  for (let i = 0; code.length < length; i++){
    const res = 20 / Math.pow(20, i);
    const latDigit = Math.min(19, Math.floor(latVal / res));
    latVal -= latDigit * res;
    code += ALPHABET[latDigit];
    if (code.length < length){
      const lngDigit = Math.min(19, Math.floor(lngVal / res));
      lngVal -= lngDigit * res;
      code += ALPHABET[lngDigit];
    }
  }
  return code;
}

function recoverNearest(shortCode, refLat, refLng){
  const short = String(shortCode).trim().toUpperCase();
  const sep = short.indexOf(SEP);
  if (sep < 0) return short;
  const padding = 8 - sep;
  if (padding <= 0) return short;
  const reference = encode(refLat, refLng, 10);
  return reference.slice(0, padding) + short;
}

function decode(code){
  const clean = String(code).replace(SEP, '').toUpperCase();
  if (!clean || /[^23456789CFGHJMPQRVWX]/.test(clean)) return null;
  let lat = -90, lng = -180;
  let latRes = 400, lngRes = 400;
  const pairs = Math.floor(clean.length / 2);
  for (let i = 0; i < pairs; i++){
    const latDigit = ALPHABET.indexOf(clean[i * 2]);
    const lngDigit = ALPHABET.indexOf(clean[i * 2 + 1]);
    if (latDigit < 0 || lngDigit < 0) return null;
    latRes /= 20;
    lngRes /= 20;
    lat += latRes * latDigit;
    lng += lngRes * lngDigit;
  }
  if (clean.length % 2){ // 11th digit refines latitude only
    const extra = ALPHABET.indexOf(clean[clean.length - 1]);
    if (extra < 0) return null;
    latRes /= 20;
    lat += latRes * extra;
  }
  return { lat: lat + latRes / 2, lng: lng + lngRes / 2 };
}

function decodePlusCode(shortCode, refLat, refLng){
  return decode(recoverNearest(shortCode, refLat, refLng));
}

module.exports = { encode, decode, recoverNearest, decodePlusCode };