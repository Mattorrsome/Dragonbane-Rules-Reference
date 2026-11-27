import { AgeDto, GearEntryDto, GearPackageDto, KinDto, MagicSchoolDto, ProfessionDto, SkillDto, SpellDto } from '../api/models';
import { DiceRoller, rollDice } from '../dice/dice-roller';
import { ATTRIBUTES, Attribute, SpellRef, addSpell, removeSpell, same, sameSpell } from '../hero/hero';
import { Character, CreationReference, GearItem, skillLevel } from './character';
import { applyAge, baseChance } from './rules';

/** A character being built step by step, with what the finished character does not need to remember. */
export interface Creation {
  character: Character;
  professionSkills: string[];
  freeSkills: string[];
  /** The scores as rolled or entered, before the age adjustment. */
  rolledAttributes: Record<Attribute, number> | null;
  swapUsed: boolean;
  /** The chosen gear package's rollFrom, or null. */
  gearPackage: number | null;
  /**
   * Entry index to chosen option index: the gear package's entries, then the school extras' entries. They belong to
   * `gearPackage`: choosing another package starts from none, and clearing the gear clears both.
   */
  packageChoices: Record<number, number>;
}

/** The creation steps in book order. */
export const CREATION_STEPS = [
  'kin', 'profession', 'age', 'name', 'attributes', 'skills', 'magic', 'weakness', 'memento', 'gear', 'appearance',
] as const;
export type CreationStep = (typeof CREATION_STEPS)[number];

/** A change and the human messages for what it removed to keep the character valid. */
export type Step = { creation: Creation; cleared: string[] };

const PROFESSION_SKILLS = 6;
export const MAX_SPELLS = 3;
export const MAX_TRICKS = 3;
/** An alchemist's finished doses at creation. */
export const DOSES = 3;
const GENERAL_MAGIC = 'General Magic';
/** Harmonists cannot take General Magic. */
const HARMONISM = 'Harmonism';
/** Schools without tricks of their own: their tricks, and only their tricks, come from General Magic. */
const TRICKS_FROM_GENERAL_MAGIC = ['Alchemy', 'Enchanting'];
const ALCHEMY = 'Alchemy';
const DOSE = ', dose';
/** "FOCUS TONIC" → "FOCUS TONIC, dose": an alchemist's finished dose as the gear holds it. */
export const doseName = (recipe: string) => `${recipe}${DOSE}`;
const ENCHANTED = 'Enchanted: ';
/** "KEEN EDGE" → "Enchanted: KEEN EDGE + PERMANENCE": the note on an enchanter's item. */
export const enchantNote = (spell: string) => `${ENCHANTED}${spell} + PERMANENCE`;
const SIMPLE_CLOTHES: GearItem = { name: 'Simple clothes', quantity: 1, note: '' };

const has = (names: readonly string[], name: string) => names.some(n => same(n, name));
const attributeOf = (skill: SkillDto) => skill.attribute.slice(0, 3) as Attribute;
const plural = (n: number, word: string) => `${n} more ${word}${n === 1 ? '' : 's'}`;
/** "an Adult", "a Mage" */
const article = (word: string) => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;
const withCharacter = (c: Creation, changes: Partial<Character>): Creation => ({ ...c, character: { ...c.character, ...changes } });
export const unchanged = (creation: Creation): Step => ({ creation, cleared: [] });

const professionOf = (c: Creation, ref: CreationReference) => ref.professions.find(p => same(p.name, c.character.profession));
const schoolOf = (c: Creation, ref: CreationReference) =>
  c.character.school === null ? undefined : ref.schools.find(s => same(s.name, c.character.school!));
const ageOf = (c: Creation, ref: CreationReference) => ref.ages.find(a => same(a.name, c.character.age));
/** "Mage (Animism)" when the school brings its own skill list, else the profession. */
function listLabel(c: Creation, ref: CreationReference): string {
  const school = schoolOf(c, ref);
  return school?.startingSkills.length ? `${c.character.profession} (${school.name})` : c.character.profession;
}

