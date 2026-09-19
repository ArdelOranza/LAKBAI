import { useEffect, useState } from 'react';

const cache = new Map();
function pickPhoto(data){
  const pages = (data.query && data.query.pages) || {};
  const withThumb = Object.values(pages).filter(p => p.thumbnail);
  if (!withThumb.length) return null;
  const first = withThumb[0];
  return {
    src: first.thumbnail.source,
    page: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(first.title)
  };
}
export async function fetchPhoto(name, lng, lat){
  const key = `${name}|${lng},${lat}`;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    try {
      if (lng !== undefined && lat !== undefined) {
        const geo = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
          action: 'query', generator: 'geosearch', ggscoord: `${lat}|${lng}`,
          ggsradius: '10000', ggslimit: '5', ggsnamespace: '6',
          prop: 'pageimages', pithumbsize: '600', format: 'json', origin: '*'
        });
        const r = await fetch(geo);
        if (r.ok) {
          const hit = pickPhoto(await r.json());
          if (hit) return hit;
        }
      }
      const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
        action: 'query', generator: 'search', gsrsearch: `${name} Pangasinan`,
        gsrnamespace: '6', gsrlimit: '1', prop: 'pageimages',
        pithumbsize: '600', format: 'json', origin: '*'
      });
      const r2 = await fetch(url);
      if (!r2.ok) return null;
      return pickPhoto(await r2.json());
    } catch {
      return null;
    }
  })();
  cache.set(key, p);
  return p;
}

export function PlacePhoto({ name, lng, lat }){
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    let live = true;
    fetchPhoto(name, lng, lat).then(p => { if (live) setPhoto(p); });
    return () => { live = false; };
  }, [name, lng, lat]);
  if (!photo) return null;
  return (
    <a href={photo.page} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
      <img src={photo.src} alt={'Photo of ' + name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
    </a>
  );
}
