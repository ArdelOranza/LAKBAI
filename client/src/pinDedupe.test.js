import { describe, it, expect } from 'vitest';
import { pinTokens, samePlace, mergePins } from './pinDedupe.js';

// Coordinates from the live catalogue: the curated spot and the imported
// dataset row for the same building sit ~50-130 m apart, so both got a pin.
const urdanetaDataset = { id: 'pangasinan-053', name: 'Cathedral of Our Lady of the Immaculate Conception (Urdaneta Cathedral)', lng: 120.5673, lat: 15.9736 };
const urdanetaSpot = { id: 'cathedral-urdaneta', name: 'Cathedral of Our Lady of the Immaculate Conception', lng: 120.567, lat: 15.974 };
const manaoagDataset = { id: 'pangasinan-029', name: 'The Minor Basilica of Our Lady of the Rosary of Manaoag', lng: 120.489, lat: 16.043 };
const manaoagSpot = { id: 'manaoag-church', name: 'Manaoag Church (Minor Basilica of Our Lady of Manaoag)', lng: 120.488, lat: 16.044 };

describe('pinTokens', () => {
  it('drops the words that say what the place is, keeps the ones that say which', () => {
    expect(pinTokens('Cathedral of Our Lady of the Immaculate Conception (Urdaneta Cathedral)'))
      .toEqual(['our', 'lady', 'immaculate', 'conception', 'urdaneta']);
    expect(pinTokens('KFC - SM City Rosales')).toEqual(['kfc', 'rosales']);
    expect(pinTokens('')).toEqual([]);
  });
});

describe('samePlace', () => {
  it('sees one cathedral behind two spellings of its name', () => {
    expect(samePlace(urdanetaDataset, urdanetaSpot)).toBe(true);
  });

  it('sees one basilica behind the dataset name and the curated name', () => {
    expect(samePlace(manaoagDataset, manaoagSpot)).toBe(true);
  });

  it('keeps the tenants of one mall apart — same coordinate, different business', () => {
    const kfc = { name: 'KFC - SM City Rosales', lng: 120.6026, lat: 15.8782 };
    const kuyaJ = { name: 'Kuya J Restaurant - SM City Rosales', lng: 120.6026, lat: 15.8782 };
    expect(samePlace(kfc, kuyaJ)).toBe(false);
  });

  it('keeps two branches of one chain apart when the names differ', () => {
    const mall = { name: "McDonald's - SM City Rosales", lng: 120.6026, lat: 15.8782 };
    const highway = { name: "McDonald's Carmen Rosales (24/7 Drive-Thru)", lng: 120.6046, lat: 15.8792 };
    expect(samePlace(mall, highway)).toBe(false);
  });

  it('never merges two numbered falls', () => {
    const one = { name: 'Bolinao Falls 1', lng: 119.9, lat: 16.3 };
    const two = { name: 'Bolinao Falls 2', lng: 119.9005, lat: 16.3005 };
    expect(samePlace(one, two)).toBe(false);
  });

  it('merges the same numbered fall from the two layers', () => {
    const dataset = { name: 'Bolinao Falls 2', lng: 119.9, lat: 16.3 };
    const spot = { name: 'Bolinao Falls 2', lng: 119.9005, lat: 16.3005 };
    expect(samePlace(dataset, spot)).toBe(true);
  });

  it('merges a spelling the scrape squeezed together', () => {
    const dataset = { name: 'Balungao Hilltop Adventure and Hot Spring (Mt. Balungao Hot and Cold Springs Resort)', lng: 120.69, lat: 15.9111 };
    const spot = { name: 'Balungao Hilltop Adventure and Hotspring', lng: 120.6905, lat: 15.9113 };
    expect(samePlace(dataset, spot)).toBe(true);
  });

  it('merges one place with a short modifier, not with a second subject', () => {
    const house = { name: 'Urduja House', lng: 120.231, lat: 16.02 };
    const grounds = { name: 'Urduja House Grounds', lng: 120.2315, lat: 16.0203 };
    // The basilica (120.489, 16.043) and its museum (120.488, 16.044) are
    // 128 m apart in the live catalogue, not one building.
    const museum = { name: 'Our Lady of Manaoag Museum & Souvenir Center', lng: 120.488, lat: 16.044 };
    const church = { name: 'Manaoag', lng: 120.489, lat: 16.0435 };
    expect(samePlace(house, grounds)).toBe(true);
    expect(samePlace(church, museum)).toBe(false);
  });

  it('merges a one-word spot with the viewpoint that carries its name', () => {
    const spot = { name: 'Malico', lng: 120.584, lat: 15.911 };
    const dataset = { name: 'Malico Rock View San Nicolas / Malico Viewpoint', lng: 120.5844, lat: 15.9113 };
    expect(samePlace(spot, dataset)).toBe(true);
    const far = { name: 'Malico Rock View San Nicolas / Malico Viewpoint', lng: 120.59, lat: 15.92 };
    expect(samePlace(spot, far)).toBe(false);
  });

  it('never merges places that are far apart, however they are named', () => {
    const here = { name: 'Patar Beach', lng: 119.79, lat: 16.32 };
    const elsewhere = { name: 'Patar Beach', lng: 120.4, lat: 16.0 };
    expect(samePlace(here, elsewhere)).toBe(false);
  });

  it('never merges a place with no usable coordinate', () => {
    expect(samePlace({ name: 'Patar Beach', lng: null, lat: null }, { name: 'Patar Beach', lng: 119.79, lat: 16.32 })).toBe(false);
  });

  it('never lets a town plaza swallow the restaurants around it', () => {
    // Live defect in the first cut: "Urdaneta City Plaza" reduces to the word
    // "Urdaneta", so it matched every restaurant in Urdaneta City and deleted
    // their pins. A single identifying word needs a matching kind of place.
    const plaza = { name: 'Urdaneta City Plaza', town: 'Urdaneta City', lng: 120.571, lat: 15.976 };
    const grill = { name: 'Uson Pigar Pigar Urdaneta City', town: 'Urdaneta City', lng: 120.5711, lat: 15.9761 };
    const cafe = { name: 'Unwnd Cafe - Urdaneta', town: 'Urdaneta City', lng: 120.5705, lat: 15.9755 };
    expect(samePlace(plaza, grill)).toBe(false);
    expect(samePlace(plaza, cafe)).toBe(false);
  });
});