export function newCreation(): Creation {
  return {
    character: {
      name: '', nickname: '', kin: '', profession: '', school: null, age: '',
      // Placeholder until the attributes step; creationProblems reports it.
      attributes: { STR: 10, CON: 10, AGL: 10, INT: 10, WIL: 10, CHA: 10 },
      skills: [], abilities: [], kinAbilities: [], spells: [], gear: [], copper: 0, weakness: '', memento: '', appearance: '',
    },
    professionSkills: [], freeSkills: [], rolledAttributes: null, swapUsed: false, gearPackage: null, packageChoices: {},
  };
}

export function setKin(c: Creation, kin: KinDto): Creation {
  return withCharacter(c, { kin: kin.name, kinAbilities: kin.abilities.map(a => a.name) });
}

/** A new profession clears the gear package, and whatever school, skills, ability and spells no longer fit. */
export function setProfession(c: Creation, p: ProfessionDto, ref: CreationReference): Step {
  if (same(c.character.profession, p.name)) return unchanged(c);
  return revalidate(withCharacter(c, { profession: p.name }), ref, true);
}

export function setAge(c: Creation, age: AgeDto, ref: CreationReference): Step {
  const attributes = c.rolledAttributes ? applyAge(c.rolledAttributes, age) : c.character.attributes;
  return revalidate(withCharacter(c, { age: age.name, attributes }), ref);
}

/** Rolled or typed scores (each kept within 3-18, then the age applied); a fresh set allows a fresh swap. */
export function setAttributes(c: Creation, rolled: Record<Attribute, number>, ref: CreationReference): Step {
  if (!ATTRIBUTES.every(a => Number.isFinite(rolled[a]))) return unchanged(c);
  const scores = Object.fromEntries(ATTRIBUTES.map(a => [a, Math.min(18, Math.max(3, Math.trunc(rolled[a])))])) as Record<Attribute, number>;
  return withRolled({ ...c, swapUsed: false }, scores, ref);
}

/** Swaps two rolled scores, once. */
export function swapAttributes(c: Creation, a: Attribute, b: Attribute, ref: CreationReference): Step {
  if (c.swapUsed || !c.rolledAttributes || a === b) return unchanged(c);
  const r = c.rolledAttributes;
  return withRolled({ ...c, swapUsed: true }, { ...r, [a]: r[b], [b]: r[a] }, ref);
}

function withRolled(c: Creation, rolled: Record<Attribute, number>, ref: CreationReference): Step {
  const age = ageOf(c, ref);
  return revalidate(withCharacter({ ...c, rolledAttributes: rolled }, { attributes: age ? applyAge(rolled, age) : rolled }), ref);
}

/** The school's starting skills for a mage with a school; the profession's skills otherwise (a harmonist bard keeps the bard list). */
export function professionSkillList(c: Creation, ref: CreationReference): string[] {
  const school = schoolOf(c, ref);
  return school?.startingSkills.length ? school.startingSkills : (professionOf(c, ref)?.skills ?? []);
}

export function skillLimits(c: Creation, ref: CreationReference): { profession: 6; free: number } {
  return { profession: PROFESSION_SKILLS, free: ageOf(c, ref)?.freeSkills ?? 0 };
}

/** Untrains a picked skill; else trains it as a profession pick if it can, else as a free pick (any core skill), else nothing. */
export function toggleSkill(c: Creation, name: string, ref: CreationReference): Creation {
  if (has(c.professionSkills, name)) return { ...c, professionSkills: c.professionSkills.filter(s => !same(s, name)) };
  if (has(c.freeSkills, name)) return { ...c, freeSkills: c.freeSkills.filter(s => !same(s, name)) };
  const skill = ref.skills.find(s => same(s.name, name));
  if (!skill) return c;
  const limits = skillLimits(c, ref);
  if (has(professionSkillList(c, ref), skill.name) && c.professionSkills.length < limits.profession) {
    return { ...c, professionSkills: [...c.professionSkills, skill.name] };
  }
  if (skill.type !== 'Secondary' && c.freeSkills.length < limits.free) return { ...c, freeSkills: [...c.freeSkills, skill.name] };
  return c;
}

