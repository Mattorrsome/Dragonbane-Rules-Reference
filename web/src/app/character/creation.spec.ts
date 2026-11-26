import { TestBed } from '@angular/core/testing';
import { DiceRoller, RANDOM } from '../dice/dice-roller';
import { seededRandom } from '../dice/seeded-random';
import { Attribute } from '../hero/hero';
import { creationRef as ref, fixture } from './character.fixture';
import {
  Creation, chooseGearPackage, creationProblems, finishCreation, newCreation, professionSkillList, resolveGearPackage,
  schoolsAvailable, setAge, setAlchemistDoses, setAttributes, setHeroicAbility, setItemNote, setKin, setProfession,
  setSchool, spellOptions, swapAttributes, toggleSkill, toggleSpell,
} from './creation';

const profession = (name: string) => fixture(ref.professions, name);
const age = (name: string) => fixture(ref.ages, name);
const school = (name: string) => fixture(ref.schools, name);
const scores = (over: Partial<Record<Attribute, number>> = {}): Record<Attribute, number> =>
  ({ STR: 10, CON: 10, AGL: 10, INT: 10, WIL: 10, CHA: 10, ...over });

function seeded(seed = 42): DiceRoller {
  TestBed.resetTestingModule().configureTestingModule({ providers: [{ provide: RANDOM, useValue: seededRandom(seed) }] });
  return TestBed.inject(DiceRoller);
}

/** A character up to the attributes step. */
function start(professionName: string, attributes = scores(), ageName = 'Adult'): Creation {
  let c = setKin(newCreation(), fixture(ref.kin, 'Human'));
  c = setProfession(c, profession(professionName), ref).creation;
  c = setAge(c, age(ageName), ref).creation;
  return setAttributes(c, attributes, ref).creation;
}

const named = (c: Creation, name: string): Creation => ({ ...c, character: { ...c.character, name } });
const pick = (c: Creation, ...skills: string[]) => skills.reduce((x, s) => toggleSkill(x, s, ref), c);
const learn = (c: Creation, ...names: string[]) =>
  names.reduce((x, n) => toggleSpell(x, fixture(ref.spells, n), ref), c);

describe('setProfession', () => {
  it('Fighter to Mage removes each profession skill, the ability and the gear, saying so', () => {
    let c = pick(start('Fighter'), 'Axes', 'Bows', 'Brawling', 'Crossbows', 'Evade', 'Hammers');
    c = chooseGearPackage(c, profession('Fighter').gearPackages[0], ref, seeded());
    expect(c.professionSkills.length).toBe(6);

    const { creation, cleared } = setProfession(c, profession('Mage'), ref);

    expect(cleared).toEqual([
      ...['Axes', 'Bows', 'Brawling', 'Crossbows', 'Evade', 'Hammers'].map(s => `Removed ${s}: not on the Mage skill list.`),
      'Removed Veteran: not a Mage heroic ability.',
      'Removed the gear package and its money; choose it again.',
    ]);
    expect(creation.professionSkills.filter(s => !professionSkillList(creation, ref).includes(s))).toEqual([]);
    expect([creation.character.gear, creation.character.copper, creation.character.abilities]).toEqual([[], 0, []]);
  });

  it('sets the only heroic ability, and leaves a choice of three open', () => {
    expect(start('Fighter').character.abilities).toEqual([{ name: 'Veteran', count: 1 }]);
    const artisan = start('Artisan');
    expect(artisan.character.abilities).toEqual([]);
    expect(creationProblems(artisan, ref)).toContain('Choose a heroic ability.');
    expect(creationProblems(setHeroicAbility(artisan, 'Master Tanner'), ref)).not.toContain('Choose a heroic ability.');
    expect(creationProblems(setHeroicAbility(artisan, 'Veteran'), ref)).toContain('Veteran is not an Artisan heroic ability.');
    expect(creationProblems(setHeroicAbility(start('Mage'), 'Veteran'), ref)).toContain('Veteran is not a Mage heroic ability.');
  });

  it('a profession the school is not open to removes the school', () => {
    const bard = setSchool(start('Bard'), school('Harmonism'), ref).creation;
    const { creation, cleared } = setProfession(bard, profession('Artisan'), ref);
    expect(creation.character.school).toBeNull();
    expect(cleared[0]).toBe('Removed the Harmonism school: it is not open to an Artisan.');
  });

  it('changing school names the school in the removal message', () => {
    let c = setSchool(start('Mage', scores({ INT: 14 })), school('Animism'), ref).creation;
    c = pick(c, 'Evade', 'Sneaking');
    const { creation, cleared } = setSchool(c, school('Elementalism'), ref);
    expect(cleared).toEqual([
      'Removed Animism: not on the Mage (Elementalism) skill list.',
      'Removed Sneaking: not on the Mage (Elementalism) skill list.',
    ]);
    expect(creation.professionSkills).toEqual(['Evade', 'Elementalism']);
  });
});

