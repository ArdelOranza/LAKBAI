// Photo hierarchy for the public place endpoints.
//
// A place that already carries photos is never re-searched: the list it has
// (curated, admin or precomputed Wikimedia) is the answer, in order. Only a
// place with no photo at all is worth a Wikimedia lookup, and the caller falls
// back to the client's Mapbox static map when that finds nothing.
const isWikimedia = url => /wikimedia\.org|upload\.wikimedia/i.test(String(url || ''));

// Scrapers hand us hotel-listings, brochure scans and ad collages as if they
// were the destination. Those are not place photos: a beach card showed a
// Scribd page of text and a Lingayen beach card showed a resort's ad. A real
// lodging keeps its own listing image; a beach never borrows one.
const SCRAPED = /(?:^|[/_.-])(lodging|hotelimages|document|cover|poster|banner|flyer|brochure|collage|advert|advertisement|tarpaulin|screenshot)(?:[/_.@-]|$)/i;
const LODGING = /\b(resort|hotel|inn|lodge|hostel|villa|apartment|condo|suites?)\b/i;

/** A stored URL is only a place photo when it is a photo of that place. */
function trustedPhotoUrl(url, placeName){
  const u = String(url || '').trim();
  if (!u) return false;
  if (!SCRAPED.test(u)) return true;
  return LODGING.test(String(placeName || ''));
}

function existingPhoto(place){
  if (!place || typeof place !== 'object') return null;
  const name = place.name || '';
  const photos = Array.isArray(place.photos)
    ? place.photos.filter(p => typeof p === 'string' && p.trim()).map(p => p.trim()).filter(u => trustedPhotoUrl(u, name))
    : [];
  const bare = typeof place.photo === 'string' && place.photo.trim() ? place.photo.trim() : null;
  const bareTrusted = bare && trustedPhotoUrl(bare, name) ? bare : null;
  if (photos.length) {
    return { photos, photo: photos[0], photoSource: isWikimedia(photos[0]) ? 'wikimedia' : 'json' };
  }
  if (bareTrusted) {
    return { photos: [bareTrusted], photo: bareTrusted, photoSource: isWikimedia(bareTrusted) ? 'wikimedia' : 'json' };
  }
  return null;
}

module.exports = { existingPhoto, isWikimedia, trustedPhotoUrl };