import { SpellDto, SpellKind } from '../api/models';
import { DiceRoller } from '../dice/dice-roller';
import { suggestSpells } from './spell-suggestions';

const spell = (id: number, schoolId: number, rank: number, kind: SpellKind): SpellDto => ({
  id, name: `SPELL ${id}`, schoolId, school: `School ${schoolId}`, rank, kind, castingTime: 'Action',
  requirementText: 'Word', description: '', ranked: null, recipe: null,
});

/** Always takes the first spell still in the pool, so the order is deterministic. */
const first = { roll: () => [1] } as unknown as DiceRoller;

const SPELLS = [
  spell(1, 2, 0, 'Trick'), spell(2, 2, 1, 'Spell'), spell(3, 2, 1, 'Spell'), spell(4, 2, 1, 'Spell'),
  spell(5, 2, 2, 'Spell'), spell(6, 4, 1, 'Spell'), spell(7, 2, 0, 'Recipe'),
];

describe('suggestSpells', () => {
  it('returns the requested count without repeats', () => {
    const picked = suggestSpells(SPELLS, 2, 1, 2, first);

    expect(picked.map(s => s.id)).toEqual([2, 3]);
  });

  it('returns the whole pool when fewer spells match than were rolled', () => {
    expect(suggestSpells(SPELLS, 2, 2, 4, first).map(s => s.id)).toEqual([5]);
  });

  it('rank 0 means tricks only', () => {
    expect(suggestSpells(SPELLS, 2, 0, 4, first).map(s => s.id)).toEqual([1]);
  });

  it('never suggests another school', () => {
    expect(suggestSpells(SPELLS, 4, 1, 4, first).map(s => s.id)).toEqual([6]);
  });

  it('uses the roller to pick from what is left', () => {
    const faces = [3, 1];
    const roller = { roll: (_: number, sides: number) => [Math.min(faces.shift()!, sides)] } as unknown as DiceRoller;

    expect(suggestSpells(SPELLS, 2, 1, 2, roller).map(s => s.id)).toEqual([4, 2]);
  });
});
