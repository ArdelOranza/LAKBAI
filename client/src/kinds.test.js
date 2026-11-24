import { describe, it, expect } from 'vitest';
import { kindsOf } from './kinds.js';

const has = (place, kind) => kindsOf(place).includes(kind);

describe('kindsOf', () => {
  it('maps the curated vocabulary', () => {
    expect(has({ name: 'Patar Beach', categories: ['Beach'] }, 'beach')).toBe(true);
    expect(has({ name: 'Sungayan Grill', categories: ['Food', 'Dining'] }, 'restaurant')).toBe(true);
    expect(has({ name: 'CSI Stadia and Lifestyle Center', categories: ['Food'] }, 'restaurant')).toBe(true);
  });

  it('maps the dataset category vocabulary', () => {
    expect(has({ name: 'Dagupeña Restaurant', categories: ['Culinary, Public Market & Commercial Hub'] }, 'restaurant')).toBe(true);
    expect(has({ name: 'Kuya J', categories: ['Filipino & Seafood Family Dining'] }, 'restaurant')).toBe(true);
    expect(has({ name: 'Botejyu', categories: ['Italian, Pizza, Pasta & Western'] }, 'restaurant')).toBe(true);
    expect(has({ name: "Max's Restaurant", categories: ['Fast Food & Highway Transit Stops'] }, 'restaurant')).toBe(true);
    expect(has({ name: 'Sweet Corner', categories: ['Specialty Cafés, Bakeries & Milk Tea'] }, 'restaurant')).toBe(true);
    expect(has({ name: 'Cozy Place Resort', categories: ['Hotels, Resorts, Inns & Staycations'] }, 'hotel')).toBe(true);
    expect(has({ name: 'Aquatica Marina', categories: ['Resort, Waterpark & Staycation'] }, 'hotel')).toBe(true);
    expect(has({ name: 'Patar White Sand', categories: ['Beach & Coastal'] }, 'beach')).toBe(true);
    expect(has({ name: 'Hundred Islands', categories: ['Island & Marine Park'] }, 'beach')).toBe(true);
    expect(has({ name: 'Manaoag Basilica', categories: ['Religious & Pilgrimage Site'] }, 'church')).toBe(true);
  });

  it('reads the community submission vocabulary too', () => {
    expect(has({ name: 'Kapwa Garden Cafe', categories: ['Food'] }, 'restaurant')).toBe(true);
    expect(has({ name: 'Bolinao Homestay', categories: ['Stay'] }, 'hotel')).toBe(true);
    expect(has({ name: 'Tondol Shore', categories: ['Beach'] }, 'beach')).toBe(true);
  });

  it('keeps everything else honestly in Others', () => {
    expect(kindsOf({ name: 'Museum', categories: ['Historical, Museum & Cultural Heritage'] })).toEqual(['other']);
    expect(kindsOf({ name: 'Bolinao Falls', categories: ['Waterfall, Spring & River'] })).toEqual(['other']);
    expect(kindsOf({})).toEqual(['other']);
  });

  it('a place can answer more than one chip honestly', () => {
    const resort = { name: 'El Puerto Marina Beach Resort', categories: ['Resort'] };
    expect(kindsOf(resort)).toEqual(expect.arrayContaining(['hotel', 'beach']));
  });
});