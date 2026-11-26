import {
  AgeDto, AppearanceDto, KinDto, MagicSchoolDto, MementoDto, ProfessionDto, SkillDto, WeaknessDto,
} from '../api/models';
import {
  Ability, Attribute, DAMAGE_BONUS_ATTRIBUTES, DamageBonus, HeroReference, POINTS_PER_STACK, SpellRef, same,
  withAbilityCount,
} from '../hero/hero';
import { baseChance, carryingCapacity, damageBonusDice, movementModifier } from './rules';

export interface CharacterSkill {
  name: string;
  level: number;
  trained: boolean;
}

export interface GearItem {
  name: string;
  quantity: number;
  note: string;
}

export interface Character {
  name: string;
  nickname: string;
  kin: string;
  profession: string;
  school: string | null;
  age: string;
  attributes: Record<Attribute, number>;
  skills: CharacterSkill[];
  abilities: Ability[];
  kinAbilities: string[];
  spells: SpellRef[];
  gear: GearItem[];
  copper: number;
  weakness: string;
  memento: string;
  appearance: string;
}

export type SavedCharacter = Character & { id: string };

export interface CreationReference extends HeroReference {
  kin: KinDto[];
  professions: ProfessionDto[];
  ages: AgeDto[];
  schools: MagicSchoolDto[];
  mementos: MementoDto[];
  weaknesses: WeaknessDto[];
  appearances: AppearanceDto[];
}

/** The stored level, else the attribute's base chance; secondary skills (and Harmonism) start at 0. */
export function skillLevel(c: Character, skill: SkillDto): number {
  const stored = c.skills.find(s => same(s.name, skill.name));
  if (stored) return stored.level;
  if (skill.type === 'Secondary') return 0;
  return baseChance(c.attributes[skill.attribute.slice(0, 3) as Attribute]);
}

const countOf = (c: Character, name: string) => c.abilities.find(a => same(a.name, name))?.count ?? 0;

export function derived(c: Character, ref: CreationReference) {
  const kin = ref.kin.find(k => same(k.name, c.kin));
  const damageBonuses: DamageBonus[] = [];
  for (const attribute of DAMAGE_BONUS_ATTRIBUTES) {
    const dice = damageBonusDice(c.attributes[attribute]);
    if (dice) damageBonuses.push({ attribute, dice });
  }
  return {
    hpMax: c.attributes.CON + POINTS_PER_STACK * countOf(c, 'Robust'),
    wpMax: c.attributes.WIL + POINTS_PER_STACK * countOf(c, 'Focused'),
    movement: (kin?.movement ?? 0) + movementModifier(c.attributes.AGL),
    damageBonuses,
    capacity: carryingCapacity(c.attributes.STR),
  };
}

/** Sets a skill level (clamped 0-18); a skill not yet listed is added untrained. */
export function setSkillLevel(c: Character, name: string, level: number): Character {
  const next = Math.min(18, Math.max(0, Math.trunc(level)));
  const has = c.skills.some(s => same(s.name, name));
  return {
    ...c,
    skills: has
      ? c.skills.map(s => (same(s.name, name) ? { ...s, level: next } : s))
      : [...c.skills, { name, level: next, trained: false }],
  };
}

export function setCharacterAbility(c: Character, name: string, count: number): Character {
  return { ...c, abilities: withAbilityCount(c.abilities, name, count).abilities };
}
