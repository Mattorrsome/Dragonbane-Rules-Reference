import { TestBed } from '@angular/core/testing';
import { Character } from './character';
import { CharacterStore } from './character.store';

const KEY = 'dragonbane.characters.v1';
const hero = (name: string): Character => ({
  name, nickname: '', kin: 'Human', profession: 'Fighter', school: null, age: 'Adult',
  attributes: { STR: 12, CON: 11, AGL: 10, INT: 9, WIL: 8, CHA: 7 },
  skills: [{ name: 'Axes', level: 10, trained: true }],
  abilities: [{ name: 'Robust', count: 2 }], kinAbilities: ['Adaptive'],
  spells: [{ name: 'Dispel', school: 'General Magic', kind: 'Spell' }],
  gear: [{ name: 'Torch', quantity: 2, note: '' }], copper: 120,
  weakness: 'Greedy. Cannot resist treasure.', memento: 'A ring', appearance: 'Scarred',
});

/** A fresh store, as after a page reload (reads storage on creation). */
function store(): CharacterStore {
  TestBed.resetTestingModule();
  return TestBed.inject(CharacterStore);
}

describe('CharacterStore', () => {
  beforeEach(() => localStorage.clear());

  it('save keeps a character across a reload', () => {
    const saved = store().save(hero('Aodhan'));

    expect(saved.id).toMatch(/\S/);
    expect(store().characters()).toEqual([saved]);
  });

  it('corrupt JSON gives an empty list and leaves storage unchanged until a save', () => {
    localStorage.setItem(KEY, '{bad');

    const s = store();

    expect(s.characters()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBe('{bad');
    s.save(hero('A'));
    expect(JSON.parse(localStorage.getItem(KEY)!)).toHaveLength(1);
  });

  it('an array with one bad entry keeps the good ones', () => {
    const good = store().save(hero('Good'));
    localStorage.setItem(KEY, JSON.stringify([good, { id: 'x', name: 'Bad', attributes: 'no' }]));

    expect(store().characters()).toEqual([good]);
  });

  it('an export imports back equal, and an import with a bad skill level imports nothing', () => {
    const s = store();
    s.save(hero('A'));
    s.save(hero('B'));
    const json = s.exportJson();

    const other = store();
    expect(other.importJson(json)).toBe(2);
    expect(other.characters()).toEqual(s.characters());

    const bad = JSON.parse(json);
    bad[1].skills[0].level = 19;
    expect(() => other.importJson(JSON.stringify(bad))).toThrow('Character 2 ("B"): skill 1 needs a name and a level from 0 to 18.');
    expect(other.characters()).toHaveLength(2);
  });

  it('remove deletes only that character', () => {
    const s = store();
    const a = s.save(hero('A'));
    s.save(hero('B'));

    s.remove(a.id);

    expect(store().characters().map(c => c.name)).toEqual(['B']);
  });
});
