import { DiceRoller } from '../dice/dice-roller';
import { ATTRIBUTES, Attribute, same } from '../hero/hero';
import { Character, CreationReference } from './character';
import {
  Creation, CreationStep, DOSES, Step, chooseGearPackage, newCreation, professionSkillList, schoolsAvailable, setAge, setAlchemistDoses,
  setAttributes, setHeroicAbility, setKin, setProfession, setSchool, skillLimits, spellOptions, toggleSkill, toggleSpell,
  unchanged,
} from './creation';
import { rollAttribute, rollOnTable } from './rules';

/** Book order, except magic before skills: a mage's skill list comes from the school. */
const RANDOM_ORDER: CreationStep[] =
  ['kin', 'profession', 'age', 'name', 'attributes', 'magic', 'skills', 'weakness', 'memento', 'gear', 'appearance'];

/** One item, on a die with as many sides as there are items. */
const oneOf = <T>(roller: DiceRoller, items: readonly T[]): T => items[roller.roll(1, items.length)[0] - 1];

function shuffled<T>(roller: DiceRoller, items: readonly T[]): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (pool.length) out.push(...pool.splice(roller.roll(1, pool.length)[0] - 1, 1));
  return out;
}

/** A table with one roll per row, in the shape `rollOnTable` reads. */
const byRoll = <T extends { roll: number }>(rows: readonly T[]) => rows.map(r => ({ ...r, rollFrom: r.roll, rollTo: r.roll }));
const withCharacter = (c: Creation, changes: Partial<Character>): Step => unchanged({ ...c, character: { ...c.character, ...changes } });
const picked = (c: Creation, name: string) => [...c.professionSkills, ...c.freeSkills].some(s => same(s, name));

/** Re-rolls an alchemist's three doses from the known recipes once a gear package is chosen; anyone else is unchanged. */
function rollDoses(c: Creation, roller: DiceRoller): Creation {
  const known = c.character.spells.filter(s => s.kind === 'Recipe').map(s => s.name);
  if (c.gearPackage === null || !known.length) return c;
  return setAlchemistDoses(c, Array.from({ length: DOSES }, () => oneOf(roller, known)));
}

/** Rolls one creation step through the same setters as a choice; a step whose earlier step is missing changes nothing. */
export function rollStep(c: Creation, step: CreationStep, ref: CreationReference, roller: DiceRoller): Step {
  const kin = ref.kin.find(k => same(k.name, c.character.kin));
  const profession = ref.professions.find(p => same(p.name, c.character.profession));
  const school = ref.schools.find(s => same(s.name, c.character.school ?? ''));
  switch (step) {
    case 'kin':
      return unchanged(setKin(c, rollOnTable(roller, 12, ref.kin)));
    case 'profession':
      return setProfession(c, rollOnTable(roller, 10, byRoll(ref.professions)), ref);
    case 'age':
      return setAge(c, rollOnTable(roller, 6, ref.ages), ref);
    case 'name': {
      if (!kin) return unchanged(c);
      const name = oneOf(roller, kin.names);
      return withCharacter(c, { name, nickname: profession?.nicknames.length ? oneOf(roller, profession.nicknames) : c.character.nickname });
    }
    case 'attributes':
      return setAttributes(c, Object.fromEntries(ATTRIBUTES.map(a => [a, rollAttribute(roller)])) as Record<Attribute, number>, ref);
    case 'skills': {
      // A mage (no skill list of its own) takes the school's list: roll magic first.
      if (!profession || (!profession.skills.length && !school)) return unchanged(c);
      // A mage's school skill and Enchanting's Crafting first, so they are among the profession picks.
      const own = school?.startingSkills.length ? [school.skill, school.requiredSkill].filter((s): s is string => !!s) : [];
      let next: Creation = { ...c, professionSkills: [], freeSkills: [] };
      const { profession: professionPicks, free } = skillLimits(next, ref);
      for (const s of [...own, ...shuffled(roller, professionSkillList(next, ref))]) {
        if (next.professionSkills.length < professionPicks && !picked(next, s)) next = toggleSkill(next, s, ref);
      }
      for (const s of shuffled(roller, ref.skills.filter(s => s.type !== 'Secondary').map(s => s.name))) {
        if (next.freeSkills.length < free && !picked(next, s)) next = toggleSkill(next, s, ref);
      }
      return unchanged(next);
    }
    case 'magic': {
      if (!profession) return unchanged(c);
      // A mage (no skill list of its own) needs a school; anyone else may also keep their heroic ability.
      const schools = schoolsAvailable(c, ref);
      const chosen = oneOf(roller, profession.skills.length ? [null, ...schools] : schools) ?? null;
      const { creation, cleared } = setSchool(c, chosen, ref);
      let next = creation;
      if (!chosen && profession.heroicAbilities.length) next = setHeroicAbility(next, oneOf(roller, profession.heroicAbilities));
      next = next.character.spells.reduce((x, s) => toggleSpell(x, s, ref), next);
      next = shuffled(roller, spellOptions(next, ref)).reduce((x, s) => toggleSpell(x, s, ref), next);
      return { creation: rollDoses(next, roller), cleared };
    }
    case 'weakness': {
      const { name, text } = rollOnTable(roller, 20, byRoll(ref.weaknesses));
      return withCharacter(c, { weakness: `${name}. ${text}` });
    }
    case 'memento':
      return withCharacter(c, { memento: rollOnTable(roller, 20, byRoll(ref.mementos)).text });
    case 'appearance':
      return withCharacter(c, { appearance: rollOnTable(roller, 20, byRoll(ref.appearances)).text });
    case 'gear': {
      if (!profession) return unchanged(c);
      const pkg = rollOnTable(roller, 6, profession.gearPackages);
      const entries = [...pkg.entries, ...(school?.extras.flatMap(x => x.entries) ?? [])];
      const choices = Object.fromEntries(entries.flatMap((e, i) => (e.options.length > 1 ? [[i, roller.roll(1, e.options.length)[0] - 1]] : [])));
      // A roll resolves the package afresh (dice quantities too), even when it lands on the one held.
      return unchanged(rollDoses(chooseGearPackage({ ...c, gearPackage: null }, pkg, ref, roller, choices).creation, roller));
    }
  }
}

/** A complete, valid character: every step rolled, the optional ones included. */
export function randomCharacter(ref: CreationReference, roller: DiceRoller): Creation {
  return RANDOM_ORDER.reduce((c, step) => rollStep(c, step, ref, roller).creation, newCreation());
}
