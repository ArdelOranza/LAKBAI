/** Hit-testing for the Pangasinan silhouette on Home.
 *
 *  Pangasinan.svg was traced from the province's real boundary, so the drawing
 *  is an affine (axis-aligned) copy of lng/lat space. These two boxes calibrate
 *  the drawing: the province's own bounding box from the PSA boundary file and
 *  the geometry box of the SVG. With them a GPS fix lands in the right
 *  municipality shape and only that shape is tinted.
 */
import { PANGASINAN_PATHS } from './pangasinanPaths.js';

export const MAP_BOX = { x0: 172.8, x1: 627.2, y0: 53.3, y1: 479.7 };
export const PROVINCE_BOX = { west: 119.7497, east: 120.9206, north: 16.425, south: 15.6178 };

/** A pleasant padding around the drawing, in SVG units. */
export const MAP_VIEWBOX = '166 46 468 441';

/** lng/lat -> SVG user units. */
export function project(lng, lat){
  const x = MAP_BOX.x0 + ((lng - PROVINCE_BOX.west) / (PROVINCE_BOX.east - PROVINCE_BOX.west)) * (MAP_BOX.x1 - MAP_BOX.x0);
  const y = MAP_BOX.y0 + ((PROVINCE_BOX.north - lat) / (PROVINCE_BOX.north - PROVINCE_BOX.south)) * (MAP_BOX.y1 - MAP_BOX.y0);
  return { x, y };
}

/** Split an SVG path made of M/L/Z into closed rings. */
function ringsOf(d){
  const tokens = d.match(/[MLZ]|-?\d*\.?\d+/g) || [];
  const rings = [];
  let ring = null;
  let i = 0;
  while (i < tokens.length){
    const t = tokens[i];
    if (t === 'M'){
      ring = [];
      rings.push(ring);
      ring.push([+tokens[i + 1], +tokens[i + 2]]);
      i += 3;
    } else if (t === 'L'){
      if (ring) ring.push([+tokens[i + 1], +tokens[i + 2]]);
      i += 3;
    } else {
      i += 1;
    }
  }
  return rings.filter(r => r.length > 2);
}

const SHAPES = PANGASINAN_PATHS.map(ringsOf);

/** Ray casting. */
function inRing(x, y, ring){
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++){
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function distanceToRing(x, y, ring){
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++){
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len));
    const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    if (d < best) best = d;
  }
  return best;
}

/** Coastlines in the source boundary are simplified, so a poblacion sitting on
 *  the shore can fall a hair outside its own shape. Anything within this many
 *  SVG units (~2 km) of a shape edge counts as that municipality. */
const SHORE_TOLERANCE = 8;

/** Index of the municipality shape containing a point, or -1 when the fix is
 *  nowhere near Pangasinan. Even-odd across rings so islands and holes behave. */
export function municipalityAt(lng, lat){
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return -1;
  const p = project(lng, lat);

  for (let i = 0; i < SHAPES.length; i++){
    let hits = 0;
    for (const ring of SHAPES[i]) if (inRing(p.x, p.y, ring)) hits++;
    if (hits % 2 === 1) return i;
  }

  let nearest = -1;
  let best = SHORE_TOLERANCE;
  for (let i = 0; i < SHAPES.length; i++){
    for (const ring of SHAPES[i]){
      const d = distanceToRing(p.x, p.y, ring);
      if (d < best){ best = d; nearest = i; }
    }
  }
  return nearest;
}