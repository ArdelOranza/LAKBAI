import { useMemo } from 'react';
import { PANGASINAN_PATHS } from './pangasinanPaths.js';
import { MAP_VIEWBOX, municipalityAt, project } from './pangasinanMap.js';

/** The whole province drawn flat, with only the municipality you are standing in
 *  filled in brand blue. Nothing is tinted when GPS is unavailable. */
export default function PangasinanMap({ coords, className }){
  const spot = useMemo(() => {
    const index = coords ? municipalityAt(coords.lng, coords.lat) : -1;
    return { index, dot: index >= 0 ? project(coords.lng, coords.lat) : null };
  }, [coords]);

  return (
    <svg
      className={'pm-map' + (className ? ' ' + className : '')}
      viewBox={MAP_VIEWBOX}
      role="img"
      aria-label={spot.index >= 0 ? 'Pangasinan map, your municipality highlighted' : 'Pangasinan map'}
    >
      <title>{spot.index >= 0 ? 'Your municipality in Pangasinan' : 'Pangasinan'}</title>
      {PANGASINAN_PATHS.map((d, i) => (
        <path key={i} d={d} className={'pm-shape' + (i === spot.index ? ' on' : '')}/>
      ))}
      {spot.dot && (
        <g className="pm-pin">
          <circle cx={spot.dot.x} cy={spot.dot.y} r="15" className="pm-pin-halo"/>
          <circle cx={spot.dot.x} cy={spot.dot.y} r="8.5" className="pm-pin-dot"/>
        </g>
      )}
    </svg>
  );
}