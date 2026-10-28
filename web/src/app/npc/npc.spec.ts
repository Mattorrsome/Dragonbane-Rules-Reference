import { addGear, addSpell, fromTypical, Npc, removeGear, removeSpell, setAbilityCount, setDamageBonus, stackingLast } from './npc';
import { ARCHMAGE, BANDIT_CHIEF, GUARD, NPC_REFERENCE as ref, VILLAGER } from './npc.fixture';

const skills = (npc: Npc) => npc.skills.map(s => `${s.name} ${s.level}`);
const abilities = (npc: Npc) => npc.abilities.map(a => `${a.name} ${a.count}`);

describe('fromTypical', () => {
  it('copies the Bandit chief', () => {
    const npc = fromTypical(BANDIT_CHIEF, ref);

    expect(npc).toEqual({
      name: 'Bandit chief', description: '', basedOn: 'Bandit chief', movement: 10, hp: 30, wp: 16,
      damageBonuses: [{ attribute: 'STR', dice: 'D6' }],
      skills: [{ name: 'Awareness', level: 12 }, { name: 'Brawling', level: 15 }, { name: 'Hammers', level: 15 }],
      abilities: [{ name: 'Berserker', count: 1 }, { name: 'Robust', count: 6 }, { name: 'Veteran', count: 1 }],
      gear: ['Heavy warhammer', 'Chainmail', 'Open helmet'],
      spells: [],
    });
  });

  it('has no damage bonus when the source has none', () => {
    expect(fromTypical(VILLAGER, ref).damageBonuses).toEqual([]);
  });

  it('adds missing weapon skills at 5', () => {
    expect(skills(fromTypical(VILLAGER, ref))).toEqual(['Brawling 8', 'Hammers 5']);
  });

  it('keeps an unlinked skill such as Magic school', () => {
    expect(skills(fromTypical(ARCHMAGE, ref))).toEqual(['Magic school 15', 'Staves 13']);
  });
});

describe('addGear', () => {
  it('adds the weapon skill at 5 once', () => {
    let guard = addGear(fromTypical(GUARD, ref), 'Short bow', ref);
    expect(skills(guard)).toEqual(['Awareness 10', 'Swords 12', 'Bows 5']);

    guard = addGear(guard, 'Longbow', ref);
    expect(skills(guard)).toEqual(['Awareness 10', 'Swords 12', 'Bows 5']);
    expect(guard.gear).toEqual(['Broadsword', 'Studded leather', 'Short bow', 'Longbow']);
  });

  it('adds nothing when the NPC has the skill, or for non-weapons', () => {
    const guard = fromTypical(GUARD, ref);

    expect(skills(addGear(guard, 'Short sword', ref))).toEqual(['Awareness 10', 'Swords 12']);
    expect(skills(addGear(guard, 'Chainmail', ref))).toEqual(['Awareness 10', 'Swords 12']);
  });

  it('matches names case-insensitively, keeping the reference spelling', () => {
    expect(addGear(fromTypical(GUARD, ref), 'short bow', ref).gear).toContain('Short bow');
  });

  it('keeps an unknown name as plain gear', () => {
    const guard = addGear(fromTypical(GUARD, ref), 'Mystery orb', ref);

    expect(guard.gear).toContain('Mystery orb');
    expect(skills(guard)).toEqual(['Awareness 10', 'Swords 12']);
  });

  it('does not change the NPC it was given', () => {
    const guard = fromTypical(GUARD, ref);
    addGear(guard, 'Short bow', ref);

    expect(guard.gear).toEqual(['Broadsword', 'Studded leather']);
  });
});

describe('removeGear', () => {
  it('removes the item and keeps the skill', () => {
    const chief = removeGear(fromTypical(BANDIT_CHIEF, ref), 'Heavy warhammer');

    expect(chief.gear).toEqual(['Chainmail', 'Open helmet']);
    expect(skills(chief)).toContain('Hammers 15');
  });
});

describe('setAbilityCount', () => {
  it('Robust changes HP by 2 per step', () => {
    const chief = fromTypical(BANDIT_CHIEF, ref);

    expect(setAbilityCount(chief, 'Robust', 4).hp).toBe(26);
    const none = setAbilityCount(chief, 'Robust', 0);
    expect(none.hp).toBe(18);
    expect(abilities(none)).toEqual(['Berserker 1', 'Veteran 1']);

    const guard = setAbilityCount(fromTypical(GUARD, ref), 'Robust', 1);
    expect(abilities(guard)).toEqual(['Robust 1']);
    expect(guard.hp).toBe(14);
  });

  it('Focused changes WP by 2 per step, starting from none', () => {
    expect(setAbilityCount(fromTypical(ARCHMAGE, ref), 'Focused', 7).wp).toBe(32);
    expect(setAbilityCount(fromTypical(GUARD, ref), 'Focused', 1).wp).toBe(2);
  });

  it('HP and WP never go below 0', () => {
    const chief = { ...fromTypical(BANDIT_CHIEF, ref), hp: 5 };

    expect(setAbilityCount(chief, 'Robust', 0).hp).toBe(0);
  });

  it('non-stacking abilities stay at count 1', () => {
    const chief = fromTypical(BANDIT_CHIEF, ref);

    expect(abilities(setAbilityCount(chief, 'Berserker', 3))).toEqual(['Berserker 1', 'Robust 6', 'Veteran 1']);
    expect(abilities(setAbilityCount(chief, 'Berserker', 0))).toEqual(['Robust 6', 'Veteran 1']);
    expect(setAbilityCount(chief, 'Berserker', 0).hp).toBe(30);
  });

  it('negative counts count as 0', () => {
    expect(setAbilityCount(fromTypical(BANDIT_CHIEF, ref), 'Robust', -2).hp).toBe(18);
  });
});

describe('spells', () => {
  // The real pair: a Symbolism trick and a rank-6 Dracomancy spell share the name.
  const trick = { name: 'Erase', school: 'Symbolism', kind: 'Trick' as const };
  const spell = { name: 'ERASE', school: 'Dracomancy', kind: 'Spell' as const };

  it('are matched by name, school and kind', () => {
    let npc = addSpell(addSpell(fromTypical(GUARD, ref), trick), spell);
    expect(npc.spells).toEqual([trick, spell]);

    npc = addSpell(npc, { ...trick });
    expect(npc.spells).toHaveLength(2);

    expect(removeSpell(npc, trick).spells).toEqual([spell]);
  });
});

describe('setDamageBonus', () => {
  it('an NPC can have both a STR and an AGL bonus, always listed STR first', () => {
    const agl = setDamageBonus(fromTypical(VILLAGER, ref), 'AGL', 'D4');

    expect(setDamageBonus(agl, 'STR', 'D6').damageBonuses).toEqual([{ attribute: 'STR', dice: 'D6' }, { attribute: 'AGL', dice: 'D4' }]);
  });

  it("changes one attribute's dice, and null removes it", () => {
    const chief = fromTypical(BANDIT_CHIEF, ref);

    expect(setDamageBonus(chief, 'STR', 'D4').damageBonuses).toEqual([{ attribute: 'STR', dice: 'D4' }]);
    expect(setDamageBonus(chief, 'STR', null).damageBonuses).toEqual([]);
  });
});

describe('stackingLast', () => {
  it('keeps other abilities in order, then Robust, then Focused', () => {
    const names = stackingLast([{ name: 'Focused' }, { name: 'Defensive' }, { name: 'Robust' }, { name: 'Double Slash' }]).map(a => a.name);

    expect(names).toEqual(['Defensive', 'Double Slash', 'Robust', 'Focused']);
  });
});
