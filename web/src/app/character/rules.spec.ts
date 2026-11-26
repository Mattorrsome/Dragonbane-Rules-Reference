import { TestBed } from '@angular/core/testing';
import { AgeDto } from '../api/models';
import { ATTRIBUTES, Attribute } from '../hero/hero';
import { DiceRoller, RANDOM } from '../dice/dice-roller';
import { applyAge, baseChance, carryingCapacity, damageBonusDice, movementModifier, rollAttribute, rollOnTable } from './rules';

function rollerGiving(...faces: number[]): DiceRoller {
  const queue = [...faces];
  TestBed.configureTestingModule({ providers: [{ provide: RANDOM, useValue: () => (queue.shift()! - 1) / 6 + 0.01 }] });
  return TestBed.inject(DiceRoller);
}

const scores = (v: number) => Object.fromEntries(ATTRIBUTES.map(a => [a, v])) as Record<Attribute, number>;

describe('rules tables', () => {
  it('base chance boundaries', () => {
    expect([1, 5, 6, 8, 9, 12, 13, 15, 16, 18].map(baseChance)).toEqual([3, 3, 4, 4, 5, 5, 6, 6, 7, 7]);
  });
  it('movement modifier boundaries', () => {
    expect([6, 7, 9, 10, 12, 13, 15, 16].map(movementModifier)).toEqual([-4, -2, -2, 0, 0, 2, 2, 4]);
  });
  it('damage bonus boundaries', () => {
    expect([12, 13, 16, 17].map(damageBonusDice)).toEqual([null, 'D4', 'D4', 'D6']);
  });
  it('carrying capacity rounds up', () => {
    expect(carryingCapacity(7)).toBe(4);
  });
});

describe('rolls', () => {
  it('rollAttribute drops the lowest of 4D6', () => {
    expect(rollAttribute(rollerGiving(1, 6, 6, 6))).toBe(18);
  });
  it('rollOnTable picks the row covering the roll', () => {
    const rows = [{ rollFrom: 1, rollTo: 3, n: 'a' }, { rollFrom: 4, rollTo: 6, n: 'b' }];
    expect(rollOnTable(rollerGiving(5), 6, rows).n).toBe('b');
  });
});

describe('applyAge', () => {
  const old: AgeDto = { id: 1, name: 'Old', rollFrom: 1, rollTo: 1, freeSkills: 0, adjustments: [{ attribute: 'STR', delta: -2 }, { attribute: 'WIL', delta: 1 }] };
  it('floors at 3 and caps at 18', () => {
    const result = applyAge({ ...scores(10), STR: 3, WIL: 18 }, old);
    expect(result.STR).toBe(3);
    expect(result.WIL).toBe(18);
    expect(result.CON).toBe(10);
  });
});
