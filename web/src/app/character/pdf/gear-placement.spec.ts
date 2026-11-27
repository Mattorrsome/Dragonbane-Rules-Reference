import { EquipmentItemDto } from '../../api/models';
import { ATTRIBUTES, Attribute } from '../../hero/hero';
import { Character, CreationReference, GearItem } from '../character';
import { creationRef } from '../character.fixture';
import { placeGear } from './gear-placement';

const item = (name: string, weight: string | null, extra: Partial<EquipmentItemDto> = {}) =>
  ({ name, weight, weapon: null, armour: null, ...extra }) as EquipmentItemDto;
const weapon = (name: string) => item(name, null, { weapon: { damage: 'D8' } as EquipmentItemDto['weapon'] });

const ref: CreationReference = {
  ...creationRef,
  equipment: [
    weapon('Dagger'), weapon('Staff'), weapon('Short sword'), weapon('Small shield'),
    item('Chainmail', null, { armour: { rating: 4, isHelmet: false } }),
    item('Open helmet', null, { armour: { rating: 1, isHelmet: true } }),
    item('Leather', null, { armour: { rating: 1, isHelmet: false } }),
    item('Great helm', null, { armour: { rating: 2, isHelmet: true } }),
    item('Field ration', '1/4'), item('Flint and tinder', '-'), item('Fishing net', '2'), item('Torch', '1'),
    item('Simple clothes', null), item('Donkey', null),
  ],
};

function withGear(...gear: [string, number?][]): Character {
  const attributes = Object.fromEntries(ATTRIBUTES.map(a => [a, 10])) as Record<Attribute, number>;
  return {
    name: 'Test', nickname: '', kin: 'Human', profession: 'Fighter', school: null, age: 'Adult', attributes,
    skills: [], abilities: [], kinAbilities: [], spells: [],
    gear: gear.map(([name, quantity = 1]): GearItem => ({ name, quantity, note: '' })),
    copper: 0, weakness: '', memento: '', appearance: '',
  };
}

describe('placeGear', () => {
  it('readies the first three weapons or shields and lists the fourth as overflow', () => {
    const placed = placeGear(withGear(['Dagger'], ['Staff'], ['Short sword'], ['Small shield']), ref);
    expect(placed.weapons.map(w => w.name)).toEqual(['Dagger', 'Staff', 'Short sword']);
    expect(placed.overflow).toEqual(['Small shield']);
  });

  it('counts up to four field rations as one row', () => {
    expect(placeGear(withGear(['Field ration', 5]), ref).inventory).toEqual(['5 × Field ration', '(Field ration)']);
  });

  it('puts weight "-" items under tiny items', () => {
    const placed = placeGear(withGear(['Flint and tinder']), ref);
    expect(placed.tiny).toEqual(['Flint and tinder']);
    expect(placed.inventory).toEqual([]);
  });

  it('wears the first armour and the first helmet', () => {
    const placed = placeGear(withGear(['Chainmail'], ['Open helmet']), ref);
    expect(placed.armour?.name).toBe('Chainmail');
    expect(placed.helmet?.name).toBe('Open helmet');
    expect(placed.inventory).toEqual([]);
  });

  it('gives a weight-2 item two rows', () => {
    expect(placeGear(withGear(['Fishing net'], ['Torch']), ref).inventory).toEqual(['Fishing net', '(Fishing net)', 'Torch']);
  });

  it('lists an item that no longer fits the ten rows as overflow', () => {
    const placed = placeGear(withGear(['Torch', 9], ['Fishing net']), ref);
    expect(placed.inventory.length).toBe(9);
    expect(placed.overflow).toEqual(['Fishing net']);
  });

  it('lists items with no weight at all (clothes, animals) as overflow, not tiny items', () => {
    const placed = placeGear(withGear(['Simple clothes'], ['Donkey']), ref);
    expect(placed.tiny).toEqual([]);
    expect(placed.overflow).toEqual(['Simple clothes', 'Donkey']);
  });

  it('readies three of a stack of weapons and lists the rest as one overflow entry', () => {
    const placed = placeGear(withGear(['Dagger', 5]), ref);
    expect(placed.weapons).toEqual(Array(3).fill({ name: 'Dagger', quantity: 1, note: '' }));
    expect(placed.overflow).toEqual(['2 × Dagger']);
  });

  it('lists a second armour and a second helmet as overflow', () => {
    const placed = placeGear(withGear(['Chainmail'], ['Open helmet'], ['Leather'], ['Great helm']), ref);
    expect([placed.armour?.name, placed.helmet?.name]).toEqual(['Chainmail', 'Open helmet']);
    expect(placed.overflow).toEqual(['Leather', 'Great helm']);
  });

  it('counts an item that is not in the Equipment table as weight 1 each', () => {
    expect(placeGear(withGear(['General herbs', 2]), ref).inventory).toEqual(['2 × General herbs', '(General herbs)']);
  });

  it('places nothing for a quantity of 0', () => {
    const placed = placeGear(withGear(['Torch', 0], ['Dagger', 0], ['General herbs', 0]), ref);
    expect([placed.inventory, placed.weapons, placed.overflow]).toEqual([[], [], []]);
  });
});
