import { NpcDto } from '../api/models';
import { Attribute, ATTRIBUTES, DAMAGE_BONUS_ATTRIBUTES, DamageBonus, findItem, HeroReference, POINTS_PER_STACK, same, SpellRef, withAbilityCount } from '../hero/hero';

export type NpcSpellRef = SpellRef;
export type NpcReference = HeroReference;

/** An NPC being tweaked or saved. Every list names rows of the Reference by name, so it survives a database rebuild. */
export interface Npc {
  name: string;
  description: string;
  /** The typical NPC it was copied from. */
  basedOn: string;
  movement: number;
  hp: number;
  wp: number | null;
  /** At most one per attribute, STR before AGL. */
  damageBonuses: DamageBonus[];
  skills: { name: string; level: number }[];
  abilities: { name: string; count: number }[];
  gear: string[];
  spells: NpcSpellRef[];
}

export interface SavedNpc extends Npc {
  id: string;
}

/** The source has no Movement column; 10 is the usual human value. */
export const DEFAULT_MOVEMENT = 10;
/** Level given to a weapon skill the NPC lacks when it gains that weapon. */
export const NEW_WEAPON_SKILL_LEVEL = 5;

/** A copy of a typical NPC to tweak; weapons it carries without their skill get that skill at 5. */
export function fromTypical(dto: NpcDto, ref: NpcReference): Npc {
  return withWeaponSkills(
    {
      name: dto.name,
      description: '',
      basedOn: dto.name,
      movement: DEFAULT_MOVEMENT,
      hp: dto.hp,
      wp: dto.wp ?? null,
      damageBonuses: dto.damageBonusAttribute && dto.damageBonusDice ? [{ attribute: dto.damageBonusAttribute, dice: dto.damageBonusDice }] : [],
      skills: dto.skills.map(s => ({ name: s.name, level: s.level })),
      abilities: dto.heroicAbilities.map(a => ({ name: a.name, count: a.count })),
      gear: [...dto.gear],
      spells: [],
    },
    ref,
  );
}

/** Adds an item (named as in the Reference when it exists there); a weapon brings its skill at 5 if missing. */
export function addGear(npc: Npc, itemName: string, ref: NpcReference): Npc {
  return withWeaponSkills({ ...npc, gear: [...npc.gear, findItem(ref, itemName)?.name ?? itemName] }, ref);
}

/** Removes one item by name. Its weapon skill stays; the GM removes that separately. */
export function removeGear(npc: Npc, itemName: string): Npc {
  const at = npc.gear.findIndex(g => same(g, itemName));
  return at < 0 ? npc : { ...npc, gear: npc.gear.filter((_, i) => i !== at) };
}

/**
 * Sets how many times the NPC has an ability; 0 removes it. Non-stacking abilities are 0 or 1. Robust moves HP and
 * Focused moves WP by 2 per step (no WP counts as 0), never below 0.
 */
export function setAbilityCount(npc: Npc, name: string, count: number): Npc {
  const { abilities, delta } = withAbilityCount(npc.abilities, name, count);
  if (delta === 0) return npc;

  const points = delta * POINTS_PER_STACK;
  return {
    ...npc,
    abilities,
    hp: same(name, 'Robust') ? Math.max(0, npc.hp + points) : npc.hp,
    wp: same(name, 'Focused') ? Math.max(0, (npc.wp ?? 0) + points) : npc.wp,
  };
}

/** Sets one attribute's bonus dice; null removes it. The other attribute's bonus stays. */
export function setDamageBonus(npc: Npc, attribute: string, dice: string | null): Npc {
  const others = npc.damageBonuses.filter(b => b.attribute !== attribute);
  const order = (b: DamageBonus) => DAMAGE_BONUS_ATTRIBUTES.indexOf(b.attribute as (typeof DAMAGE_BONUS_ATTRIBUTES)[number]);
  return { ...npc, damageBonuses: (dice ? [...others, { attribute, dice }] : others).sort((a, b) => order(a) - order(b)) };
}

/** Attribute score by damage bonus dice: the core rules' guideline for NPC attribute rolls. */
const SCORE_BY_BONUS: Record<string, number> = { D6: 17, D4: 14 };
const BASE_ATTRIBUTE = 10;

/**
 * The scores an NPC rolls attributes against, by the core rules' guidelines: STR and AGL from their damage bonus
 * (+D6 17, +D4 14, none 10); CON is max HP less 2 per Robust; WIL is max WP less 2 per Focused, or 10 with no WP;
 * INT and CHA are 10. Never below 0, in case HP or WP was lowered by hand.
 */
export function npcAttributes(npc: Npc): Record<Attribute, number> {
  const bonus = (attribute: string) => SCORE_BY_BONUS[npc.damageBonuses.find(b => b.attribute === attribute)?.dice ?? ''] ?? BASE_ATTRIBUTE;
  const stacks = (name: string) => npc.abilities.find(a => same(a.name, name))?.count ?? 0;
  return {
    STR: bonus('STR'),
    CON: Math.max(0, npc.hp - POINTS_PER_STACK * stacks('Robust')),
    AGL: bonus('AGL'),
    INT: BASE_ATTRIBUTE,
    WIL: npc.wp === null ? BASE_ATTRIBUTE : Math.max(0, npc.wp - POINTS_PER_STACK * stacks('Focused')),
    CHA: BASE_ATTRIBUTE,
  };
}

/** Appends each carried weapon's skill at 5 when the NPC lacks it. */
function withWeaponSkills(npc: Npc, ref: NpcReference): Npc {
  const skills = [...npc.skills];
  for (const name of npc.gear) {
    const skill = findItem(ref, name)?.weapon?.skill;
    if (skill && !skills.some(s => same(s.name, skill))) skills.push({ name: skill, level: NEW_WEAPON_SKILL_LEVEL });
  }
  return skills.length === npc.skills.length ? npc : { ...npc, skills };
}
