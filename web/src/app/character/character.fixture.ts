import { GearEntryDto, GearPackageDto, MagicSchoolDto, ProfessionDto, SkillDto, SpellDto, SpellKind } from '../api/models';
import { CreationReference } from './character';

// Real values from the API (Dragonbane_Character_Creation.md and the Spell Tables), trimmed to what the tests need.

const item = (...options: string[]): GearEntryDto => ({ kind: 'Item', quantity: 1, diceCount: null, diceSides: null, options });
const dice = (name: string, sides: number): GearEntryDto => ({ kind: 'Item', quantity: 1, diceCount: 1, diceSides: sides, options: [name] });
const silver = (sides: number): GearEntryDto => ({ kind: 'Silver', quantity: 1, diceCount: 1, diceSides: sides, options: [] });
const pkg = (rollFrom: number, rollTo: number, ...entries: GearEntryDto[]): GearPackageDto => ({ rollFrom, rollTo, entries });
const torch = item('Torch');
const flint = item('Flint and tinder');

const skill = (name: string, type: string, attribute: string): SkillDto =>
  ({ id: 0, name, type, typeId: 0, attribute, attributeNote: null, description: '' });

const SKILLS: SkillDto[] = [
  ...[['Acrobatics', 'AGL'], ['Awareness', 'INT'], ['Bartering', 'CHA'], ['Beast Lore', 'INT'], ['Bluffing', 'CHA'],
    ['Bushcraft', 'INT'], ['Crafting', 'STR'], ['Evade', 'AGL'], ['Healing', 'INT'], ['Hunting and Fishing', 'AGL'],
    ['Languages', 'INT'], ['Myths and Legends', 'INT'], ['Performance', 'CHA'], ['Persuasion', 'CHA'], ['Riding', 'AGL'],
    ['Seamanship', 'INT'], ['Sleight of Hand', 'AGL'], ['Sneaking', 'AGL'], ['Spot Hidden', 'INT'], ['Swimming', 'AGL'],
  ].map(([n, a]) => skill(n, 'Core', a)),
  ...[['Axes', 'STR'], ['Bows', 'AGL'], ['Brawling', 'STR'], ['Crossbows', 'AGL'], ['Hammers', 'STR'], ['Knives', 'AGL'],
    ['Slings', 'AGL'], ['Spears', 'STR'], ['Staves', 'AGL'], ['Swords', 'STR']].map(([n, a]) => skill(n, 'Weapon', a)),
  ...['Animism', 'Demonology', 'Elementalism', 'Illusionism', 'Mentalism', 'Necromancy', 'Symbolism', 'Witchcraft', 'Alchemy',
    'Enchanting', 'Dracomancy'].map(n => skill(n, 'Secondary', 'INT')),
  skill('Harmonism', 'Secondary', 'CHA'),
];

let spellId = 0;
const spells = (school: string, rank: number, kind: SpellKind, ...names: string[]): SpellDto[] =>
  names.map(name => ({
    id: ++spellId, name, schoolId: 0, school, rank, kind, castingTime: '', requirementText: '', description: '', ranked: null, recipe: null,
  }));

const SPELLS: SpellDto[] = [
  ...spells('General Magic', 1, 'Spell', 'ALARM', 'DISPEL', 'PROTECTOR'),
  ...spells('General Magic', 0, 'Trick', 'Fetch', 'Flick', 'Light', 'Open/Close'),
  ...spells('Animism', 1, 'Spell', 'ANIMAL WHISPERER', 'BANISH', 'CURE', 'ENSNARING ROOTS'),
  ...spells('Animism', 0, 'Trick', 'Birdsong', 'Clean', 'Cook Food'),
  ...spells('Elementalism', 1, 'Spell', 'FIREBALL', 'FROST', 'GUST OF WIND'),
  ...spells('Elementalism', 2, 'Spell', 'FIRE BLAST'),
  ...spells('Elementalism', 0, 'Trick', 'Heat/Chill', 'Ignite', 'Puff of Smoke'),
  ...spells('Harmonism', 1, 'Spell', 'INSPIRE', 'MEND', 'PROTECTIVE HARMONIES'),
  ...spells('Harmonism', 2, 'Spell', 'DOUBT'),
  ...spells('Harmonism', 0, 'Trick', 'Luring Song', 'Magical Melody', 'Voice Distortion'),
  ...spells('Alchemy', 1, 'Recipe', 'FOCUS TONIC', 'HERBAL CONCOCTION', 'INVIGORATING DECOCTION', 'LIQUID COURAGE'),
  ...spells('Alchemy', 2, 'Recipe', 'ANTIDOTE'),
  ...spells('Enchanting', 1, 'Spell', 'CONCEALING', 'FARSHOT', 'KEEN EDGE', 'LUMINOUS'),
  ...spells('Enchanting', 2, 'Spell', 'BANE WEAPON'),
];

