import { fromTypical } from './npc';
import { checkNpc, parseNpcFile } from './npc-file';
import { BANDIT_CHIEF, NPC_REFERENCE as ref } from './npc.fixture';

const good = () => ({ ...fromTypical(BANDIT_CHIEF, ref), id: 'a', name: 'Grok' });
const file = (...npcs: unknown[]) => JSON.stringify(npcs);
/** A file of one good NPC with `changes` applied. */
const withChanges = (changes: Record<string, unknown>) => file({ ...good(), ...changes });

describe('parseNpcFile', () => {
  it('reads an exported list unchanged', () => {
    const npcs = [good(), { ...good(), id: 'b', name: 'Pell', damageBonuses: [{ attribute: 'STR', dice: 'D4' }, { attribute: 'AGL', dice: 'D6' }] }];

    expect(parseNpcFile(JSON.stringify(npcs))).toEqual(npcs);
  });

  it('fills fields an older export lacks, and reads its single damage bonus', () => {
    expect(parseNpcFile(file({ id: 'x', name: 'Old', damageBonus: { attribute: 'AGL', dice: 'D4' } }))).toEqual([{
      id: 'x', name: 'Old', description: '', basedOn: '', movement: 10, hp: 0, wp: null,
      damageBonuses: [{ attribute: 'AGL', dice: 'D4' }], skills: [], abilities: [], gear: [], spells: [],
    }]);
  });

  it.each([
    ['not JSON', '{bad', 'That file is not valid JSON.'],
    ['not a list', '{"id":"a","name":"Grok"}', 'That file does not hold a list of NPCs.'],
    ['an empty list', '[]', 'That file holds no NPCs.'],
    ['an entry that is not an object', file(null), 'NPC 1 is not an NPC.'],
    ['no id', file({ name: 'Grok' }), 'NPC 1 ("Grok") has no id.'],
    ['an empty id', file({ id: ' ', name: 'Grok' }), 'NPC 1 ("Grok") has no id.'],
    ['no name', file({ id: 'a' }), 'NPC 1 has no name.'],
    ['a text field that is not text', withChanges({ description: 7 }), 'NPC 1 ("Grok"): description must be text.'],
    ['HP that is not a number', withChanges({ hp: 'ten' }), 'NPC 1 ("Grok"): HP must be a whole number of 0 or more.'],
    ['negative movement', withChanges({ movement: -1 }), 'NPC 1 ("Grok"): movement must be a whole number of 0 or more.'],
    ['fractional WP', withChanges({ wp: 2.5 }), 'NPC 1 ("Grok"): WP must be a whole number of 0 or more, or null.'],
    ['a list that is not a list', withChanges({ skills: 'Awareness 12' }), 'NPC 1 ("Grok"): skills must be a list.'],
    ['a bad skill', withChanges({ skills: [{ name: 'Awareness', level: 12 }, null] }), 'NPC 1 ("Grok"): skill 2 needs a name and a level of 0 or more.'],
    ['a bad ability count', withChanges({ abilities: [{ name: 'Robust', count: '6' }] }), 'NPC 1 ("Grok"): heroic ability 1 needs a name and a count of 1 or more.'],
    ['gear that is not a name', withChanges({ gear: ['Dagger', 5] }), 'NPC 1 ("Grok"): gear item 2 must be a name.'],
    ['a bad spell kind', withChanges({ spells: [{ name: 'DISPEL', school: 'General Magic', kind: 'Cantrip' }] }), 'NPC 1 ("Grok"): spell 1 needs a name, a school and a kind (Spell, Trick or Recipe).'],
    ['a bad damage bonus', withChanges({ damageBonuses: [{ attribute: 'CON', dice: 'D4' }] }), 'NPC 1 ("Grok"): damage bonus 1 must be STR or AGL with D4 or D6.'],
    ['two bonuses for one attribute', withChanges({ damageBonuses: [{ attribute: 'STR', dice: 'D4' }, { attribute: 'STR', dice: 'D6' }] }), 'NPC 1 ("Grok"): damage bonus 2 repeats STR.'],
    ['a repeated id', file(good(), { ...good(), name: 'Pell' }), 'NPC 2 ("Pell") has the same id as NPC 1.'],
  ])('refuses %s: "%s"', (_, text, message) => {
    expect(() => parseNpcFile(text)).toThrow(message);
  });

  it('stops at the first error', () => {
    expect(() => parseNpcFile(file(good(), { ...good(), id: 'b', hp: -1 }, { ...good(), id: 'c', name: 7 }))).toThrow(
      'NPC 2 ("Grok"): HP must be a whole number of 0 or more.',
    );
  });
});

describe('checkNpc', () => {
  it('numbers its errors from the position it is given', () => {
    expect(() => checkNpc({ name: 'X' }, 4)).toThrow('NPC 4 ("X") has no id.');
  });
});
