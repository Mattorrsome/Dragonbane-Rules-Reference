import { SpellDto } from '../api/models';
import { DiceRoller } from '../dice/dice-roller';

/** Grimoire contents: `count` distinct spells of the school and rank (0 or less means tricks), fewer if fewer exist. */
export function suggestSpells(spells: readonly SpellDto[], schoolId: number, rank: number, count: number, roller: DiceRoller): SpellDto[] {
  const pool = spells.filter(s => s.schoolId === schoolId && (rank <= 0 ? s.kind === 'Trick' : s.rank === rank));
  const picked: SpellDto[] = [];
  while (picked.length < count && pool.length) picked.push(...pool.splice(roller.roll(1, pool.length)[0] - 1, 1));
  return picked;
}