describe('mergePins', () => {
  it('keeps the curated spot and drops the dataset twin it already shows', () => {
    const out = mergePins({
      spots: [urdanetaSpot],
      rec: [urdanetaDataset, { id: 'other', name: 'Urdaneta City Plaza', lng: 120.576, lat: 15.976 }],
      discover: [],
    });
    expect(out.spots.map(p => p.id)).toEqual(['cathedral-urdaneta']);
    expect(out.rec.map(p => p.id)).toEqual(['other']);
  });

  it('drops a Mapbox discovery that the dataset already pins', () => {
    const out = mergePins({
      spots: [],
      rec: [manaoagDataset],
      discover: [{ id: 'box:1', name: 'Manaoag Church', lng: 120.4889, lat: 16.0431 }],
    });
    expect(out.discover).toEqual([]);
    expect(out.rec.map(p => p.id)).toEqual(['pangasinan-029']);
  });

  it('never drops a mall tenant for the mall-mate next to it', () => {
    const out = mergePins({
      spots: [
        { id: 'kfc', name: 'KFC - SM City Rosales', lng: 120.6026, lat: 15.8782 },
        { id: 'kuya', name: 'Kuya J Restaurant - SM City Rosales', lng: 120.6026, lat: 15.8782 },
      ],
    });
    expect(out.spots.map(p => p.id)).toEqual(['kfc', 'kuya']);
  });

  it('refuses to pin anything without a real coordinate', () => {
    const out = mergePins({ rec: [{ name: 'Alaminos City', lng: null, lat: null }] });
    expect(out.rec).toEqual([]);
  });
});