// @vitest-environment happy-dom
// Live guidance math: where am I on the route, what is the next turn, and how
// much is left. Google-Maps-like numbers, computed locally from the Mapbox
// geometry — no extra API call while driving.
import { describe, it, expect } from 'vitest';
import { routeProgress } from './nav.js';

// A straight north-bound line: 0.01° lat per point ≈ 1.11 km per step.
const LINE = [[120.23, 16.03], [120.23, 16.04], [120.23, 16.05], [120.23, 16.06], [120.23, 16.07]];
const STEPS = [
  { instruction: 'Head north on Judge Jose de Venecia Ave.', distanceM: 2220, maneuver: 'depart', modifier: 'straight' },
  { instruction: 'Turn right onto MacArthur Highway.', distanceM: 2220, maneuver: 'turn', modifier: 'right' },
];
const BASE = { coordinates: LINE, steps: STEPS, durationS: 600, distanceM: 4440 };

describe('routeProgress', () => {
  it('starts on the first instruction with the full trip remaining', () => {
    const nav = routeProgress({ ...BASE, here: { lng: 120.23, lat: 16.03 } });
    expect(nav.arrived).toBe(false);
    expect(nav.stepIndex).toBe(0);
    expect(nav.nextInstruction).toContain('Head north');
    expect(nav.remainingM).toBeCloseTo(4440, -1);
    expect(nav.remainingS).toBeCloseTo(600, -1);
  });

  it('advances to the next turn once the first leg is behind you', () => {
    const nav = routeProgress({ ...BASE, here: { lng: 120.23, lat: 16.055 } });
    expect(nav.stepIndex).toBe(1);
    expect(nav.nextInstruction).toBe('Turn right onto MacArthur Highway.');
    // 0.015° left of the 0.02° second leg ≈ 1.67 km
    expect(nav.toStepM).toBeGreaterThan(1500);
    expect(nav.toStepM).toBeLessThan(1800);
    expect(nav.remainingM).toBeGreaterThan(1500);
    expect(nav.remainingM).toBeLessThan(1800);
  });

  it('counts the trip as arrived at the destination', () => {
    const nav = routeProgress({ ...BASE, here: { lng: 120.23, lat: 16.07 } });
    expect(nav.arrived).toBe(true);
    expect(nav.remainingM).toBeLessThan(40);
    expect(nav.remainingS).toBeLessThan(10);
  });

  it('treats a dropped off-route fix as still following the route', () => {
    // 30 m east of the start — the nearest point is the start, not the end.
    const nav = routeProgress({ ...BASE, here: { lng: 120.2303, lat: 16.03 } });
    expect(nav.stepIndex).toBe(0);
    expect(nav.remainingM).toBeGreaterThan(4300);
  });

  it('returns null instead of guessing when there is no route line', () => {
    expect(routeProgress({ ...BASE, coordinates: [[120.23, 16.03]], here: { lng: 120.23, lat: 16.03 } })).toBeNull();
    expect(routeProgress({ ...BASE, coordinates: null, here: { lng: 120.23, lat: 16.03 } })).toBeNull();
  });

  it('counts down Mapbox step durations, not a flat distance ratio', () => {
    // The second leg is short on time even though it is where the car is now;
    // a distance-only ratio would report ~225 s for the remaining trip.
    const timed = {
      ...BASE,
      steps: [
        { ...STEPS[0], durationS: 480 },
        { ...STEPS[1], durationS: 120 },
      ],
    };
    const nav = routeProgress({ ...timed, here: { lng: 120.23, lat: 16.055 } });
    expect(nav.stepIndex).toBe(1);
    // 1665 m of the 2220 m second leg left, at its own 120 s pace: ~90 s.
    expect(nav.remainingS).toBeGreaterThan(80);
    expect(nav.remainingS).toBeLessThan(100);
  });
});
