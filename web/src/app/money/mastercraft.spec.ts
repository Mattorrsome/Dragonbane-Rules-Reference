import { EquipmentItemDto } from '../api/models';
import { mastercraft, mastercraftedItem } from './mastercraft';

const battleaxe: EquipmentItemDto = {
  id: 19, categoryId: 1, name: 'Battleaxe', costCopper: 1000, costUnit: null, costOrMore: false, costText: '10 gold', supply: 'Uncommon',
  weight: null, effect: null, armour: null,
  weapon: { grip: '1H', strRequirement: 13, range: '2', damage: '2D8', durability: 9, isRanged: false, featuresText: 'Toppling, slashing', skill: 'Axes' },
};

describe('mastercraftedItem', () => {
  it('swaps cost, STR and durability and keeps the rest', () => {
    const mc = mastercraftedItem(battleaxe);

    expect(mc.costCopper).toBe(10000);
    expect(mc.weapon?.strRequirement).toBe(10);
    expect(mc.weapon?.durability).toBe(12);
    expect(mc.name).toBe('Battleaxe');
    expect(mc.weapon?.damage).toBe('2D8');
  });

  it('does not change the input', () => {
    mastercraftedItem(battleaxe);

    expect(battleaxe.costCopper).toBe(1000);
    expect(battleaxe.weapon?.strRequirement).toBe(13);
  });

  it('drops an STR requirement that falls to zero', () => {
    expect(mastercraftedItem({ ...battleaxe, weapon: { ...battleaxe.weapon!, strRequirement: 3 } }).weapon?.strRequirement).toBeNull();
  });

  it('returns an item without a weapon unchanged', () => {
    const rope = { ...battleaxe, weapon: null };

    expect(mastercraftedItem(rope)).toBe(rope);
  });
});

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