const school = (name: string, startingSkills: string[], over: Partial<MagicSchoolDto> = {}): MagicSchoolDto => ({
  id: 0, name, description: '', note: null, skill: startingSkills[0] ?? null, startingSkills,
  requiredProfession: 'Mage', requiredSkill: null, requiredSkillLevel: null, choosableAtCreation: true, extras: [], ...over,
});

const SCHOOLS: MagicSchoolDto[] = [
  school('General Magic', [], { requiredProfession: null, choosableAtCreation: false }),
  school('Animism', ['Animism', 'Beast Lore', 'Bushcraft', 'Evade', 'Healing', 'Hunting and Fishing', 'Sneaking', 'Staves']),
  school('Elementalism', ['Elementalism', 'Awareness', 'Evade', 'Healing', 'Languages', 'Myths and Legends', 'Spot Hidden', 'Staves']),
  school('Harmonism', [], {
    requiredProfession: 'Bard', requiredSkill: 'Performance', requiredSkillLevel: 12, extras: [pkg(0, 0, item('Grimoire'))],
  }),
  school('Alchemy', ['Alchemy', 'Bartering', 'Beast Lore', 'Bushcraft', 'Healing', 'Myths and Legends', 'Sleight of Hand', 'Spot Hidden'], {
    extras: [pkg(0, 0, item('Small field laboratory'), dice('General herbs', 6))],
  }),
  school('Enchanting', ['Enchanting', 'Bartering', 'Crafting', 'Hammers', 'Knives', 'Myths and Legends', 'Sleight of Hand', 'Spot Hidden'], {
    requiredSkill: 'Crafting', requiredSkillLevel: 12, extras: [pkg(0, 0, item('Blacksmithing tools', 'Carpentry tools', 'Tanning tools'))],
  }),
  school('Dracomancy', [], { skill: 'Dracomancy', choosableAtCreation: false }),
];

const profession = (id: number, name: string, keyAttribute: string, skills: string[], heroicAbilities: string[], gearPackages: GearPackageDto[]): ProfessionDto =>
  ({ id, name, roll: id, keyAttribute, skills, heroicAbilities, nicknames: [], gearPackages });

const PROFESSIONS: ProfessionDto[] = [
  profession(1, 'Artisan', 'STR', ['Axes', 'Brawling', 'Crafting', 'Hammers', 'Knives', 'Sleight of Hand', 'Spot Hidden', 'Swords'],
    ['Master Blacksmith', 'Master Carpenter', 'Master Tanner'], [
      pkg(1, 2, item('Light warhammer'), item('Leather'), item('Blacksmithing tools'), torch, flint, dice('Field ration', 8), silver(8)),
      pkg(3, 4, item('Handaxe'), item('Leather'), item('Carpentry tools'), torch, item('Hemp rope, 10 m'), flint, dice('Field ration', 8), silver(8)),
      pkg(5, 6, item('Knife'), item('Leather'), item('Tanning tools'), item('Lantern'), item('Lamp oil, 10 doses'), flint, dice('Field ration', 8), silver(8)),
    ]),
  profession(2, 'Bard', 'CHA', ['Acrobatics', 'Bluffing', 'Evade', 'Knives', 'Languages', 'Myths and Legends', 'Performance', 'Persuasion'],
    ['Musician'], [
      pkg(1, 2, item('Lyre'), item('Knife'), item('Oil lamp'), item('Lamp oil, 10 doses'), flint, dice('Field ration', 6), silver(8)),
      pkg(3, 4, item('Flute'), item('Dagger'), item('Hemp rope, 10 m'), torch, flint, dice('Field ration', 6), silver(8)),
      pkg(5, 6, item('Horn'), item('Knife'), torch, flint, dice('Field ration', 6), silver(8)),
    ]),
  profession(3, 'Fighter', 'STR', ['Axes', 'Bows', 'Brawling', 'Crossbows', 'Evade', 'Hammers', 'Spears', 'Swords'], ['Veteran'], [
    pkg(1, 2, item('Broadsword'), item('Battleaxe', 'Morningstar'), item('Small shield'), item('Chainmail'), torch, flint, dice('Field ration', 6), silver(6)),
    pkg(3, 4, item('Short sword'), item('Handaxe', 'Short spear'), item('Light crossbow'), item('Wooden-headed arrow quiver'), item('Leather'), torch, flint,
      dice('Field ration', 6), silver(6)),
    pkg(5, 6, item('Long spear'), item('Studded leather'), item('Open helmet'), torch, flint, dice('Field ration', 6), silver(6)),
  ]),
  profession(6, 'Mage', 'WIL', [], [], [
    pkg(1, 2, item('Staff'), item('Orbuculum'), item('Grimoire'), torch, flint, dice('Field ration', 6), silver(8)),
    pkg(3, 4, item('Knife'), item('Wand'), item('Grimoire'), torch, flint, dice('Field ration', 6), silver(8)),
    pkg(5, 6, item('Amulet'), item('Grimoire'), item('Sleeping fur'), torch, flint, dice('Field ration', 6), silver(8)),
  ]),
];

