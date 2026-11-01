import { describe, it, expect } from 'vitest';
import { normalizeName, matchSpot, mapThumb, cardFor } from './chatCards.js';

const SPOTS = [
  { id: 'giant-sungayan-grill-bolinao', name: 'Giant Sungayan Grill', town: 'Bolinao', lng: 119.869, lat: 16.302, categories: ['Food', 'Dining'], photos: [] },
  { id: 'patar-beach-bolinao', name: 'Patar Beach', town: 'Bolinao', lng: 119.799, lat: 16.339, categories: ['Beaches'], photos: ['/photos/patar.jpg'] },
];

describe('normalizeName', () => {
  it('ignores case, accents-ish punctuation and extra spaces', () => {
    expect(normalizeName("  Giant  Sungayan Grill! ")).toBe('giant sungayan grill');
  });
});

describe('matchSpot', () => {
  it('matches an exact name regardless of case', () => {
    expect(matchSpot('giant sungayan grill', SPOTS).id).toBe('giant-sungayan-grill-bolinao');
  });

  it('matches when the AI shortens or pads the name', () => {
    expect(matchSpot('Sungayan Grill', SPOTS).id).toBe('giant-sungayan-grill-bolinao');
    expect(matchSpot('Giant Sungayan Grill, Bolinao', SPOTS).id).toBe('giant-sungayan-grill-bolinao');
  });

  it('returns null for places we have no record of', () => {
    expect(matchSpot('Somewhere Else', SPOTS)).toBeNull();
    expect(matchSpot('', SPOTS)).toBeNull();
  });
});

describe('mapThumb', () => {
  it('builds a Mapbox static map with a pin at the coords', () => {
    const url = mapThumb(119.869, 16.302, 'pk.test');
    expect(url).toContain('/styles/v1/mapbox/streets-v12/static/');
    expect(url).toContain('pin-s+0066FF(119.869,16.302)');
    expect(url).toContain('/600x340@2x');
    expect(url).toContain('access_token=pk.test');
  });

  it('returns null without a token or coordinates', () => {
    expect(mapThumb(119.869, 16.302, '')).toBeNull();
    expect(mapThumb(null, 16.302, 'pk.test')).toBeNull();
    expect(mapThumb(119.869, undefined, 'pk.test')).toBeNull();
  });
});

describe('cardFor', () => {
  it('merges the AI candidate with the curated spot', () => {
    const card = cardFor({ name: 'Giant Sungayan Grill', hint: 'Bolinao', rating: '4.8', description: 'Floating restaurant.' }, SPOTS);
    expect(card).toMatchObject({
      name: 'Giant Sungayan Grill',
      hint: 'Bolinao',
      rating: 4.8,
      description: 'Floating restaurant.',
      lng: 119.869,
      lat: 16.302,
      tags: ['Food', 'Dining'],
      photo: null,
    });
  });

  it('uses the spot photo when one exists', () => {
    const card = cardFor({ name: 'Patar Beach' }, SPOTS);
    expect(card.photo).toBe('/photos/patar.jpg');
    expect(card.hint).toBe('Bolinao');
  });

  it('drops ratings the AI made up as an empty string', () => {
    const card = cardFor({ name: 'Patar Beach', rating: '' }, SPOTS);
    expect(card.rating).toBeNull();
  });

  it('still renders a card for a place with no curated record', () => {
    const card = cardFor({ name: 'Mystery Eatery', hint: 'Dagupan', description: 'A stop.' }, SPOTS);
    expect(card.name).toBe('Mystery Eatery');
    expect(card.lng).toBeUndefined();
    expect(card.tags).toEqual([]);
    expect(card.id).toBe('mystery eatery');
  });

  it('keeps fees and festival only when the model stated them', () => {
    const withFees = cardFor({ name: 'Patar Beach', fees: ' ₱60 eco fee ' }, SPOTS);
    expect(withFees.fees).toBe('₱60 eco fee');
    expect(withFees.festival).toBe('');

    const withFestival = cardFor({ name: 'Patar Beach', festival: 'Binongey Festival' }, SPOTS);
    expect(withFestival.festival).toBe('Binongey Festival');
  });
});