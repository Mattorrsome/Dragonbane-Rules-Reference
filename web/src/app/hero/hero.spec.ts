import { formatDamageBonus, withAbilityCount } from './hero';

describe('withAbilityCount', () => {
  it('lowers a stacking ability and reports the change', () => {
    expect(withAbilityCount([{ name: 'Robust', count: 6 }], 'Robust', 4)).toEqual({ abilities: [{ name: 'Robust', count: 4 }], delta: -2 });
  });

  it('caps a non-stacking ability at 1', () => {
    expect(withAbilityCount([], 'Berserker', 3)).toEqual({ abilities: [{ name: 'Berserker', count: 1 }], delta: 1 });
  });

  it('removes at 0 and never goes below 0', () => {
    expect(withAbilityCount([{ name: 'Robust', count: 1 }], 'Robust', -3)).toEqual({ abilities: [], delta: -1 });
  });
});

describe('formatDamageBonus', () => {
  it('shows attribute and dice', () => {
    expect(formatDamageBonus({ attribute: 'AGL', dice: 'D4' })).toBe('AGL: D4');
  });
});