/** Why this school is closed to the character, or null when it is open. */
function schoolBar(c: Creation, school: MagicSchoolDto, ref: CreationReference): string | null {
  const { profession, attributes } = c.character;
  if (!school.choosableAtCreation) return 'it cannot be chosen at creation';
  if (!school.requiredProfession || !same(school.requiredProfession, profession)) return `it is not open to ${article(profession)}`;
  // Only a school with its own skill list enforces its requirement (Enchanting); Harmonism's Performance 12 is a note.
  if (school.requiredSkill && school.requiredSkillLevel && school.startingSkills.length) {
    const skill = ref.skills.find(s => same(s.name, school.requiredSkill!));
    if (!skill || !has(school.startingSkills, skill.name)) return `${school.requiredSkill} is not on its skill list`;
    const attribute = attributeOf(skill);
    if (2 * baseChance(attributes[attribute]) < school.requiredSkillLevel) {
      return `${skill.name} cannot reach ${school.requiredSkillLevel} with ${attribute} ${attributes[attribute]}`;
    }
  }
  return null;
}

/** Mage: choosable schools for a mage (Enchanting only when trained Crafting reaches 12). Bard: Harmonism. Others: none. */
export function schoolsAvailable(c: Creation, ref: CreationReference): MagicSchoolDto[] {
  return ref.schools.filter(s => !schoolBar(c, s, ref));
}

/** A new school (or none) clears the gear package, and the skills and spells that no longer fit; a mage's school skill is trained. */
export function setSchool(c: Creation, school: MagicSchoolDto | null, ref: CreationReference): Step {
  if (same(c.character.school ?? '', school?.name ?? '')) return unchanged(c);
  if (school && !schoolsAvailable(c, ref).some(s => same(s.name, school.name))) return unchanged(c);
  const step = revalidate(withCharacter(c, { school: school?.name ?? null }), ref, true);
  const skill = school?.skill;
  const next = step.creation;
  if (skill && !has(next.professionSkills, skill) && next.professionSkills.length < PROFESSION_SKILLS) {
    return { ...step, creation: { ...next, professionSkills: [...next.professionSkills, skill] } };
  }
  return step;
}

/**
 * Rank 1 spells (recipes for Alchemy) and tricks of the school, plus General Magic: Harmonism takes none of it,
 * Alchemy and Enchanting take only its tricks.
 */
export function spellOptions(c: Creation, ref: CreationReference): SpellDto[] {
  const school = schoolOf(c, ref);
  if (!school) return [];
  const starting = (s: SpellDto) => s.kind === 'Trick' || s.rank === 1;
  const own = ref.spells.filter(s => same(s.school, school.name) && starting(s));
  if (same(school.name, HARMONISM)) return own;
  const tricksOnly = has(TRICKS_FROM_GENERAL_MAGIC, school.name);
  return [...own, ...ref.spells.filter(s => same(s.school, GENERAL_MAGIC) && (tricksOnly ? s.kind === 'Trick' : starting(s)))];
}

/**
 * Every spell (all ranks, tricks and recipes) of the schools the character holds, plus General Magic: all of it for
 * any school outside Harmonism, Alchemy and Enchanting; else its tricks for Alchemy or Enchanting; none for Harmonism
 * alone. A school is held with its own skill at level 1 or more. Harmonism has no skill of its own: it is held by a
 * harmonist, or by anyone with Performance at its required level and Magic Talent.
 */
export function learnableSpells(c: Character, ref: CreationReference): SpellDto[] {
  const performance = ref.skills.find(s => same(s.name, 'Performance'));
  const holds = (s: MagicSchoolDto) => {
    if (s.skill) return c.skills.some(k => same(k.name, s.skill!) && k.level >= 1);
    return same(s.name, HARMONISM) && (same(c.school ?? '', s.name)
      || (!!performance && skillLevel(c, performance) >= (s.requiredSkillLevel ?? 0)
        && c.abilities.some(a => same(a.name, 'Magic Talent'))));
  };
  const held = ref.schools.filter(holds);
  if (!held.length) return [];
  const own = ref.spells.filter(s => held.some(h => same(s.school, h.name)));
  const general = ref.spells.filter(s => same(s.school, GENERAL_MAGIC));
  const outside = (h: MagicSchoolDto) => !same(h.name, HARMONISM) && !has(TRICKS_FROM_GENERAL_MAGIC, h.name);
  if (held.some(outside)) return [...own, ...general];
  if (held.some(h => has(TRICKS_FROM_GENERAL_MAGIC, h.name))) return [...own, ...general.filter(s => s.kind === 'Trick')];
  return own;
}