describe('setAge', () => {
  it('Adult with 4 free skills to Young keeps 2 and names the 2 removed', () => {
    const c = pick(start('Fighter'), 'Axes', 'Bows', 'Brawling', 'Crossbows', 'Evade', 'Hammers',
      'Awareness', 'Bartering', 'Healing', 'Swimming');
    expect(c.freeSkills.length).toBe(4);
    const { creation, cleared } = setAge(c, age('Young'), ref);
    expect(creation.freeSkills).toEqual(['Awareness', 'Bartering']);
    expect(cleared).toEqual([
      'Removed Healing: a Young character has 2 free skills.',
      'Removed Swimming: a Young character has 2 free skills.',
    ]);
  });

  it('re-applies the age to the rolled scores', () => {
    const c = start('Fighter', scores({ STR: 14, AGL: 18 }));
    const old = setAge(c, age('Old'), ref).creation.character.attributes;
    expect([old.STR, old.INT]).toEqual([12, 11]);
    const young = setAge(c, age('Young'), ref).creation.character.attributes;
    expect([young.STR, young.AGL, young.CON]).toEqual([14, 18, 11]);
  });
});

describe('attributes', () => {
  it('clamps manual entry to 3-18 and ignores a missing score', () => {
    const c = start('Fighter', scores({ STR: 25, CON: 1 }));
    expect([c.character.attributes.STR, c.character.attributes.CON]).toEqual([18, 3]);
    expect(setAttributes(c, scores({ AGL: NaN }), ref).creation).toBe(c);
  });

  it('swaps once', () => {
    const c = swapAttributes(start('Fighter', scores({ STR: 15, CHA: 8 })), 'STR', 'CHA', ref).creation;
    expect([c.character.attributes.STR, c.character.attributes.CHA, c.swapUsed]).toEqual([8, 15, true]);
    expect(swapAttributes(c, 'STR', 'CHA', ref).creation).toBe(c);
  });

  it('an enchanter whose STR swap drops Crafting below 12 loses Enchanting', () => {
    let c = setSchool(start('Mage', scores({ STR: 13 })), school('Enchanting'), ref).creation;
    c = pick(c, 'Crafting');
    expect(c.character.school).toBe('Enchanting');

    const { creation, cleared } = swapAttributes(c, 'STR', 'INT', ref);

    expect(creation.character.school).toBeNull();
    expect(cleared[0]).toBe('Removed the Enchanting school: Crafting cannot reach 12 with STR 10.');
    expect(cleared).toContain('Removed Crafting: not on the Mage skill list.');
    expect(creationProblems(creation, ref)).toContain('Choose a magic school.');
  });
});

