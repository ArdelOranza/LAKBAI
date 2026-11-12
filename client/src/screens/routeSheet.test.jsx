// @vitest-environment happy-dom
// The Directions button must guide inside the app: Mapbox route, driving time,
// and a readable turn list — never a Google Maps tab.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const fetchRoute = vi.hoisted(() => vi.fn());

vi.mock('../directions.js', () => ({
  fetchRoute,
  routeDistanceLabel: m => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`),
  routeDurationLabel: s => `${Math.max(1, Math.round(s / 60))} min`,
}));
vi.mock('../staticMap.js', () => ({ mapboxToken: () => 'pk.test' }));

const routeProps = vi.hoisted(() => ({ routes: [], markers: [], centers: [], zooms: [] }));
vi.mock('@/components/ui/map', () => {
  const React2 = require('react');
  return {
    Map: ({ viewport, children }) => {
      routeProps.centers.push(viewport?.center);
      routeProps.zooms.push(viewport?.zoom);
      return React2.createElement('div', { 'data-testid': 'route-map' }, children);
    },
    MapRoute: ({ coordinates }) => {
      routeProps.routes.push(coordinates);
      return React2.createElement('div', { 'data-testid': 'route-line' });
    },
    MapMarker: ({ longitude, latitude, children }) => {
      routeProps.markers.push({ longitude, latitude });
      return React2.createElement('div', { 'data-marker': true }, children);
    },
    MarkerContent: ({ children }) => React2.createElement('div', null, children),
  };
});

import RouteSheet from './RouteSheet.jsx';

const PLACE = { id: 'p1', name: 'Patar White Sand Beach', lng: 119.89, lat: 16.32 };
const FROM = { lng: 120.23, lat: 16.03 };
const ROUTE = {
  coordinates: [[120.23, 16.03], [120.1, 16.2], [119.89, 16.32]],
  distanceM: 6400,
  durationS: 745,
  steps: [
    { instruction: 'Drive north on Judge Jose de Venecia Ave.', distanceM: 420, maneuver: 'depart', modifier: 'straight' },
    { instruction: 'Turn right onto MacArthur Highway.', distanceM: 5980, maneuver: 'turn', modifier: 'right' },
  ],
};

async function mount(props){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => { root.render(<RouteSheet {...props} />); });
  await React.act(async () => { await Promise.resolve(); });
  return { container, root };
}

beforeEach(() => {
  fetchRoute.mockReset();
  routeProps.routes.length = 0;
  routeProps.markers.length = 0;
  routeProps.centers.length = 0;
  routeProps.zooms.length = 0;
  document.body.innerHTML = '';
});

describe('RouteSheet', () => {
  it('draws the Mapbox route and lists the turns with drive time', async () => {
    fetchRoute.mockResolvedValue(ROUTE);
    const { container } = await mount({ place: PLACE, coords: FROM, hasFix: true, onClose: () => {} });

    expect(fetchRoute).toHaveBeenCalledTimes(1);
    expect(fetchRoute.mock.calls[0][0]).toMatchObject({ from: FROM, to: { lng: PLACE.lng, lat: PLACE.lat } });
    expect(container.querySelector('[data-testid="route-summary"]').textContent).toContain('12 min');
    expect(container.querySelector('[data-testid="route-summary"]').textContent).toContain('6.4 km');
    expect(routeProps.routes[0]).toHaveLength(3);
    const steps = container.querySelectorAll('[data-testid="route-step"]');
    expect(steps).toHaveLength(2);
    expect(steps[1].textContent).toContain('Turn right onto MacArthur Highway.');
    expect(steps[1].textContent).toContain('6.0 km');
    expect(container.querySelector('[data-testid="route-loading"]')).toBeNull();
  });

  it('closes from its own button', async () => {
    fetchRoute.mockResolvedValue(ROUTE);
    const onClose = vi.fn();
    const { container } = await mount({ place: PLACE, coords: FROM, hasFix: true, onClose });
    await React.act(async () => {
      container.querySelector('[data-testid="route-close"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a readable failure and retries instead of leaving a blank sheet', async () => {
    fetchRoute.mockRejectedValueOnce(new Error('Could not get a route — check your connection and try again.'));
    const { container } = await mount({ place: PLACE, coords: FROM, hasFix: true, onClose: () => {} });

    const error = container.querySelector('[data-testid="route-error"]');
    expect(error.textContent).toContain('check your connection');

    fetchRoute.mockResolvedValueOnce(ROUTE);
    await React.act(async () => {
      container.querySelector('[data-testid="route-retry"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await React.act(async () => { await Promise.resolve(); });

    expect(container.querySelector('[data-testid="route-error"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid="route-step"]')).toHaveLength(2);
  });

  it('asks for location instead of routing from the province fallback point', async () => {
    const { container } = await mount({ place: PLACE, coords: FROM, hasFix: false, onClose: () => {} });
    expect(fetchRoute).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="route-needs-fix"]').textContent).toMatch(/location/i);
  });
});

describe('RouteSheet live guidance', () => {
  const DEST = { id: 'p2', name: 'Dagupan Bangus Market', lng: 120.23, lat: 16.07 };
  const LIVE = {
    coordinates: [[120.23, 16.03], [120.23, 16.04], [120.23, 16.05], [120.23, 16.06], [120.23, 16.07]],
    distanceM: 4440,
    durationS: 600,
    steps: [
      { instruction: 'Head north on Judge Jose de Venecia Ave.', distanceM: 2220, maneuver: 'depart', modifier: 'straight' },
      { instruction: 'Turn right onto MacArthur Highway.', distanceM: 2220, maneuver: 'turn', modifier: 'right' },
    ],
  };
  const at = lat => ({ lng: 120.23, lat });

  it('pins the destination where the route ends, not the raw place point', async () => {
    fetchRoute.mockResolvedValue({
      coordinates: [[120.23, 16.03], [120.24, 16.05], [120.25, 16.06]],
      distanceM: 3000,
      durationS: 300,
      steps: [{ instruction: 'Head north.', distanceM: 3000, maneuver: 'depart', modifier: 'straight' }],
    });
    await mount({ place: { id: 'p3', name: 'Far Beach', lng: 120.3, lat: 16.1 }, coords: at(16.03), hasFix: true, onClose: () => {} });

    // Mapbox snaps to the nearest road; the pin must sit on that end point.
    expect(routeProps.markers.at(-1)).toEqual({ longitude: 120.25, latitude: 16.06 });
  });

  it('follows the blue dot and calls out the next turn as you drive', async () => {
    fetchRoute.mockResolvedValue(LIVE);
    const { container, root } = await mount({ place: DEST, coords: at(16.03), hasFix: true, onClose: () => {} });

    const turn = container.querySelector('[data-testid="nav-turn"]');
    expect(turn.textContent).toContain('Head north on Judge Jose de Venecia Ave.');
    expect(turn.textContent).toContain('in 2.2 km');
    // The map is centred on the traveler, not the whole province.
    expect(routeProps.centers.at(-1)).toEqual([120.23, 16.03]);
    expect(routeProps.zooms.at(-1)).toBeGreaterThan(14);

    await React.act(async () => { root.render(<RouteSheet place={DEST} coords={at(16.055)} hasFix onClose={() => {}}/>); });
    expect(container.querySelector('[data-testid="nav-turn"]').textContent).toContain('Turn right onto MacArthur Highway.');
    expect(container.querySelector('[data-testid="nav-turn"]').textContent).toContain('in 1.7 km');
    expect(container.querySelector('[data-testid="route-summary"]').textContent).toContain('4 min');
    expect(routeProps.centers.at(-1)).toEqual([120.23, 16.055]);

    await React.act(async () => { root.render(<RouteSheet place={DEST} coords={at(16.07)} hasFix onClose={() => {}}/>); });
    expect(container.querySelector('[data-testid="nav-arrived"]').textContent).toMatch(/arrived/i);

    await React.act(async () => root.unmount());
    container.remove();
  });

  it('shows only the turns still ahead', async () => {
    fetchRoute.mockResolvedValue(LIVE);
    const { container, root } = await mount({ place: DEST, coords: at(16.055), hasFix: true, onClose: () => {} });

    const steps = container.querySelectorAll('[data-testid="route-step"]');
    expect(steps).toHaveLength(1);
    expect(steps[0].textContent).toContain('Turn right onto MacArthur Highway.');
    expect(steps[0].className).toContain('is-next');

    await React.act(async () => root.unmount());
    container.remove();
  });
});
