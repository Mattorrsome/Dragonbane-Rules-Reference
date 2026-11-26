import { SkillDto } from '../api/models';
import { ATTRIBUTES, Attribute } from '../hero/hero';
import { Character, CreationReference, derived, setCharacterAbility, setSkillLevel, skillLevel } from './character';

const ref = { kin: [{ name: 'Human', movement: 10 }] } as unknown as CreationReference;
const skill = (name: string, type: string, attribute: string) => ({ name, type, attribute }) as SkillDto;

function aodhan(): Character {
  const attributes = Object.fromEntries(ATTRIBUTES.map(a => [a, 10])) as Record<Attribute, number>;
  return {
    name: 'Aodhan', nickname: '', kin: 'Human', profession: 'Mage', school: null, age: 'Adult',
    attributes: { ...attributes, CON: 11, WIL: 18, AGL: 9 },
    skills: [], abilities: [], kinAbilities: [], spells: [], gear: [], copper: 0, weakness: '', memento: '', appearance: '',
  };
}

describe('derived', () => {
  it('Aodhan has HP 11, WP 18, movement 8', () => {
    const d = derived(aodhan(), ref);
    expect([d.hpMax, d.wpMax, d.movement]).toEqual([11, 18, 8]);
  });
  it('Robust x2 makes HP 15', () => {
    expect(derived(setCharacterAbility(aodhan(), 'Robust', 2), ref).hpMax).toBe(15);
  });
  it('CON 13 raises HP to 17', () => {
    const c = setCharacterAbility(aodhan(), 'Robust', 2);
    expect(derived({ ...c, attributes: { ...c.attributes, CON: 13 } }, ref).hpMax).toBe(17);
  });
  it('lists damage bonuses STR first', () => {
    const c = aodhan();
    expect(derived({ ...c, attributes: { ...c.attributes, STR: 17, AGL: 13 } }, ref).damageBonuses)
      .toEqual([{ attribute: 'STR', dice: 'D6' }, { attribute: 'AGL', dice: 'D4' }]);
  });
});

describe('skills', () => {
  it('uses base chance, 0 for untrained secondary, stored level otherwise', () => {
    const c = aodhan();
    expect(skillLevel(c, skill('Awareness', 'Core', 'INT'))).toBe(5);
    expect(skillLevel(c, skill('Animism', 'Secondary', 'INT'))).toBe(0);
    expect(skillLevel(setSkillLevel(c, 'Awareness', 14), skill('Awareness', 'Core', 'INT'))).toBe(14);
  });
  it('setSkillLevel clamps 0-18 and adds an untrained entry', () => {
    const c = setSkillLevel(aodhan(), 'Swords', 30);
    expect(c.skills).toEqual([{ name: 'Swords', level: 18, trained: false }]);
    expect(setSkillLevel(c, 'Swords', -2).skills[0].level).toBe(0);
  });
});
