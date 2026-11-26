import { EquipmentItemDto, HeroicAbilityDto, SkillDto, SpellDto, SpellKind } from '../api/models';

/** A spell by name, school and kind: names alone are not unique (the Erase trick and the ERASE spell). */
export interface SpellRef {
  name: string;
  school: string;
  kind: SpellKind;
}

export interface DamageBonus {
  attribute: string;
  dice: string;
}

/** "STR: D6" */
export function formatDamageBonus(b: DamageBonus): string {
  return `${b.attribute}: ${b.dice}`;
}

/** The attributes a damage bonus can come from, in the order they are listed. */
export const DAMAGE_BONUS_ATTRIBUTES = ['STR', 'AGL'] as const;

/** The Reference rows hero names (NPCs and characters) are looked up in. */
export interface HeroReference {
  skills: SkillDto[];
  abilities: HeroicAbilityDto[];
  equipment: EquipmentItemDto[];
  spells: SpellDto[];
}

export interface Ability {
  name: string;
  count: number;
}

/** Abilities taken more than once; each Robust is +2 max HP, each Focused +2 max WP. */
export const STACKING_ABILITIES = ['Robust', 'Focused'] as const;

/** Max HP or WP gained per Robust or Focused. */
export const POINTS_PER_STACK = 2;

/** The six attributes in book order. */
export const ATTRIBUTES = ['STR', 'CON', 'AGL', 'INT', 'WIL', 'CHA'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const same = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;

/** The reference item with this name, ignoring case. */
export function findItem(ref: HeroReference, name: string): EquipmentItemDto | undefined {
  return ref.equipment.find(i => same(i.name, name));
}

/** A weapon's or armour's stats first (their effect is often empty), then the item's effect. */
export function describeItem(item: EquipmentItemDto): string | null {
  const parts = [
    item.weapon ? `Damage ${item.weapon.damage}, ${item.weapon.featuresText.toLowerCase()}` : null,
    item.armour ? `Armour rating ${item.armour.rating}` : null,
    item.weapon ? null : item.effect,
  ].filter(Boolean);
  return parts.length ? parts.join('. ') : null;
}

export function isStacking(name: string): boolean {
  return STACKING_ABILITIES.some(s => same(s, name));
}

/** Abilities in their own order, then Robust, then Focused (as the book lists them). */
export function stackingLast<T extends { name: string }>(abilities: readonly T[]): T[] {
  const rank = (name: string) => STACKING_ABILITIES.findIndex(s => same(s, name));
  return [...abilities].sort((a, b) => rank(a.name) - rank(b.name));
}

/**
 * The abilities with this one set to `count`; 0 removes it. Non-stacking abilities are 0 or 1, never below 0.
 * `delta` is the change in count (0 when nothing changed, and then the same array comes back).
 */
export function withAbilityCount(abilities: readonly Ability[], name: string, count: number): { abilities: Ability[]; delta: number } {
  const next = Math.max(0, isStacking(name) ? Math.trunc(count) : Math.min(1, count));
  const current = abilities.find(a => same(a.name, name));
  const delta = next - (current?.count ?? 0);
  if (delta === 0) return { abilities: [...abilities], delta };

  return {
    delta,
    abilities: !current
      ? [...abilities, { name, count: next }]
      : next === 0
        ? abilities.filter(a => a !== current)
        : abilities.map(a => (a === current ? { ...a, count: next } : a)),
  };
}

export const sameSpell =(a: SpellRef, b: SpellRef) => a.name === b.name && a.school === b.school && a.kind === b.kind;

export function addSpell<T extends { spells: SpellRef[] }>(x: T, spell: SpellRef): T {
  return x.spells.some(s => sameSpell(s, spell)) ? x : { ...x, spells: [...x.spells, { ...spell }] };
}

export function removeSpell<T extends { spells: SpellRef[] }>(x: T, spell: SpellRef): T {
  return { ...x, spells: x.spells.filter(s => !sameSpell(s, spell)) };
}
