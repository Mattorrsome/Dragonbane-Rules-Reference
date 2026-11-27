import { EquipmentItemDto, SpellDto } from '../api/models';
import { ATTRIBUTES, Attribute } from '../hero/hero';
import { buildCharacterCard, characterCardToMarkdown, characterCardToText } from './character-card';
import { Character, CreationReference } from './character';
import { creationRef } from './character.fixture';

const fireball = { ...creationRef.spells.find(s => s.name === 'FIREBALL')!, description: 'Hurts.', castingTime: 'Action', ranked: { range: '20 metres', duration: 'Instant' } } as unknown as SpellDto;
const ref: CreationReference = {
  ...creationRef,
  spells: creationRef.spells.map(s => (s.name === 'FIREBALL' ? fireball : s)),
  abilities: creationRef.abilities.map(a => ({ ...a, effect: `${a.name} effect` })),
  equipment: [
    { name: 'Staff', weapon: { skill: 'Staves', damage: 'D8', featuresText: 'Two-handed' }, armour: null },
    { name: 'Leather armour', weapon: null, armour: { rating: 1 } },
    { name: 'Rope', weapon: null, armour: null },
  ] as unknown as EquipmentItemDto[],
};

function aodhan(): Character {
  const attributes = Object.fromEntries(ATTRIBUTES.map(a => [a, 10])) as Record<Attribute, number>;
  return {
    name: 'Archmaster Aodhan', nickname: '', kin: 'Human', profession: 'Mage', school: 'Elementalism', age: 'Old',
    attributes: { ...attributes, STR: 8, CON: 11, AGL: 9, INT: 16, WIL: 18, CHA: 14 },
    skills: [{ name: 'Elementalism', level: 6, trained: true }, { name: 'Swimming', level: 5, trained: false }, { name: 'Evade', level: 9, trained: false }],
    abilities: [{ name: 'Robust', count: 1 }],
    kinAbilities: ['Adaptive'],
    spells: [{ name: 'FIREBALL', school: 'Elementalism', kind: 'Spell' }],
    gear: [{ name: 'Staff', quantity: 1, note: '' }, { name: 'Leather armour', quantity: 1, note: '' }, { name: 'Rope', quantity: 2, note: 'hemp' }],
    copper: 0, weakness: 'Arrogant. Cannot resist a challenge.', memento: '', appearance: '',
  };
}

describe('character card', () => {
  it('puts the nickname beside the name in the card, text and Markdown', () => {
    const card = buildCharacterCard({ ...aodhan(), name: 'Veroulun', nickname: 'Waverider' }, ref, false);
    const text = characterCardToText(card);
    const md = characterCardToMarkdown(card);

    expect(card.name).toBe('Veroulun Waverider');
    expect(text.startsWith('Veroulun Waverider\n')).toBe(true);
    expect(text).not.toContain('“');
    expect(md.startsWith('# Veroulun Waverider\n')).toBe(true);
    expect(md).not.toContain('*“');
  });

  it('uses the bare name without a nickname', () => {
    expect(buildCharacterCard({ ...aodhan(), name: 'Veroulun', nickname: '' }, ref, false).name).toBe('Veroulun');
  });

  it('calls a nameless character Unnamed hero in the text and Markdown', () => {
    const card = buildCharacterCard({ ...aodhan(), name: '', nickname: '' }, ref, false);

    expect(characterCardToText(card).startsWith('Unnamed hero\n')).toBe(true);
    expect(characterCardToMarkdown(card).startsWith('# Unnamed hero\n')).toBe(true);
  });

  it('text carries identity, attributes and ratings', () => {
    const text = characterCardToText(buildCharacterCard(aodhan(), ref, false));

    expect(text).toContain('Archmaster Aodhan');
    expect(text).toContain('Human, Mage (Elementalism), Old');
    expect(text).toContain('STR 8 CON 11 AGL 9 INT 16 WIL 18 CHA 14');
    expect(text).toContain('HP 13 · WP 18 · Movement 8');
  });

  it('shows trained and changed skills only, then weapons, armour and gear', () => {
    const rows = Object.fromEntries(buildCharacterCard(aodhan(), ref, false).rows.map(r => [r.label, r.text]));

    expect(rows['Skills']).toBe('Elementalism 6, Evade 9');
    expect(rows['Weapons']).toBe('Staff (damage D8, skill level 5)');
    expect(rows['Armour']).toBe('Leather armour (1)');
    expect(rows['Gear']).toBe('2 × Rope (hemp)');
    expect(rows['Weakness']).toBe('Arrogant. Cannot resist a challenge.');
  });

  it('hides empty rows', () => {
    const labels = buildCharacterCard({ ...aodhan(), gear: [], weakness: '', skills: [] }, ref, false).rows.map(r => r.label);

    expect(labels).not.toEqual(expect.arrayContaining(['Weapons', 'Armour', 'Gear', 'Weakness', 'Skills', 'Money', 'Memento', 'Appearance']));
  });

  it('Markdown has a ## per non-empty row', () => {
    const card = buildCharacterCard(aodhan(), ref, false);
    const headings = characterCardToMarkdown(card).split('\n').filter(l => l.startsWith('## '));

    expect(headings).toEqual(card.rows.map(r => `## ${r.label}`));
  });

  it('with descriptions Fireball shows its rank and range; Robust never has one', () => {
    const text = characterCardToText(buildCharacterCard(aodhan(), ref, true));

    expect(text).toMatch(/- Fireball \(rank 1; Action; 20 metres; Instant\): Hurts\./);
    expect(text).toContain('Robust ×1');
    expect(text).not.toContain('Robust effect');
    expect(text).toContain('Adaptive (3 WP)');
  });
});

describe('character card money', () => {
  const rich = { ...aodhan(), copper: 235 };
  const money = (rates?: Parameters<typeof buildCharacterCard>[3]) => buildCharacterCard(rich, ref, false, rates).rows.find(r => r.label === 'Money')?.text;

  it('shows coins when the rates are known and plain copper otherwise', () => {
    expect(money({ gold: 100, silver: 10, copper: 1 })).toBe('2 gold 3 silver 5 copper');
    expect(money()).toBe('235 copper');
  });
});