describe('schools', () => {
  const names = (c: Creation) => schoolsAvailable(c, ref).map(s => s.name);

  it('a STR 12 mage cannot choose Enchanting; at STR 13 they can', () => {
    expect(names(start('Mage', scores({ STR: 12 })))).toEqual(['Animism', 'Elementalism', 'Alchemy']);
    expect(names(start('Mage', scores({ STR: 13 })))).toEqual(['Animism', 'Elementalism', 'Alchemy', 'Enchanting']);
  });

  it('a bard may choose Harmonism; a fighter has no school', () => {
    expect(names(start('Bard'))).toEqual(['Harmonism']);
    expect(names(start('Fighter'))).toEqual([]);
    expect(setSchool(start('Fighter'), school('Animism'), ref).cleared).toEqual([]);
    expect(setSchool(start('Fighter'), school('Animism'), ref).creation.character.school).toBeNull();
  });

  it('a mage school skill is trained and required among the profession picks', () => {
    const c = setSchool(start('Mage'), school('Animism'), ref).creation;
    expect(c.professionSkills).toEqual(['Animism']);
    const without = toggleSkill(c, 'Animism', ref);
    expect(creationProblems(without, ref)).toContain('Train Animism: a mage\'s school skill is one of the six profession skills.');
  });

  it('a harmonist bard swaps Musician for Harmonism spells and keeps the bard skills', () => {
    const { creation, cleared } = setSchool(start('Bard'), school('Harmonism'), ref);
    expect(cleared).toEqual(['Removed Musician: the Harmonism school replaces it.']);
    expect(creation.character.abilities).toEqual([]);
    expect(professionSkillList(creation, ref)).toEqual(profession('Bard').skills);
    expect(spellOptions(creation, ref).map(s => s.name)).toEqual([
      'INSPIRE', 'MEND', 'PROTECTIVE HARMONIES', 'Luring Song', 'Magical Melody', 'Voice Distortion',
    ]);
    expect(setSchool(creation, null, ref).creation.character.abilities).toEqual([{ name: 'Musician', count: 1 }]);
  });

  it('dropping a school drops its spells and keeps General Magic tricks the new school allows', () => {
    let c = setSchool(start('Mage', scores({ STR: 13 })), school('Animism'), ref).creation;
    c = learn(c, 'CURE', 'ALARM', 'Fetch', 'Birdsong');
    const { creation, cleared } = setSchool(c, school('Enchanting'), ref);
    expect(cleared).toEqual([
      'Removed Animism: not on the Mage (Enchanting) skill list.',
      'Removed CURE: not a spell option for a Mage (Enchanting).',
      'Removed ALARM: not a spell option for a Mage (Enchanting).',
      'Removed Birdsong: not a spell option for a Mage (Enchanting).',
    ]);
    expect(creation.character.spells).toEqual([{ name: 'Fetch', school: 'General Magic', kind: 'Trick' }]);
  });
});

describe('spells', () => {
  const options = (schoolName: string) =>
    spellOptions(setSchool(start('Mage', scores({ STR: 13 })), school(schoolName), ref).creation, ref).map(s => `${s.school}:${s.name}`);

  it('an alchemist gets rank 1 recipes plus General Magic tricks', () => {
    expect(options('Alchemy')).toEqual([
      'Alchemy:FOCUS TONIC', 'Alchemy:HERBAL CONCOCTION', 'Alchemy:INVIGORATING DECOCTION', 'Alchemy:LIQUID COURAGE',
      'General Magic:Fetch', 'General Magic:Flick', 'General Magic:Light', 'General Magic:Open/Close',
    ]);
  });

  it('an enchanter gets rank 1 Enchanting spells plus General Magic tricks', () => {
    expect(options('Enchanting')).toEqual([
      'Enchanting:CONCEALING', 'Enchanting:FARSHOT', 'Enchanting:KEEN EDGE', 'Enchanting:LUMINOUS',
      'General Magic:Fetch', 'General Magic:Flick', 'General Magic:Light', 'General Magic:Open/Close',
    ]);
  });

  it('other schools get rank 1 spells and tricks of the school or General Magic', () => {
    expect(options('Elementalism')).toEqual([
      'Elementalism:FIREBALL', 'Elementalism:FROST', 'Elementalism:GUST OF WIND',
      'Elementalism:Heat/Chill', 'Elementalism:Ignite', 'Elementalism:Puff of Smoke',
      'General Magic:ALARM', 'General Magic:DISPEL', 'General Magic:PROTECTOR',
      'General Magic:Fetch', 'General Magic:Flick', 'General Magic:Light', 'General Magic:Open/Close',
    ]);
  });

  it('allows at most 3 spells and 3 tricks, and toggles off', () => {
    let c = setSchool(start('Mage'), school('Elementalism'), ref).creation;
    c = learn(c, 'FIREBALL', 'FROST', 'ALARM', 'DISPEL', 'Ignite', 'Fetch', 'Flick', 'Light', 'FIRE BLAST');
    expect(c.character.spells.map(s => s.name)).toEqual(['FIREBALL', 'FROST', 'ALARM', 'Ignite', 'Fetch', 'Flick']);
    expect(learn(c, 'FROST').character.spells.map(s => s.name)).not.toContain('FROST');
  });
});

