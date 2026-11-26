import { AgeDto } from '../api/models';
import { DiceRoller } from '../dice/dice-roller';
import { ATTRIBUTES, Attribute } from '../hero/hero';

export const baseChance = (score: number): number =>
  score <= 5 ? 3 : score <= 8 ? 4 : score <= 12 ? 5 : score <= 15 ? 6 : 7;

export const movementModifier = (agl: number): number =>
  agl <= 6 ? -4 : agl <= 9 ? -2 : agl <= 12 ? 0 : agl <= 15 ? 2 : 4;

export const damageBonusDice = (score: number): 'D4' | 'D6' | null => (score <= 12 ? null : score <= 16 ? 'D4' : 'D6');

export const carryingCapacity = (str: number): number => Math.ceil(str / 2);

/** 4D6, drop the lowest. */
export function rollAttribute(roller: DiceRoller): number {
  const faces = roller.roll(4, 6).sort((a, b) => a - b);
  return faces[1] + faces[2] + faces[3];
}

/** The row whose roll range holds a `sides`-sided roll. */
export function rollOnTable<T extends { rollFrom: number; rollTo: number }>(roller: DiceRoller, sides: number, rows: readonly T[]): T {
  const [roll] = roller.roll(1, sides);
  return rows.find(r => roll >= r.rollFrom && roll <= r.rollTo) ?? rows[rows.length - 1];
}

/** The age's attribute adjustments, each score kept within 3..18. */
export function applyAge(scores: Record<Attribute, number>, age: AgeDto): Record<Attribute, number> {
  const next = { ...scores };
  for (const { attribute, delta } of age.adjustments) {
    if ((ATTRIBUTES as readonly string[]).includes(attribute)) {
      const a = attribute as Attribute;
      next[a] = Math.min(18, Math.max(3, next[a] + delta));
    }
  }
  return next;
}