const isTrick = (s: SpellRef) => s.kind === 'Trick';

/** Forgets a known spell; else learns an option, up to 3 spells (or recipes) and 3 tricks. */
export function toggleSpell(c: Creation, spell: SpellRef, ref: CreationReference): Creation {
  if (c.character.spells.some(s => sameSpell(s, spell))) return withCharacter(c, removeSpell(c.character, spell));
  const option = spellOptions(c, ref).find(o => sameSpell(o, spell));
  if (!option) return c;
  const max = isTrick(option) ? MAX_TRICKS : MAX_SPELLS;
  if (c.character.spells.filter(s => isTrick(s) === isTrick(option)).length >= max) return c;
  return withCharacter(c, addSpell(c.character, { name: option.name, school: option.school, kind: option.kind }));
}

/** One of the profession's choices (Artisan); creationProblems reports any other. */
export function setHeroicAbility(c: Creation, name: string): Creation {
  return withCharacter(c, { abilities: [{ name, count: 1 }] });
}

/** The package's items with choices picked (option 0 when none) and dice quantities rolled; silver dice become copper. */
export function resolveGearPackage(pkg: GearPackageDto, choices: Record<number, number>, roller: DiceRoller): { gear: GearItem[]; copper: number } {
  const gear: GearItem[] = [];
  let copper = 0;
  pkg.entries.forEach((entry, i) => {
    const quantity = entry.diceCount && entry.diceSides ? rollDice(roller, entry.diceCount, entry.diceSides).total : entry.quantity;
    if (entry.kind === 'Silver') copper += quantity * 10;
    else gear.push({ name: entry.options[choices[i]] ?? entry.options[0], quantity, note: '' });
  });
  return { gear, copper };
}

const isDose = (g: GearItem) => g.name.endsWith(DOSE);
const isAlchemist = (c: Creation) => same(c.character.school ?? '', ALCHEMY);

/**
 * The package plus the school extras and simple clothes, replacing earlier gear and money; an alchemist keeps their doses.
 * The package already held only swaps its chosen items: rolled quantities, money and notes stay, and a note on an item
 * swapped out goes, saying so. `choices` default to those kept for this same package, so another package never inherits them.
 */
export function chooseGearPackage(
  c: Creation, pkg: GearPackageDto, ref: CreationReference, roller: DiceRoller,
  choices: Record<number, number> = pkg.rollFrom === c.gearPackage ? c.packageChoices : {},
): Step {
  const entries = [...pkg.entries, ...(schoolOf(c, ref)?.extras.flatMap(x => x.entries) ?? [])];
  if (pkg.rollFrom === c.gearPackage) return rechoose(c, entries, choices);
  const { gear, copper } = resolveGearPackage({ ...pkg, entries }, choices, roller);
  const doses = isAlchemist(c) ? c.character.gear.filter(isDose) : [];
  const next = withCharacter(c, { gear: [...gear, { ...SIMPLE_CLOTHES }, ...doses], copper });
  return unchanged({ ...next, gearPackage: pkg.rollFrom, packageChoices: choices });
}

/** The held package's items lead the gear, one per non-silver entry in order (as resolveGearPackage made them). */
function rechoose(c: Creation, entries: GearEntryDto[], choices: Record<number, number>): Step {
  const cleared: string[] = [];
  const gear = [...c.character.gear];
  let i = -1;
  entries.forEach((entry, e) => {
    if (entry.kind === 'Silver') return;
    const item = gear[++i];
    const name = entry.options[choices[e]] ?? entry.options[0];
    if (!item || same(item.name, name)) return;
    if (item.note) cleared.push(`Removed the note "${item.note}" from ${item.name}: it was swapped for ${name}.`);
    gear[i] = { ...item, name, note: '' };
  });
  return { creation: { ...withCharacter(c, { gear }), packageChoices: choices }, cleared };
}

