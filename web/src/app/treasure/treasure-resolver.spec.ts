import { DiceRoller } from '../dice/dice-roller';
import { byRoll, TREASURE } from './treasure.fixture';
import { grimoireRolls, resolveEntry, rollTreasure } from './treasure-resolver';

const rates = { copper: 1, silver: 10, gold: 100 };

/** Returns queued faces in order, ignoring the die size. */
const fakeRoller = (...faces: number[]) => ({ roll: (count: number) => faces.splice(0, count) }) as unknown as DiceRoller;

describe('treasure resolver', () => {
  it('resolves coins via rates', () => {
    const [coins] = resolveEntry(byRoll(10), fakeRoller(3, 4), rates).rolls;

    expect(coins.dice.total).toBe(70);
    expect(coins.valueCopper).toBe(700);
  });

  it('resolves a pick list', () => {
    const [pick] = resolveEntry(byRoll(30), fakeRoller(2), rates).rolls;

    expect(pick.outcome?.label).toBe('short bow');
    expect(pick.outcome?.equipmentItemId).toBe(31);
  });

  it('resolves gem value', () => {
    expect(resolveEntry(byRoll(26), fakeRoller(5), rates).rolls[0].valueCopper).toBe(2500);
  });

  it('healing potion rolls no HP', () => {
    const [pick] = resolveEntry(byRoll(36), fakeRoller(6), rates).rolls;

    expect(pick.outcome?.label).toBe('healing potion 3D6 HP');
    expect(pick.nested).toEqual([]);
  });

  it('resolves grimoire rank with modifier', () => {
    const [school, rank, count] = resolveEntry(byRoll(35), fakeRoller(1, 1, 3), rates).rolls;

    expect(school.outcome?.face).toBe(1);
    expect(rank.dice.total).toBe(0);
    expect(count.dice.total).toBe(3);
  });

  it('text-only entry has no rolls', () => {
    expect(resolveEntry(byRoll(37), fakeRoller(), rates).rolls).toEqual([]);
  });

  it('rolls D40 to pick the entry', () => {
    const result = rollTreasure(TREASURE, fakeRoller(26, 1), rates);

    expect(result.entry.roll).toBe(26);
    expect(result.d40?.total).toBe(26);
    expect(result.rolls[0].outcome?.label).toBe('glass');
  });
});

describe('grimoireRolls', () => {
  it('reads school, rank and count from a grimoire', () => {
    expect(grimoireRolls(resolveEntry(byRoll(35), fakeRoller(1, 1, 3), rates))).toEqual({ schoolId: 2, rank: 0, count: 3 });
  });

  it('is null for anything else', () => {
    expect(grimoireRolls(resolveEntry(byRoll(40), fakeRoller(2), rates))).toBeNull();
  });
});
