import { EquipmentItemDto, HeroicAbilityDto, NpcDto, SkillDto, SpellDto, SpellKind } from '../api/models';

/** A spell by name, school and kind: names alone are not unique (the Erase trick and the ERASE spell). */
export interface NpcSpellRef {
  name: string;
  school: string;
  kind: SpellKind;
}

/** An NPC being tweaked or saved. Every list names rows of the Reference by name, so it survives a database rebuild. */
export interface Npc {
  name: string;
  description: string;
  /** The typical NPC it was copied from. */
  basedOn: string;
  movement: number;
  hp: number;
  wp: number | null;
  damageBonus: { attribute: string; dice: string } | null;
  skills: { name: string; level: number }[];
  abilities: { name: string; count: number }[];
  gear: string[];
  spells: NpcSpellRef[];
}

export interface SavedNpc extends Npc {
  id: string;
}

/** The Reference rows NPC names are looked up in. */
export interface NpcReference {
  skills: SkillDto[];
  abilities: HeroicAbilityDto[];
  equipment: EquipmentItemDto[];
  spells: SpellDto[];
}

/** Abilities taken more than once; each Robust is +2 max HP, each Focused +2 max WP. */
export const STACKING_ABILITIES = ['Robust', 'Focused'] as const;

/** The source has no Movement column; 10 is the usual human value. */
export const DEFAULT_MOVEMENT = 10;
/** Level given to a weapon skill the NPC lacks when it gains that weapon. */
export const NEW_WEAPON_SKILL_LEVEL = 5;
const POINTS_PER_STACK = 2;

const same = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;

/** The reference item with this name, ignoring case. */
export function findItem(ref: NpcReference, name: string): EquipmentItemDto | undefined {
  return ref.equipment.find(i => same(i.name, name));
}

export function isStacking(name: string): boolean {
  return STACKING_ABILITIES.some(s => same(s, name));
}

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
      damageBonus: dto.damageBonusAttribute && dto.damageBonusDice ? { attribute: dto.damageBonusAttribute, dice: dto.damageBonusDice } : null,
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
  const stacking = isStacking(name);
  const next = Math.max(0, stacking ? Math.trunc(count) : Math.min(1, count));
  const current = npc.abilities.find(a => same(a.name, name));
  const delta = next - (current?.count ?? 0);
  if (delta === 0) return npc;

  const abilities = !current
    ? [...npc.abilities, { name, count: next }]
    : next === 0
      ? npc.abilities.filter(a => a !== current)
      : npc.abilities.map(a => (a === current ? { ...a, count: next } : a));
  const points = delta * POINTS_PER_STACK;
  return {
    ...npc,
    abilities,
    hp: same(name, 'Robust') ? Math.max(0, npc.hp + points) : npc.hp,
    wp: same(name, 'Focused') ? Math.max(0, (npc.wp ?? 0) + points) : npc.wp,
  };
}

const sameSpell = (a: NpcSpellRef, b: NpcSpellRef) => a.name === b.name && a.school === b.school && a.kind === b.kind;

export function addSpell(npc: Npc, spell: NpcSpellRef): Npc {
  return npc.spells.some(s => sameSpell(s, spell)) ? npc : { ...npc, spells: [...npc.spells, { ...spell }] };
}

export function removeSpell(npc: Npc, spell: NpcSpellRef): Npc {
  return { ...npc, spells: npc.spells.filter(s => !sameSpell(s, spell)) };
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