/** An alchemist's three finished doses, from known recipes (repeats allowed); anything else changes nothing. */
export function setAlchemistDoses(c: Creation, recipes: string[]): Creation {
  const known = c.character.spells.filter(s => s.kind === 'Recipe').map(s => s.name);
  if (!isAlchemist(c) || recipes.length !== DOSES || !recipes.every(r => has(known, r))) return c;
  const doses = recipes.map(r => ({ name: doseName(known.find(k => same(k, r))!), quantity: 1, note: '' }));
  return withCharacter(c, { gear: [...c.character.gear.filter(g => !isDose(g)), ...doses] });
}

/** A note on one gear item, e.g. an enchanter's "Enchanted: KEEN EDGE + PERMANENCE". */
export function setItemNote(c: Creation, itemIndex: number, note: string): Creation {
  if (!c.character.gear[itemIndex]) return c;
  return withCharacter(c, { gear: c.character.gear.map((g, i) => (i === itemIndex ? { ...g, note } : g)) });
}

/** An enchanter's one enchanted item: clears every enchantment note, then marks `itemIndex` (-1 for none) with the spell. */
export function setEnchantment(c: Creation, itemIndex: number, spell: string): Creation {
  return withCharacter(c, {
    gear: c.character.gear.map((g, i) =>
      i === itemIndex && spell ? { ...g, note: enchantNote(spell) } : g.note.startsWith(ENCHANTED) ? { ...g, note: '' } : g),
  });
}

/**
 * Removes what an earlier change made invalid, saying what went: the school, profession and free skills over the
 * list or limit, heroic abilities, spells, and (when `clearGear` or the school went) the gear package.
 */
function revalidate(c: Creation, ref: CreationReference, clearGear = false): Step {
  const cleared: string[] = [];
  let next = c;

  const school = schoolOf(next, ref);
  const bar = school && schoolBar(next, school, ref);
  if (bar) {
    cleared.push(`Removed the ${school.name} school: ${bar}.`);
    next = withCharacter(next, { school: null });
    clearGear = true;
  }

  const list = professionSkillList(next, ref);
  const label = listLabel(next, ref);
  for (const s of next.professionSkills.filter(s => !has(list, s))) cleared.push(`Removed ${s}: not on the ${label} skill list.`);
  const { free } = skillLimits(next, ref);
  for (const s of next.freeSkills.slice(free)) cleared.push(`Removed ${s}: ${article(next.character.age)} character has ${free} free skills.`);
  next = { ...next, professionSkills: next.professionSkills.filter(s => has(list, s)), freeSkills: next.freeSkills.slice(0, free) };

  const magic = schoolOf(next, ref);
  const allowed = magic ? [] : (professionOf(next, ref)?.heroicAbilities ?? []);
  for (const a of next.character.abilities.filter(a => !has(allowed, a.name))) {
    cleared.push(magic ? `Removed ${a.name}: the ${magic.name} school replaces it.` : `Removed ${a.name}: not ${article(next.character.profession)} heroic ability.`);
  }
  const abilities = next.character.abilities.filter(a => has(allowed, a.name));
  next = withCharacter(next, { abilities: !abilities.length && allowed.length === 1 ? [{ name: allowed[0], count: 1 }] : abilities });

  const options = spellOptions(next, ref);
  const offered = (s: SpellRef) => options.some(o => sameSpell(o, s));
  for (const s of next.character.spells.filter(s => !offered(s))) cleared.push(`Removed ${s.name}: not a spell option for ${article(label)}.`);
  next = withCharacter(next, { spells: next.character.spells.filter(offered) });

  if (clearGear) {
    if (next.character.gear.length || next.character.copper) cleared.push('Removed the gear package and its money; choose it again.');
    next = { ...withCharacter(next, { gear: [], copper: 0 }), gearPackage: null, packageChoices: {} };
  }
  return { creation: next, cleared };
}

