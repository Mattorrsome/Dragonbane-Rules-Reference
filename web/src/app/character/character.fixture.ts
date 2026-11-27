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
  ...spells('General Magic', 2, 'Spell', 'MAGIC SHIELD'),
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
    skill: 'Harmonism', requiredProfession: 'Bard', requiredSkill: 'Performance', requiredSkillLevel: 12, extras: [pkg(0, 0, item('Grimoire'))],
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
  ({ id, name, roll: id, keyAttribute, skills, heroicAbilities, nicknames: NICKNAMES[name], gearPackages });

const NICKNAMES: Record<string, string[]> = {
  Artisan: ['Stonehammer', 'Woodcleaver', 'Strongfist', 'Barrelmaker', 'Bridgebuilder', 'Ironmaster'],
  Bard: ['Odemaker', 'Talespinner', 'Silvervoice', 'Gildenclef', 'Honeytongue', 'Rhymesmith'],
  Fighter: ['Gravemaker', 'Grimjaw', 'Windthaw', 'Coldsteel', 'The Fearless', 'The Butcher'],
  Hunter: ['Forest Fox', 'Wolfbane', 'Pathfinder', 'The Weathered', 'Bloodhunger', 'Shadowbolt'],
  Knight: ['Dragonheart', 'Goldlance', 'Griffinclaw', 'The Noble', 'Gleamhelm', 'Mourningcloak'],
  Mage: ['Rootheart', 'Crookback', 'Graycape', 'Stormhand', 'Stafflimper', 'Shadowbringer'],
  Mariner: ['Whitewater', 'Waverider', 'Foamborn', 'Saltsplash', 'Seadog', 'Stormfarer'],
  Merchant: ['Silvergrin', 'Goldtooth', 'Silktongue', 'The Lisping and Truthful', 'Lardbelly', 'Skinflint'],
  Scholar: ['Clearmind', 'Dustlung', 'Farsight', 'The Lettered', 'The All-Knowing', 'The Plump and Learned'],
  Thief: ['Halffinger', 'Blackrat', 'Redeye', 'Quickfoot', 'Doubletongue', 'Nightstabber'],
};

/** Packages 1-2, 3-4 and 5-6, each trimmed to its first items (and any choice), its rations and its silver. */
const packages = (rations: number, silverSides: number, ...firsts: GearEntryDto[][]): GearPackageDto[] =>
  firsts.map((items, i) => pkg(2 * i + 1, 2 * i + 2, ...items, dice('Field ration', rations), silver(silverSides)));

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
  profession(4, 'Hunter', 'AGL', ['Acrobatics', 'Awareness', 'Bows', 'Bushcraft', 'Hunting and Fishing', 'Knives', 'Slings', 'Sneaking'], ['Companion'],
    packages(8, 6, [item('Dagger'), item('Short bow')], [item('Knife'), item('Longbow')], [item('Dagger'), item('Sling')])),
  profession(5, 'Knight', 'STR', ['Beast Lore', 'Hammers', 'Myths and Legends', 'Performance', 'Persuasion', 'Riding', 'Spears', 'Swords'], ['Guardian'],
    packages(6, 12, [item('Broadsword', 'Morningstar'), item('Plate armour')], [item('Flail', 'Light warhammer'), item('Chainmail')],
      [item('Short sword'), item('Lance')])),
  profession(7, 'Mariner', 'AGL', ['Acrobatics', 'Awareness', 'Hunting and Fishing', 'Knives', 'Languages', 'Seamanship', 'Swimming', 'Swords'], ['Sea Legs'],
    packages(8, 10, [item('Dagger'), item('Short bow')], [item('Scimitar')], [item('Trident'), item('Spyglass')])),
  profession(8, 'Merchant', 'CHA', ['Awareness', 'Bartering', 'Bluffing', 'Evade', 'Knives', 'Persuasion', 'Sleight of Hand', 'Spot Hidden'],
    ['Treasure Hunter'], packages(6, 12, [item('Dagger'), item('Donkey')], [item('Knife'), item('Cart')], [item('Dagger'), item('Large tent')])),
  profession(9, 'Scholar', 'INT', ['Awareness', 'Beast Lore', 'Bushcraft', 'Evade', 'Healing', 'Languages', 'Myths and Legends', 'Spot Hidden'], ['Intuition'],
    packages(6, 10, [item('Staff'), item('Notebook')], [item('Knife'), item('Book on any subject')], [item('Short sword'), item('Bandages')])),
  profession(10, 'Thief', 'AGL', ['Acrobatics', 'Awareness', 'Bluffing', 'Evade', 'Knives', 'Sleight of Hand', 'Sneaking', 'Spot Hidden'], ['Backstabbing'],
    packages(6, 10, [item('Dagger'), item('Sling')], [item('Knife'), item('Simple lockpicks')], [item('Marbles')])),
];

