import { EquipmentCategoryDto, EquipmentItemDto, HeroicAbilityDto, SpellDto, SpellKind } from '../api/models';
import { abilityGroups, gearDescription, gearGroups, spellGroups } from './picker-groups';

const spell = (name: string, school: string, kind: SpellKind, rank: number): SpellDto => ({
  id: 1, name, schoolId: 1, school, rank, kind, castingTime: 'Action', requirementText: 'Word', description: 'Does a thing.',
  ranked: { prerequisite: 'None', range: '10 metres', duration: 'Round' }, recipe: null,
} as SpellDto);

const SPELLS = [
  spell('FIREBALL', 'Elementalism', 'Spell', 2),
  spell('Ignite', 'Elementalism', 'Trick', 0),
  spell('FROST', 'Elementalism', 'Spell', 1),
  spell('ALARM', 'General Magic', 'Spell', 1),
  spell('BONFIRE', 'Elementalism', 'Spell', 1),
];

const item = (id: number, categoryId: number, name: string, extra: Partial<EquipmentItemDto> = {}): EquipmentItemDto => ({
  id, categoryId, name, costCopper: 1, costUnit: null, costOrMore: false, costText: '1 silver', supply: null, weight: null,
  effect: null, weapon: null, armour: null, ...extra,
} as EquipmentItemDto);

const cat = (id: number, name: string) => ({ id, name } as EquipmentCategoryDto);

describe('spellGroups', () => {
  const groups = spellGroups(SPELLS, [{ name: 'FROST', school: 'Elementalism', kind: 'Spell' }]);

  it('makes a group per school in first-seen order', () => {
    expect(groups.map(g => g.heading)).toEqual(['Elementalism', 'General Magic']);
  });

  it('orders tricks, then rank, then name', () => {
    expect(groups[0].items.map(i => i.label)).toEqual(['Ignite (trick)', 'Bonfire (rank 1)', 'Frost (rank 1)', 'Fireball (rank 2)']);
  });

  it('marks known spells and describes them', () => {
    expect(groups[0].items.filter(i => i.added).map(i => i.label)).toEqual(['Frost (rank 1)']);
    expect(groups[0].items[0].id).toBe('Ignite (Elementalism, trick)');
    expect(groups[0].items[0].description).toBe('Casting time: Action · Range: 10 metres · Duration: Round · Requirement: Word\n\nDoes a thing.');
  });

  it('labels recipes', () => {
    expect(spellGroups([spell('TONIC', 'Alchemy', 'Recipe', 1)], [])[0].items[0].label).toBe('Tonic (recipe)');
  });
});

describe('abilityGroups', () => {
  const ab = (name: string, prerequisite: string): HeroicAbilityDto => ({ id: 1, name, prerequisite, wp: '3', effect: 'Effect.' });
  const [group] = abilityGroups([ab('Veteran', 'Any weapon skill 12'), ab('Robust', 'None')], ['robust']);

  it('is one alphabetical group', () => {
    expect(group.heading).toBe('Heroic abilities');
    expect(group.items.map(i => i.id)).toEqual(['Robust', 'Veteran']);
  });

  it('marks known abilities and leaves out a None prerequisite', () => {
    expect(group.items.map(i => i.added)).toEqual([true, false]);
    expect(group.items[0].description).toBe('WP: 3\n\nEffect.');
    expect(group.items[1].description).toBe('Prerequisite: Any weapon skill 12 · WP: 3\n\nEffect.');
  });
});

describe('gearGroups', () => {
  const equipment = [item(1, 2, 'Rope'), item(2, 1, 'Sword'), item(3, 1, 'Axe'), item(4, 2, 'Torch')];
  const groups = gearGroups(equipment, [cat(1, 'Weapons'), cat(2, 'Gear'), cat(3, 'Empty')], ['axe']);

  it('follows category order, keeps source order and drops empty groups', () => {
    expect(groups.map(g => g.heading)).toEqual(['Weapons', 'Gear']);
    expect(groups[0].items.map(i => i.id)).toEqual(['Sword', 'Axe']);
  });

  it('marks carried items', () => {
    expect(groups[0].items.map(i => i.added)).toEqual([false, true]);
  });
});

describe('gearDescription', () => {
  it('gives cost, weight and effect', () => {
    expect(gearDescription(item(1, 1, 'Rope', { weight: '1', effect: 'Strong.' }))).toBe('Cost 1 silver · Weight 1 · Strong.');
  });

  it('adds grip, range and durability for a weapon', () => {
    const sword = item(1, 1, 'Sword', {
      weapon: { grip: '1H', strRequirement: null, range: '1', damage: '2D6', durability: 12, isRanged: false, featuresText: 'Bludgeon', skill: 'Swords' },
    });
    expect(gearDescription(sword)).toBe('Cost 1 silver · Damage 2D6, bludgeon · Grip 1H · Range 1 · Durability 12');
  });
});
