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
    item('Field ration', '1/4'), item('Flint and tinder', '-'), item('Fishing net', '2'), item('Torch', '1'),
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
});
