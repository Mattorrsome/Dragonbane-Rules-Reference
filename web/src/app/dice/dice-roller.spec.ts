import { TestBed } from '@angular/core/testing';
import { DiceRoller, RANDOM } from './dice-roller';
import { seededRandom } from './seeded-random';

describe('DiceRoller', () => {
  const seeded = (seed: number) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: RANDOM, useValue: seededRandom(seed) }] });
    return TestBed.inject(DiceRoller);
  };

  it('is deterministic with a seeded RANDOM', () => {
    const first = seeded(42).roll(20, 6);
    const second = seeded(42).roll(20, 6);

    expect(second).toEqual(first);
    expect(seeded(43).roll(20, 6)).not.toEqual(first);
  });

  it('stays in range', () => {
    const faces = seeded(7).roll(10_000, 6);

    expect(faces.every(f => Number.isInteger(f) && f >= 1 && f <= 6)).toBe(true);
    expect(new Set(faces)).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });
});
