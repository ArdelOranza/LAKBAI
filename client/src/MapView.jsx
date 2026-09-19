import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
export default function MapView({ places, focus }){
  const divRef = useRef(null), mapRef = useRef(null), markers = useRef([]);
  useEffect(() => {
    mapRef.current = new mapboxgl.Map({ container: divRef.current, style: 'mapbox://styles/mapbox/streets-v12', center: [120.23, 16.03], zoom: 9.5 });
    return () => mapRef.current.remove();
  }, []);
  useEffect(() => {
    markers.current.forEach(m => m.remove()); markers.current = [];
    places.forEach((p, i) => {
      const m = new mapboxgl.Marker().setLngLat([p.lng, p.lat]).addTo(mapRef.current);
      markers.current.push(m);
      if (i < 3) setTimeout(() => mapRef.current.flyTo({ center: [p.lng, p.lat], zoom: 12 }), i * 900);
    });
  }, [places]);
  useEffect(() => { if (focus) mapRef.current.flyTo({ center: [focus.lng, focus.lat], zoom: 13 }); }, [focus]);
  return <div data-testid="map" ref={divRef} style={{ height: 320 }} />;
}