describe('skills', () => {
  it('fills the profession picks first, then the free picks, then stops', () => {
    const c = pick(start('Fighter', scores(), 'Young'),
      'Axes', 'Bows', 'Brawling', 'Crossbows', 'Evade', 'Hammers', 'Spears', 'Awareness', 'Swimming', 'Animism');
    expect(c.professionSkills).toEqual(['Axes', 'Bows', 'Brawling', 'Crossbows', 'Evade', 'Hammers']);
    expect(c.freeSkills).toEqual(['Spears', 'Awareness']);
  });

  it('finishCreation trains skills at twice the base chance', () => {
    let c = setSchool(start('Mage', scores({ INT: 16, AGL: 9 })), school('Elementalism'), ref).creation;
    c = pick(c, 'Evade');
    const skills = finishCreation(c, ref).skills;
    expect(skills).toEqual([
      { name: 'Elementalism', level: 14, trained: true },
      { name: 'Evade', level: 10, trained: true },
    ]);
  });
});

describe('gear', () => {
  it('Fighter 1-2 with choice 1 gives a Morningstar, and D6 silver in whole silver', () => {
    const { gear, copper } = resolveGearPackage(profession('Fighter').gearPackages[0], { 1: 1 }, seeded());
    expect(gear.map(g => g.name)).toContain('Morningstar');
    expect(gear.map(g => g.name)).not.toContain('Battleaxe');
    expect(copper % 10).toBe(0);
    expect(copper).toBeGreaterThanOrEqual(10);
    expect(copper).toBeLessThanOrEqual(60);
    const rations = gear.find(g => g.name === 'Field ration')!.quantity;
    expect(rations).toBeGreaterThanOrEqual(1);
    expect(rations).toBeLessThanOrEqual(6);
  });

  it('adds Simple clothes and the school extras, whose choices follow the package entries', () => {
    let c = setSchool(start('Mage', scores({ STR: 13 })), school('Enchanting'), ref).creation;
    const pkg = profession('Mage').gearPackages[0];
    c = chooseGearPackage(c, pkg, ref, seeded(), { [pkg.entries.length]: 2 });
    const names = c.character.gear.map(g => g.name);
    expect(names).toContain('Tanning tools');
    expect(names).toContain('Simple clothes');
    expect(c.character.copper).toBeGreaterThan(0);

    const marked = setItemNote(c, 0, 'Enchanted: KEEN EDGE + PERMANENCE');
    expect(marked.character.gear[0]).toEqual({ name: 'Staff', quantity: 1, note: 'Enchanted: KEEN EDGE + PERMANENCE' });
    expect(setItemNote(c, 99, 'x')).toBe(c);
  });

  it('choices belong to their package: another package starts from none, the same package keeps them', () => {
    const [first, second] = profession('Fighter').gearPackages;
    const morningstar = chooseGearPackage(start('Fighter'), first, ref, seeded(), { 1: 1 });
    expect([morningstar.gearPackage, morningstar.packageChoices]).toEqual([1, { 1: 1 }]);
    const names = (c: Creation) => c.character.gear.map(g => g.name);

    const other = chooseGearPackage(morningstar, second, ref, seeded());
    expect(names(other)).toContain('Handaxe');
    expect(other.packageChoices).toEqual({});
    expect(names(chooseGearPackage(morningstar, first, ref, seeded(7)))).toContain('Morningstar');
  });

  it('clearing the gear clears the package and its choices, even before any gear was resolved', () => {
    const c = { ...start('Fighter'), gearPackage: 1, packageChoices: { 1: 1 } };
    const { creation } = setProfession(c, profession('Mage'), ref);
    expect([creation.gearPackage, creation.packageChoices]).toEqual([null, {}]);
  });

  it('an alchemist chooses 3 finished doses from known recipes', () => {
    let c = setSchool(start('Mage'), school('Alchemy'), ref).creation;
    c = learn(c, 'FOCUS TONIC', 'LIQUID COURAGE', 'HERBAL CONCOCTION');
    c = chooseGearPackage(c, profession('Mage').gearPackages[0], ref, seeded());
    expect(c.character.gear.map(g => g.name)).toEqual(expect.arrayContaining(['Small field laboratory', 'General herbs']));
    const problem = 'Choose 3 finished doses from known recipes.';
    expect(creationProblems(c, ref)).toContain(problem);
    expect(setAlchemistDoses(c, ['FOCUS TONIC', 'ANTIDOTE', 'LIQUID COURAGE'])).toBe(c);
    expect(setAlchemistDoses(c, ['FOCUS TONIC'])).toBe(c);

    const dosed = setAlchemistDoses(c, ['FOCUS TONIC', 'FOCUS TONIC', 'LIQUID COURAGE']);
    expect(dosed.character.gear.filter(g => g.name.endsWith(', dose')).map(g => g.name))
      .toEqual(['FOCUS TONIC, dose', 'FOCUS TONIC, dose', 'LIQUID COURAGE, dose']);
    expect(creationProblems(dosed, ref)).not.toContain(problem);
    const rerolled = chooseGearPackage(dosed, profession('Mage').gearPackages[1], ref, seeded(7));
    expect(rerolled.character.gear.filter(g => g.name.endsWith(', dose')).length).toBe(3);
  });
});

