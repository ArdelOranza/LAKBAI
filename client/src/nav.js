import { haversineKm } from './geo.js';

/**
 * Live-guidance math for the in-app route.
 *
 * The Mapbox route already carries everything a driver needs: the polyline and
 * one distance per maneuver. Projecting the live GPS fix onto that line gives
 * Google-Maps-like numbers (remaining time, next turn, how far to it) without a
 * second API call per tick.
 */

const ARRIVED_M = 35;

function metres(a, b){
  const km = haversineKm(a[0], a[1], b[0], b[1]);
  return km == null ? 0 : km * 1000;
}

/** Closest point on segment A→B to P, in local metres (equirectangular). */
function projectOnSegment(p, a, b){
  const latRef = ((a[1] + b[1] + p[1]) / 3) * (Math.PI / 180);
  const mx = 111320 * Math.cos(latRef);
  const my = 110540;
  const ax = (a[0] - p[0]) * mx, ay = (a[1] - p[1]) * my;
  const bx = (b[0] - p[0]) * mx, by = (b[1] - p[1]) * my;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2)) : 0;
  const cx = ax + dx * t, cy = ay + dy * t;
  return { t, offM: Math.hypot(cx, cy) };
}

/** Shortest distance from the fix to the polyline, plus where along it we are. */
function locate(coordinates, here){
  let best = { offM: Infinity, atM: 0 };
  let travelled = 0;
  for (let i = 0; i < coordinates.length - 1; i++){
    const a = coordinates[i], b = coordinates[i + 1];
    const segM = metres(a, b);
    const { t, offM } = projectOnSegment([here.lng, here.lat], a, b);
    if (offM < best.offM) best = { offM, atM: travelled + segM * t };
    travelled += segM;
  }
  return { ...best, totalM: travelled };
}

/**
 * Where the traveler is on the route right now.
 * Returns null when the route line is unusable, so callers show the route
 * without live numbers instead of inventing them.
 */
export function routeProgress({ coordinates, steps = [], here, durationS = 0, distanceM = 0 } = {}){
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  if (!here || !Number.isFinite(Number(here.lng)) || !Number.isFinite(Number(here.lat))) return null;

  const { atM, totalM } = locate(coordinates, here);
  const scale = Number(distanceM) > 0 && totalM > 0 ? Number(distanceM) / totalM : 1;
  const progressM = Math.min(atM * scale, Math.max(Number(distanceM) || totalM, 0));
  const endM = Number(distanceM) || totalM;
  const remainingM = Math.max(0, endM - progressM);

  // Step distances sum to the leg total; walk them to find the maneuver ahead.
  let cursor = 0;
  let stepIndex = steps.length ? steps.length - 1 : -1;
  let stepEndM = endM;
  for (let i = 0; i < steps.length; i++){
    const d = Number(steps[i].distanceM) || 0;
    cursor += d;
    if (cursor > progressM){ stepIndex = i; stepEndM = cursor; break; }
  }
  const next = stepIndex >= 0 ? steps[stepIndex] : null;

  // Mapbox gives a duration per maneuver. Counting those down is the accurate
  // ETA (a jammed leg is slower than its distance suggests); the route-level
  // duration is only the fallback for fixtures without per-step times.
  let remainingS = 0;
  const timed = steps.some(s => Number(s.durationS) > 0);
  if (timed && next){
    const curDist = Number(next.distanceM) || 0;
    const left = Math.max(0, Math.min(1, curDist > 0 ? (stepEndM - progressM) / curDist : 0));
    remainingS = (Number(next.durationS) || 0) * left;
    for (let i = stepIndex + 1; i < steps.length; i++) remainingS += Number(steps[i].durationS) || 0;
  } else {
    remainingS = endM > 0 ? Math.max(0, (Number(durationS) || 0) * (remainingM / endM)) : 0;
  }
  remainingS = Math.max(0, remainingS);

  return {
    progressM,
    remainingM,
    remainingS,
    stepIndex,
    toStepM: Math.max(0, stepEndM - progressM),
    nextInstruction: next ? next.instruction : null,
    nextManeuver: next ? next.maneuver : null,
    nextModifier: next ? next.modifier : null,
    arrived: remainingM <= ARRIVED_M,
  };
}
