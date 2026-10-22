import { Injectable, InjectionToken, inject } from '@angular/core';

/** Random source in [0, 1). Provide `seededRandom(seed)` to make rolls reproducible. */
export const RANDOM = new InjectionToken<() => number>('RANDOM', { factory: () => Math.random });

@Injectable({ providedIn: 'root' })
export class DiceRoller {
  private readonly random = inject(RANDOM);

  /** Rolls `count` dice with `sides` faces; each face is 1..sides. */
  roll(count: number, sides: number): number[] {
    return Array.from({ length: count }, () => Math.floor(this.random() * sides) + 1);
  }
}

export interface RolledDice {
  count: number;
  sides: number;
  faces: number[];
  modifier: number;
  multiplier: number;
  /** (sum of faces + modifier) × multiplier */
  total: number;
}

export function rollDice(roller: DiceRoller, count: number, sides: number, modifier = 0, multiplier = 1): RolledDice {
  const faces = roller.roll(count, sides);
  const total = (faces.reduce((sum, face) => sum + face, 0) + modifier) * multiplier;
  return { count, sides, faces, modifier, multiplier, total };
}
