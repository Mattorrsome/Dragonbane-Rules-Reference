import { checkCharacter, parseCharacterFile } from './character-file';

const valid = () => ({
  id: 'a', name: 'Aodhan', kin: 'Elf', profession: 'Mage', school: 'Animism', age: 'Young',
  attributes: { STR: 10, CON: 10, AGL: 10, INT: 10, WIL: 10, CHA: 10 },
  skills: [{ name: 'Axes', level: 12, trained: true }], abilities: [], spells: [], gear: [], copper: 5,
});

describe('checkCharacter', () => {
  it('fills missing optional text and lists with defaults', () => {
    const c = checkCharacter(valid(), 1);

    expect(c).toMatchObject({ nickname: '', weakness: '', memento: '', appearance: '', kinAbilities: [], school: 'Animism' });
  });

  it('accepts a null school', () => {
    expect(checkCharacter({ ...valid(), school: null }, 1).school).toBeNull();
  });

  it.each([
    ['attribute above 18', { attributes: { ...valid().attributes, STR: 19 } }, 'Character 1 ("Aodhan"): STR must be a whole number from 1 to 18.'],
    ['attribute missing', { attributes: { STR: 10 } }, 'Character 1 ("Aodhan"): CON must be a whole number from 1 to 18.'],
    ['skill level 19', { skills: [{ name: 'Axes', level: 19, trained: true }] }, 'Character 1 ("Aodhan"): skill 1 needs a name and a level from 0 to 18.'],
    ['skill without a name', { skills: [{ level: 3, trained: false }] }, 'Character 1 ("Aodhan"): skill 1 needs a name and a level from 0 to 18.'],
    ['negative copper', { copper: -1 }, 'Character 1 ("Aodhan"): copper must be a whole number of 0 or more.'],
    ['fractional copper', { copper: 1.5 }, 'Character 1 ("Aodhan"): copper must be a whole number of 0 or more.'],
    ['numeric school', { school: 3 }, 'Character 1 ("Aodhan"): school must be text or null.'],
    ['text name', { nickname: 4 }, 'Character 1 ("Aodhan"): nickname must be text.'],
    ['bad ability', { abilities: [{ name: 'Robust', count: 0 }] }, 'Character 1 ("Aodhan"): heroic ability 1 needs a name and a count of 1 or more.'],
    ['bad spell', { spells: [{ name: 'Dispel', school: 'General Magic', kind: 'Cantrip' }] }, 'Character 1 ("Aodhan"): spell 1 needs a name, a school and a kind (Spell, Trick or Recipe).'],
    ['bad gear', { gear: [{ name: 'Torch', quantity: 0, note: '' }] }, 'Character 1 ("Aodhan"): gear item 1 needs a name and a quantity of 1 or more.'],
    ['no id', { id: '' }, 'Character 1 ("Aodhan") has no id.'],
  ])('rejects %s', (_, change, message) => {
    expect(() => checkCharacter({ ...valid(), ...change }, 1)).toThrow(message);
  });

  it('rejects a non-object and a nameless entry', () => {
    expect(() => checkCharacter(3, 2)).toThrow('Character 2 is not a character.');
    expect(() => checkCharacter({ ...valid(), name: undefined }, 2)).toThrow('Character 2 has no name.');
    expect(() => checkCharacter({ ...valid(), name: '' }, 2)).toThrow('Character 2 has no name.');
  });
});

describe('parseCharacterFile', () => {
  it('names the character and the skill when a level is 19, and returns nothing', () => {
    const file = JSON.stringify([valid(), { ...valid(), id: 'b', name: 'Bryn', skills: [{ name: 'Axes', level: 19, trained: true }] }]);

    expect(() => parseCharacterFile(file)).toThrow('Character 2 ("Bryn"): skill 1 needs a name and a level from 0 to 18.');
  });
});
