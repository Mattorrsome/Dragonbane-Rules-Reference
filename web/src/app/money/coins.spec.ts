import { formatCoins, toDisplayCopper } from './coins';

const r = { copper: 1, silver: 10, gold: 100 };

describe('formatCoins', () => {
  it('shows a single coin', () => {
    expect(formatCoins(1255, 'copper', r)).toBe('1255 copper');
  });

  it('breaks down into the standard and smaller coins', () => {
    expect(formatCoins(1255, 'silver', r)).toBe('125 silver 5 copper');
    expect(formatCoins(1255, 'gold', r)).toBe('12 gold 5 silver 5 copper');
  });

  it('omits zero denominations', () => {
    expect(formatCoins(1205, 'gold', r)).toBe('12 gold 5 copper');
  });

  it('treats written as gold', () => {
    expect(formatCoins(1200, 'written', r)).toBe('12 gold');
  });

  it('uses the fetched rates, not constants', () => {
    expect(formatCoins(1200, 'gold', { copper: 1, silver: 20, gold: 200 })).toBe('6 gold');
  });
});

describe('toDisplayCopper', () => {
  it('floors', () => {
    expect(toDisplayCopper(301.2)).toBe(301);
    expect(toDisplayCopper(301.9)).toBe(301);
  });

  it('never shows less than 1 copper', () => {
    expect(toDisplayCopper(0.1)).toBe(1);
  });
});