const MEMENTOS = [
  'Your trusty old shoes', 'A simple silver medallion', 'A letter from an old friend or relative', 'A ragged old journal',
  'A bracelet passed down in your family', 'A wooden figurine you got as a child', 'A strangely shaped stone',
  'A copper coin from a treasure sought by your mother or father', 'An old pewter tankard', 'A horn taken as a trophy from a monster',
  'A fang taken as a trophy from a beast', 'A couple of simple dice made of bone', 'A locket containing a lock of hair', 'An ornate key',
  'A hand-drawn map you inherited', 'A ring with an inscription', 'A bone whistle', "Your mother's or father's ragged old hat",
  'A griffin feather', 'A beautifully carved pipe',
];

const WEAKNESSES = [
  ['Gullible', 'I believe everything that others tell me.'], ['Greedy', 'I want a bigger share of all treasure.'],
  ['Thin-skinned', 'I never tolerate a provocation.'], ['Foolhardy', 'I always go first into danger.'],
  ['Fainthearted', 'I always stay at the back of the group.'], ['Monster Slayer', 'All monsters are evil and must be slain.'],
  ['Intolerant', 'Nightkin such as orcs and goblins are evil and need to be fought.'], ['Slothful', 'I take every chance to rest.'],
  ['Gluttonous', 'I take every chance I get to eat something tasty.'], ['Kleptomaniac', "I can't stop myself from stealing valuables."],
  ['Vain', "I'll help anyone who gives me praise or compliments."], ['Reckless', 'I always take big risks without thought of the consequences.'],
  ['Fearful of Magic', 'Magic is an evil force and mages cannot be trusted.'],
  ['Craving Knowledge', 'The hunt for knowledge is more important than my friends.'], ['Child of the Wild', 'I never sleep indoors.'],
  ['Boastful', 'I always exaggerate my accomplishments.'], ['Violent', 'I resort to violence to overcome every obstacle.'],
  ['Overbearing', 'I always tell others what to do.'], ['Pessimist', 'I always think things will turn out for the worst.'],
  ['Haughty', 'I look down on everyone I meet.'],
];

const APPEARANCES = [
  'Ugly scar across your cheek', 'Strange headgear', 'Abnormally pale and pasty', 'A constant smile on your lips', 'Icy, penetrating gaze',
  'A bit of extra weight around the middle', 'Thin and wiry', 'Abnormal amounts of body hair (depending on kin)',
  'Balding (depending on kin)', 'Prominent tattoo', 'Foul body odour', 'Glorious hairstyle', 'Limp', 'Filthy', 'Honest blue eyes',
  'Silver tooth', 'Heavily perfumed', 'Different-coloured eyes', 'Hissing voice', 'Weathered face',
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
    ability('Musician', 'Performance 12'), ability('Veteran', 'Any weapon skill 12'), ability('Robust', 'None'), ability('Focused', 'None'),
  ],
  equipment: [],
  mementos: MEMENTOS.map((text, i) => ({ id: i + 1, roll: i + 1, text })),
  weaknesses: WEAKNESSES.map(([name, text], i) => ({ id: i + 1, roll: i + 1, name, text })),
  appearances: APPEARANCES.map((text, i) => ({ id: i + 1, roll: i + 1, text })),
};

/** The fixture row with this name; throws so a typo fails the test loudly. */
export function fixture<T extends { name: string }>(rows: readonly T[], name: string): T {
  const row = rows.find(r => r.name === name);
  if (!row) throw new Error(`No fixture row named ${name}`);
  return row;
}
