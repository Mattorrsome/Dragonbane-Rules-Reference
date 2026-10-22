import { mastercraft } from './mastercraft';

describe('mastercraft', () => {
  it('costs ten times, lowers STR by 3 and raises durability by 3', () => {
    expect(mastercraft({ costCopper: 1000, strRequirement: 13, durability: 9 })).toEqual({ costCopper: 10000, strRequirement: 10, durability: 12 });
  });

  it('keeps a missing STR requirement missing (Dagger)', () => {
    expect(mastercraft({ costCopper: 100, strRequirement: null, durability: 9 })).toEqual({ costCopper: 1000, strRequirement: null, durability: 12 });
  });

  it('keeps missing durability missing (Flail)', () => {
    expect(mastercraft({ costCopper: 1600, strRequirement: 13, durability: null }).durability).toBeNull();
  });

  it('drops an STR requirement that falls to zero or below', () => {
    expect(mastercraft({ costCopper: 10, strRequirement: 3, durability: 9 }).strRequirement).toBeNull();
  });
});
