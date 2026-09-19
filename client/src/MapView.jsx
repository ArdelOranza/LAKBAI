import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
export default function MapView({ places, focus }){
  const divRef = useRef(null), mapRef = useRef(null), markers = useRef([]), timers = useRef([]);
  useEffect(() => {
    if (!TOKEN) return;
    mapboxgl.accessToken = TOKEN;
    mapRef.current = new mapboxgl.Map({ container: divRef.current, style: 'mapbox://styles/mapbox/streets-v12', center: [120.23, 16.03], zoom: 9.5 });
    return () => {
      timers.current.forEach(clearTimeout); timers.current = [];
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!mapRef.current) return;
    markers.current.forEach(m => m.remove()); markers.current = [];
    timers.current.forEach(clearTimeout); timers.current = [];
    places.forEach((p, i) => {
      const m = new mapboxgl.Marker().setLngLat([p.lng, p.lat]).addTo(mapRef.current);
      markers.current.push(m);
      if (i < 3) timers.current.push(setTimeout(() => { if (mapRef.current) mapRef.current.flyTo({ center: [p.lng, p.lat], zoom: 12 }); }, i * 900));
    });
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, [places]);
  useEffect(() => { if (focus && mapRef.current) mapRef.current.flyTo({ center: [focus.lng, focus.lat], zoom: 13 }); }, [focus]);
  if (!TOKEN) return <p data-testid="notice">Missing VITE_MAPBOX_TOKEN — set it in .env to enable the map.</p>;
  return <div data-testid="map" ref={divRef} style={{ height: 320 }} />;
}
