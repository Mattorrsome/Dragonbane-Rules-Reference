import { toDisplayCopper } from './coins';
import { BASE_PRICE, formatPrice, isBasePrice, quote } from './pricing';

const r = { copper: 1, silver: 10, gold: 100 };
const teacher = { costText: '5 gold/shift or more', costUnit: '/shift', costOrMore: true };

describe('quote', () => {
  it('returns the base price unchanged', () => {
    expect(quote(1200, true, BASE_PRICE)).toBe(1200);
  });

  it('applies the sell rate', () => {
    expect(quote(1200, true, { mode: 'sell', sellRate: 50, barter: 'none' })).toBe(600);
  });

  it('applies sell rate then barter without rounding', () => {
    expect(quote(1255, true, { mode: 'sell', sellRate: 20, barter: 'success' })).toBeCloseTo(301.2);
  });

  it('ignores the sell rate when buying', () => {
    expect(quote(1200, true, { mode: 'buy', sellRate: 10, barter: 'success' })).toBe(960);
  });

  it('halves a purchase and doubles a sale on a dragon', () => {
    expect(quote(1200, true, { mode: 'buy', sellRate: 100, barter: 'dragon' })).toBe(600);
    expect(quote(1200, true, { mode: 'sell', sellRate: 100, barter: 'dragon' })).toBe(2400);
  });

  it('has no price without a base cost', () => {
    expect(quote(null, true, BASE_PRICE)).toBeNull();
  });

  it('cannot sell what cannot be resold', () => {
    expect(quote(50, false, { mode: 'sell', sellRate: 100, barter: 'none' })).toBeNull();
    expect(quote(50, false, BASE_PRICE)).toBe(50);
  });

  it('quote floors only at display, minimum 1', () => {
    expect(toDisplayCopper(quote(1, true, { mode: 'sell', sellRate: 10, barter: 'none' })!)).toBe(1);
    expect(toDisplayCopper(quote(1, true, { mode: 'sell', sellRate: 10, barter: 'success' })!)).toBe(1);
    expect(toDisplayCopper(301.2)).toBe(301);
  });
});

describe('isBasePrice', () => {
  it('is true only for buying without bartering', () => {
    expect(isBasePrice(BASE_PRICE)).toBe(true);
    expect(isBasePrice({ mode: 'buy', sellRate: 50, barter: 'none' })).toBe(true);
    expect(isBasePrice({ mode: 'buy', sellRate: 100, barter: 'success' })).toBe(false);
    expect(isBasePrice({ mode: 'sell', sellRate: 100, barter: 'none' })).toBe(false);
  });
});

describe('formatPrice', () => {
  it('formatPrice keeps unit and or-more', () => {
    const options = { mode: 'sell', sellRate: 50, barter: 'dragon' } as const;
    expect(formatPrice(quote(500, true, options), 'gold', r, teacher, false)).toBe('5 gold/shift or more');
    expect(formatPrice(500, 'written', r, teacher, true)).toBe('5 gold/shift or more');
    expect(formatPrice(250, 'written', r, teacher, false)).toBe('2 gold 5 silver/shift or more');
    expect(formatPrice(60, 'silver', r, { costText: '6 silver x potency', costUnit: ' x potency', costOrMore: false }, false))
      .toBe('6 silver x potency');
  });

  it('formatPrice shows dash for null', () => {
    expect(formatPrice(null, 'gold', r, teacher, true)).toBe('—');
  });
});
