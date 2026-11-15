// Photo hierarchy for the public place endpoints.
//
// A place that already carries photos is never re-searched: the list it has
// (curated, admin or precomputed Wikimedia) is the answer, in order. Only a
// place with no photo at all is worth a Wikimedia lookup, and the caller falls
// back to the client's Mapbox static map when that finds nothing.
const isWikimedia = url => /wikimedia\.org|upload\.wikimedia/i.test(String(url || ''));

function existingPhoto(place){
  if (!place || typeof place !== 'object') return null;
  const photos = Array.isArray(place.photos)
    ? place.photos.filter(p => typeof p === 'string' && p.trim()).map(p => p.trim())
    : [];
  const bare = typeof place.photo === 'string' && place.photo.trim() ? place.photo.trim() : null;
  if (photos.length) {
    return { photos, photo: photos[0], photoSource: isWikimedia(photos[0]) ? 'wikimedia' : 'json' };
  }
  if (bare) {
    return { photos: [bare], photo: bare, photoSource: isWikimedia(bare) ? 'wikimedia' : 'json' };
  }
  return null;
}

module.exports = { existingPhoto, isWikimedia };
