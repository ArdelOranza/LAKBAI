// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  directionsUrl, normalizeRoute, fetchRoute, clearRouteCache,
  routeDistanceLabel, routeDurationLabel,
} from './directions.js';

const TOKEN = 'pk.test-token';
const FROM = { lng: 120.23, lat: 16.03 };
const TO = { lng: 120.1, lat: 16.28 };

const MAPBOX_BODY = {
  routes: [{
    distance: 6400.4,
    duration: 745.2,
    geometry: { coordinates: [[120.23, 16.03], [120.18, 16.14], [120.1, 16.28]] },
    legs: [{
      steps: [
        {
          distance: 420,
          duration: 96,
          maneuver: { type: 'depart', instruction: 'Drive north on Judge Jose de Venecia Ave.', modifier: 'straight' },
        },
        {
          distance: 5980.4,
          duration: 649.2,
          maneuver: { type: 'turn', instruction: 'Turn right onto MacArthur Highway.', modifier: 'right' },
        },
      ],
    }],
  }],
};

beforeEach(() => { clearRouteCache(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('directionsUrl', () => {
  it('asks Mapbox for a full GeoJSON driving route with turn steps', () => {
    const url = new URL(directionsUrl({ from: FROM, to: TO, token: TOKEN }));
    expect(url.origin + url.pathname).toBe(
      'https://api.mapbox.com/directions/v5/mapbox/driving-traffic/120.23,16.03;120.1,16.28',
    );
    expect(url.searchParams.get('geometries')).toBe('geojson');
    expect(url.searchParams.get('overview')).toBe('full');
    expect(url.searchParams.get('steps')).toBe('true');
    expect(url.searchParams.get('access_token')).toBe(TOKEN);
  });

  it('refuses to build a URL without a destination or token', () => {
    expect(directionsUrl({ from: FROM, to: null, token: TOKEN })).toBeNull();
    expect(directionsUrl({ from: FROM, to: TO, token: '' })).toBeNull();
  });
});

describe('normalizeRoute', () => {
  it('flattens leg steps into a readable turn list', () => {
    const route = normalizeRoute(MAPBOX_BODY);
    expect(route.coordinates).toHaveLength(3);
    expect(route.distanceM).toBeCloseTo(6400.4);
    expect(route.durationS).toBeCloseTo(745.2);
    expect(route.steps).toEqual([
      { instruction: 'Drive north on Judge Jose de Venecia Ave.', distanceM: 420, durationS: 96, maneuver: 'depart', modifier: 'straight' },
      { instruction: 'Turn right onto MacArthur Highway.', distanceM: 5980.4, durationS: 649.2, maneuver: 'turn', modifier: 'right' },
    ]);
  });

  it('returns null for a body with no routes', () => {
    expect(normalizeRoute({ routes: [] })).toBeNull();
    expect(normalizeRoute(null)).toBeNull();
  });
});

describe('fetchRoute', () => {
  it('returns the normalised route and reuses it for the same trip', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => MAPBOX_BODY }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchRoute({ from: FROM, to: TO, token: TOKEN });
    const second = await fetchRoute({ from: FROM, to: TO, token: TOKEN });

    expect(first.distanceM).toBeCloseTo(6400.4);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a readable error instead of rendering an empty route', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ message: 'Not Authorized' }) })));
    await expect(fetchRoute({ from: FROM, to: TO, token: TOKEN })).rejects.toThrow(/route/i);
  });

  it('does not cache a failed lookup', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchRoute({ from: FROM, to: TO, token: TOKEN })).rejects.toThrow();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => MAPBOX_BODY });
    await expect(fetchRoute({ from: FROM, to: TO, token: TOKEN })).resolves.toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('route labels', () => {
  it('reads like a driver expects', () => {
    expect(routeDistanceLabel(420)).toBe('420 m');
    expect(routeDistanceLabel(6400)).toBe('6.4 km');
    expect(routeDurationLabel(45)).toBe('1 min');
    expect(routeDurationLabel(745)).toBe('12 min');
    expect(routeDurationLabel(3900)).toBe('1 h 5 min');
  });
});
