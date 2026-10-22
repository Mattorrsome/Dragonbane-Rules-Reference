import { TestBed } from '@angular/core/testing';
import { CoinStandardStore } from './coin-standard.store';

const KEY = 'dragonbane.coinStandard';

describe('CoinStandardStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  const fresh = () => {
    TestBed.resetTestingModule();
    return TestBed.inject(CoinStandardStore);
  };

  it('defaults to gold', () => {
    expect(fresh().standard()).toBe('gold');
  });

  it('persists and restores the choice', () => {
    fresh().set('silver');

    expect(localStorage.getItem(KEY)).toBe('silver');
    expect(fresh().standard()).toBe('silver');
  });

  it('CoinStandardStore survives throwing storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });

    const store = fresh();
    expect(store.standard()).toBe('gold');
    expect(() => store.set('copper')).not.toThrow();
    expect(store.standard()).toBe('copper');
  });

  it('ignores an invalid stored value', () => {
    localStorage.setItem(KEY, 'platinum');

    expect(fresh().standard()).toBe('gold');
  });
});