/** What is missing, in book order, each with the step that fixes it. */
export function stepProblems(c: Creation, ref: CreationReference): { step: CreationStep; text: string }[] {
  const problems: { step: CreationStep; text: string }[] = [];
  const add = (step: CreationStep, text: string) => problems.push({ step, text });
  const ch = c.character;
  const profession = professionOf(c, ref);
  const school = schoolOf(c, ref);
  if (!ch.kin) add('kin', 'Choose a kin.');
  if (!profession) add('profession', 'Choose a profession.');
  if (!ch.age) add('age', 'Choose an age.');
  if (!ch.name.trim()) add('name', 'Choose or type a name.');
  if (!c.rolledAttributes) add('attributes', 'Roll or enter the attributes.');
  // The mage: a profession without a skill list of its own takes one from its school.
  if (profession && !profession.skills.length && !school) add('magic', 'Choose a magic school.');

  const limits = skillLimits(c, ref);
  if (c.professionSkills.length < limits.profession) add('skills', `Pick ${plural(limits.profession - c.professionSkills.length, 'profession skill')}.`);
  if (!ch.age) add('skills', 'Choose an age: it sets the number of free skills.');
  if (c.freeSkills.length < limits.free) add('skills', `Pick ${plural(limits.free - c.freeSkills.length, 'free skill')}.`);
  if (school?.startingSkills.length && school.skill && !has(c.professionSkills, school.skill)) {
    add('skills', `Train ${school.skill}: a mage's school skill is one of the six profession skills.`);
  }
  const required = school?.startingSkills.length ? school.requiredSkill : null;
  if (required && !has([...c.professionSkills, ...c.freeSkills], required)) {
    add('skills', `Train ${required}: ${school!.name} needs ${required} ${school!.requiredSkillLevel}.`);
  }

  if (profession) {
    const allowed = school ? [] : profession.heroicAbilities;
    if (allowed.length && !ch.abilities.length) add('magic', 'Choose a heroic ability.');
    for (const a of ch.abilities.filter(a => !has(allowed, a.name))) {
      add('magic', school ? `Remove ${a.name}: the ${school.name} school replaces it.` : `${a.name} is not ${article(profession.name)} heroic ability.`);
    }
  }
  if (school) {
    const spells = ch.spells.filter(s => !isTrick(s)).length;
    const tricks = ch.spells.filter(isTrick).length;
    if (spells < MAX_SPELLS) add('magic', `Pick ${plural(MAX_SPELLS - spells, isAlchemist(c) ? 'rank 1 recipe' : 'rank 1 spell')}.`);
    if (tricks < MAX_TRICKS) add('magic', `Pick ${plural(MAX_TRICKS - tricks, 'magic trick')}.`);
  }

  if (!ch.gear.some(g => same(g.name, SIMPLE_CLOTHES.name))) add('gear', 'Choose a gear package.');
  if (isAlchemist(c)) {
    const known = ch.spells.filter(s => s.kind === 'Recipe').map(s => s.name);
    const doses = ch.gear.filter(isDose);
    if (doses.length !== DOSES || !doses.every(d => has(known, d.name.slice(0, -DOSE.length)))) {
      add('gear', 'Choose 3 finished doses from known recipes.');
    }
  }
  return problems;
}

/** Empty when the character is complete and valid; else what is missing, in book order. */
export function creationProblems(c: Creation, ref: CreationReference): string[] {
  return stepProblems(c, ref).map(p => p.text);
}

/** A step is done when nothing it fixes is missing (magic also needs a profession); an optional step once filled. */
export function stepDone(c: Creation, ref: CreationReference): Record<CreationStep, boolean> {
  const open = new Set(stepProblems(c, ref).map(p => p.step));
  const { weakness, memento, appearance } = c.character;
  const optional: Partial<Record<CreationStep, string>> = { weakness, memento, appearance };
  return Object.fromEntries(CREATION_STEPS.map(step => [
    step,
    step in optional ? !!optional[step]!.trim() : !open.has(step) && (step !== 'magic' || !!professionOf(c, ref)),
  ])) as Record<CreationStep, boolean>;
}

/** The character with every picked skill trained at twice its base chance. */
export function finishCreation(c: Creation, ref: CreationReference): Character {
  const skills = [...c.professionSkills, ...c.freeSkills].flatMap(name => {
    const skill = ref.skills.find(s => same(s.name, name));
    return skill ? [{ name: skill.name, level: 2 * baseChance(c.character.attributes[attributeOf(skill)]), trained: true }] : [];
  });
  return { ...c.character, skills };
}
