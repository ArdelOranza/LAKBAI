import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { project, municipalityAt, PROVINCE_BOX, MAP_BOX, MAP_VIEWBOX } from './pangasinanMap.js';
import { PANGASINAN_PATHS } from './pangasinanPaths.js';
import PangasinanMap from './PangasinanMap.jsx';

describe('project', () => {
  it('maps the province corners onto the drawing box', () => {
    const west = project(PROVINCE_BOX.west, PROVINCE_BOX.north);
    expect(west.x).toBeCloseTo(MAP_BOX.x0, 6);
    expect(west.y).toBeCloseTo(MAP_BOX.y0, 6);

    const east = project(PROVINCE_BOX.east, PROVINCE_BOX.south);
    expect(east.x).toBeCloseTo(MAP_BOX.x1, 6);
    expect(east.y).toBeCloseTo(MAP_BOX.y1, 6);
  });
});

describe('municipalityAt', () => {
  it('finds the shape for well-known towns', () => {
    const lingayen = municipalityAt(120.2319, 16.0218);
    const dagupan = municipalityAt(120.3333, 16.0433);
    const tayug = municipalityAt(120.7478, 16.0267);
    expect(lingayen).toBeGreaterThanOrEqual(0);
    expect(dagupan).toBeGreaterThanOrEqual(0);
    expect(tayug).toBeGreaterThanOrEqual(0);
    expect(new Set([lingayen, dagupan, tayug]).size).toBe(3);
  });

  it('still resolves a poblacion that sits on a simplified coastline', () => {
    // Bolinao's town proper is right on the cape; the source boundary is low-res.
    expect(municipalityAt(119.8922, 16.3883)).toBeGreaterThanOrEqual(0);
  });

  it('returns -1 away from Pangasinan', () => {
    expect(municipalityAt(120.98, 14.6)).toBe(-1); // Manila
    expect(municipalityAt(121.5, 18.0)).toBe(-1); // open sea / Luzon north
  });

  it('returns -1 without a usable fix', () => {
    expect(municipalityAt(undefined, 16)).toBe(-1);
    expect(municipalityAt(120.2, NaN)).toBe(-1);
  });

  it('has a shape for every path in the drawing', () => {
    expect(PANGASINAN_PATHS).toHaveLength(48);
    expect(MAP_VIEWBOX.split(' ')).toHaveLength(4);
  });
});

describe('PangasinanMap', () => {
  it('draws the province flat and highlights exactly one municipality', () => {
    const html = renderToString(<PangasinanMap coords={{ lng: 120.2319, lat: 16.0218 }}/>);
    expect(html.match(/<path/g)).toHaveLength(48);
    expect(html.match(/pm-shape on/g)).toHaveLength(1);
    expect(html).toContain('pm-pin-dot');
  });

  it('draws no highlight and no pin when the fix is elsewhere', () => {
    const html = renderToString(<PangasinanMap coords={{ lng: 120.98, lat: 14.6 }}/>);
    expect(html).not.toContain('pm-shape on');
    expect(html).not.toContain('pm-pin');
  });
});