describe('creationProblems', () => {
  it('lists every missing step of a new creation', () => {
    expect(creationProblems(newCreation(), ref)).toEqual([
      'Choose a kin.', 'Choose a profession.', 'Choose an age.', 'Choose or type a name.', 'Roll or enter the attributes.',
      'Pick 6 more profession skills.', 'Choose a gear package.',
    ]);
  });

  it('is empty for a complete fighter and a complete mage', () => {
    let fighter = named(start('Fighter'), 'Tym');
    fighter = pick(fighter, 'Axes', 'Bows', 'Brawling', 'Crossbows', 'Evade', 'Hammers', 'Awareness', 'Bartering', 'Healing', 'Swimming');
    fighter = chooseGearPackage(fighter, profession('Fighter').gearPackages[2], ref, seeded());
    expect(creationProblems(fighter, ref)).toEqual([]);

    let mage = setSchool(named(start('Mage'), 'Lothar'), school('Elementalism'), ref).creation;
    expect(creationProblems(mage, ref)).toContain('Pick 3 more rank 1 spells.');
    mage = pick(mage, 'Awareness', 'Evade', 'Healing', 'Languages', 'Staves', 'Bartering', 'Bluffing', 'Riding', 'Seamanship');
    mage = learn(mage, 'FIREBALL', 'FROST', 'ALARM', 'Ignite', 'Fetch', 'Flick');
    mage = chooseGearPackage(mage, profession('Mage').gearPackages[1], ref, seeded());
    expect(creationProblems(mage, ref)).toEqual([]);
  });
});
