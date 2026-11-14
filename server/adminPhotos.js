// Admin-managed photo overlay for the read-only restaurant dataset.
//
// The 78 restaurant rows come from server/data/places.json and are never
// rewritten by the admin app. Photos an editor adds live here, keyed by the
// restaurant's stable dataset id, and dataset.js layers them on at read time.
// File layout: { places: { [id]: { photos: [url, ...] } } }
const fs = require('fs');
const path = require('path');

function dataFile(){
  return process.env.LAKBAI_ADMIN_PHOTOS_FILE || path.join(__dirname, 'data', 'admin-photos.json');
}

const isHttpUrl = v => {
  try {
    const u = new URL(String(v));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
};

function readDoc(){
  try {
    const raw = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
    const src = raw && raw.places && typeof raw.places === 'object' && !Array.isArray(raw.places) ? raw.places : {};
    const places = {};
    for (const [id, v] of Object.entries(src)){
      const photos = Array.isArray(v && v.photos) ? v.photos.filter(isHttpUrl).map(String) : [];
      if (photos.length) places[id] = { photos };
    }
    return { places };
  } catch { return { places: {} }; }
}

function writeDoc(doc){
  const f = dataFile();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(doc, null, 2), 'utf8');
}

function cleanPhotos(list){
  if (!Array.isArray(list)) {
    const e = new Error('photos must be an array of URLs');
    e.status = 400;
    throw e;
  }
  const photos = list.map(p => String(p).trim()).filter(Boolean).slice(0, 20);
  const bad = photos.find(p => !isHttpUrl(p));
  if (bad) {
    const e = new Error('photo URLs must be http(s) — got: ' + bad);
    e.status = 400;
    throw e;
  }
  return photos;
}

function allPhotos(){
  return readDoc().places;
}

function photosFor(id){
  const hit = readDoc().places[String(id)];
  return hit ? hit.photos.slice() : [];
}

function setPhotos(id, list){
  const photos = cleanPhotos(list);
  const doc = readDoc();
  if (photos.length) doc.places[String(id)] = { photos };
  else delete doc.places[String(id)];
  writeDoc(doc);
  return { id: String(id), photos };
}

module.exports = { allPhotos, photosFor, setPhotos, cleanPhotos, _file: dataFile };
