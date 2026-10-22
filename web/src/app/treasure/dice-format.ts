import { RolledDice } from '../dice/dice-roller';

/** Shows a roll and its arithmetic, e.g. "2D6 → 3 + 4 = 7 × 10 = 70" or "D4-1 → 3 - 1 = 2". */
export function describeDice(d: RolledDice): string {
  const label = `${d.count > 1 ? d.count : ''}D${d.sides}${d.modifier > 0 ? `+${d.modifier}` : d.modifier < 0 ? d.modifier : ''}`;
  const sum = d.faces.reduce((a, b) => a + b, 0);
  let working = d.faces.join(' + ');
  if (d.faces.length > 1) working += ` = ${sum}`;
  if (d.modifier !== 0) working += ` ${d.modifier < 0 ? '-' : '+'} ${Math.abs(d.modifier)} = ${sum + d.modifier}`;
  if (d.multiplier !== 1) working += ` × ${d.multiplier} = ${d.total}`;
  return `${label} → ${working}`;
}
