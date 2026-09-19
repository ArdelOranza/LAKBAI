import { useEffect, useState } from 'react';

const cache = new Map();
export async function fetchPhoto(name){
  if (cache.has(name)) return cache.get(name);
  const p = (async () => {
    try {
      const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
        action: 'query', generator: 'search', gsrsearch: name,
        gsrnamespace: '6', gsrlimit: '1', prop: 'pageimages',
        pithumbsize: '600', format: 'json', origin: '*'
      });
      const r = await fetch(url);
      if (!r.ok) return null;
      const data = await r.json();
      const pages = (data.query && data.query.pages) || {};
      const first = Object.values(pages)[0];
      if (!first || !first.thumbnail) return null;
      return {
        src: first.thumbnail.source,
        page: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(first.title)
      };
    } catch {
      return null;
    }
  })();
  cache.set(name, p);
  return p;
}

export function PlacePhoto({ name, large }){
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    let live = true;
    fetchPhoto(name).then(p => { if (live) setPhoto(p); });
    return () => { live = false; };
  }, [name]);
  if (!photo) return null;
  return (
    <a href={photo.page} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
      <img src={photo.src} alt={'Photo of ' + name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
    </a>
  );
}
