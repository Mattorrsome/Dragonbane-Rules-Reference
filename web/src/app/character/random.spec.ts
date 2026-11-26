import { TestBed } from '@angular/core/testing';
import { DiceRoller, RANDOM } from '../dice/dice-roller';
import { seededRandom } from '../dice/seeded-random';
import { creationRef as ref, fixture } from './character.fixture';
import { Creation, creationProblems, finishCreation, newCreation, setKin, setProfession } from './creation';
import { randomCharacter, rollStep } from './random';

function seeded(seed: number): DiceRoller {
  TestBed.resetTestingModule().configureTestingModule({ providers: [{ provide: RANDOM, useValue: seededRandom(seed) }] });
  return TestBed.inject(DiceRoller);
}

describe('randomCharacter', () => {
  let characters: Creation[];
  beforeAll(() => {
    characters = Array.from({ length: 500 }, (_, i) => randomCharacter(ref, seeded(i + 1)));
  });

  it('is complete and valid for seeds 1..500', () => {
    const invalid = characters.map((c, i) => ({ seed: i + 1, problems: creationProblems(c, ref) })).filter(x => x.problems.length);
    expect(invalid).toEqual([]);
  });

  it('includes harmonists, alchemists and enchanters, and every enchanter has Crafting 12 or more', () => {
    const schools = characters.map(c => c.character.school);
    expect(schools).toContain('Harmonism');
    expect(schools).toContain('Alchemy');
    expect(schools).toContain('Enchanting');
    for (const c of characters.filter(c => c.character.school === 'Enchanting')) {
      expect(finishCreation(c, ref).skills.find(s => s.name === 'Crafting')!.level).toBeGreaterThanOrEqual(12);
    }
  });

  it('fills the optional steps', () => {
    const { character } = characters[0];
    expect([character.nickname, character.weakness, character.memento, character.appearance].every(Boolean)).toBe(true);
  });
});

describe('rollStep', () => {
  const human = (): Creation => setKin(newCreation(), fixture(ref.kin, 'Human'));

  it('kin: a D12 of 11 gives Mallard', () => {
    expect(rollStep(newCreation(), 'kin', ref, seeded(30)).creation.character.kin).toBe('Mallard');
  });

  it('name: a name of the kin and a nickname of the profession', () => {
    const c = setProfession(human(), fixture(ref.professions, 'Thief'), ref).creation;
    const { character } = rollStep(c, 'name', ref, seeded(1)).creation;
    expect(fixture(ref.kin, 'Human').names).toContain(character.name);
    expect(fixture(ref.professions, 'Thief').nicknames).toContain(character.nickname);
  });

  it('weakness: name and text from the D20 table', () => {
    const weakness = rollStep(human(), 'weakness', ref, seeded(1)).creation.character.weakness;
    expect(ref.weaknesses.map(w => `${w.name}. ${w.text}`)).toContain(weakness);
  });

  it('a step that needs an earlier one changes nothing without it', () => {
    const c = newCreation();
    expect(rollStep(c, 'gear', ref, seeded(1))).toEqual({ creation: c, cleared: [] });
    expect(rollStep(c, 'name', ref, seeded(1))).toEqual({ creation: c, cleared: [] });
  });
});