const ability = (name: string, prerequisite: string) => ({ id: 0, name, prerequisite, wp: '', effect: '' });

export const creationRef: CreationReference = {
  kin: [
    { id: 1, name: 'Human', rollFrom: 1, rollTo: 4, movement: 10, abilities: [{ name: 'Adaptive', wp: 3, effect: '' }],
      names: ['Joruna', 'Tym', 'Halvelda', 'Garmander', 'Verolun', 'Lothar'] },
    { id: 2, name: 'Halfling', rollFrom: 5, rollTo: 7, movement: 8, abilities: [{ name: 'Hard to Catch', wp: 3, effect: '' }],
      names: ['Snappy', 'Brine', 'Cottar', 'Bumble', 'Perrywick', 'Theoline'] },
    { id: 3, name: 'Dwarf', rollFrom: 8, rollTo: 9, movement: 8, abilities: [{ name: 'Unforgiving', wp: 3, effect: '' }],
      names: ['Tinderrock', 'Halwyld', 'Tymolana', 'Traut', 'Urd', 'Fermer'] },
    { id: 4, name: 'Elf', rollFrom: 10, rollTo: 10, movement: 10, abilities: [{ name: 'Inner Peace', wp: null, effect: '' }],
      names: ['Arasin', 'Illyriana', 'Galvander', 'Tyrindelia', 'Erwilnor', 'Andremone'] },
    { id: 5, name: 'Mallard', rollFrom: 11, rollTo: 11, movement: 8,
      abilities: [{ name: 'Ill-Tempered', wp: 3, effect: '' }, { name: 'Webbed Feet', wp: null, effect: '' }],
      names: ['Qwucksum', 'Splats', 'Moggee', 'Groddy', 'Blisandina', 'Hackleswell'] },
    { id: 6, name: 'Wolfkin', rollFrom: 12, rollTo: 12, movement: 12, abilities: [{ name: 'Hunting Instincts', wp: 3, effect: '' }],
      names: ['Wyld', 'Wolfshadow', 'Lunariem', 'Obdurian', 'Frostbite', 'Wuldenhall'] },
  ],
  professions: PROFESSIONS,
  ages: [
    { id: 1, name: 'Young', rollFrom: 1, rollTo: 3, freeSkills: 2, adjustments: [{ attribute: 'AGL', delta: 1 }, { attribute: 'CON', delta: 1 }] },
    { id: 2, name: 'Adult', rollFrom: 4, rollTo: 5, freeSkills: 4, adjustments: [] },
    { id: 3, name: 'Old', rollFrom: 6, rollTo: 6, freeSkills: 6, adjustments: [
      { attribute: 'STR', delta: -2 }, { attribute: 'AGL', delta: -2 }, { attribute: 'CON', delta: -2 },
      { attribute: 'INT', delta: 1 }, { attribute: 'WIL', delta: 1 },
    ] },
  ],
  schools: SCHOOLS,
  skills: SKILLS,
  spells: SPELLS,
  abilities: [
    ability('Master Blacksmith', 'Crafting 12'), ability('Master Carpenter', 'Crafting 12'), ability('Master Tanner', 'Crafting 12'),
    ability('Musician', 'Performance 12'), ability('Veteran', 'Any weapon skill 12'),
  ],
  equipment: [],
  mementos: [],
  weaknesses: [],
  appearances: [],
};

/** The fixture row with this name; throws so a typo fails the test loudly. */
export function fixture<T extends { name: string }>(rows: readonly T[], name: string): T {
  const row = rows.find(r => r.name === name);
  if (!row) throw new Error(`No fixture row named ${name}`);
  return row;
}
