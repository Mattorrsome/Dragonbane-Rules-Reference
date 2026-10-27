import { addGear, addSpell, fromTypical, Npc, setAbilityCount } from './npc';
import { buildCard, cardToMarkdown, cardToText } from './npc-card';
import { BANDIT, BANDIT_CHIEF, NPC_REFERENCE as ref } from './npc.fixture';

/** The Bandit chief tweaked into Grok with the DISPEL spell. */
function grok(): Npc {
  return addSpell(
    { ...fromTypical(BANDIT_CHIEF, ref), name: 'Grok', description: 'Scarred chief of the Red Ford bandits.' },
    { name: 'DISPEL', school: 'General Magic', kind: 'Spell' },
  );
}
const berserkerEffect = ref.abilities.find(a => a.name === 'Berserker')!.effect;
const dispelDescription = ref.spells.find(s => s.name === 'DISPEL')!.description;

describe('buildCard', () => {
  it('without descriptions', () => {
    expect(buildCard(grok(), ref, false)).toEqual({
      name: 'Grok',
      description: 'Scarred chief of the Red Ford bandits.',
      movement: 10,
      damageBonus: 'STR: +D6',
      armour: 'Chainmail, open helmet (5)',
      hp: 30,
      wp: 16,
      skills: 'Awareness 12, Brawling 15',
      abilities: [
        { text: 'Berserker', detail: null },
        { text: 'Veteran', detail: null },
        { text: 'Robust ×6', detail: null },
      ],
      weapons: 'Heavy warhammer (skill level 15, damage 2D10)',
      spells: [{ text: 'Dispel', detail: null }],
      gear: '',
    });
  });

  it('with descriptions: WP cost and effect, rank and casting details; never for Robust or Focused', () => {
    const card = buildCard(setAbilityCount(grok(), 'Focused', 2), ref, true);

    expect(card.abilities.map(a => a.text)).toEqual(['Berserker (3 WP)', 'Veteran (1 WP)', 'Robust ×6', 'Focused ×2']);
    expect(card.abilities[0].detail).toBe(berserkerEffect);
    expect(card.abilities[2].detail).toBeNull();
    expect(card.abilities[3].detail).toBeNull();
    expect(card.spells).toEqual([{ text: 'Dispel (rank 1; Action, or stretch for a ritual; 10 metres; Instant)', detail: dispelDescription }]);
  });

  it('tricks read "(trick)"', () => {
    const npc = addSpell(grok(), { name: 'Erase', school: 'Symbolism', kind: 'Trick' });

    expect(buildCard(npc, ref, true).spells[1].text).toBe('Erase (trick)');
  });

  it('two weapons, one whose skill was removed', () => {
    const bandit = { ...fromTypical(BANDIT, ref), skills: [{ name: 'Evade', level: 10 }, { name: 'Swords', level: 12 }] };

    const card = buildCard(bandit, ref, false);
    expect(card.weapons).toBe('Short sword (skill level 12, damage D10), short bow (skill level –, damage D10)');
    expect(card.skills).toBe('Evade 10');
    expect(card.armour).toBeNull();
    expect(card.damageBonus).toBeNull();
  });

  it('gear row holds what is neither weapon nor armour, and unresolved names stay as text', () => {
    const card = buildCard(addGear(addGear(grok(), 'Grimoire', ref), 'Mystery orb', ref), ref, false);

    expect(card.gear).toBe('Grimoire, mystery orb');
  });

  it('a skill or ability no longer in the Reference is still listed', () => {
    const npc = { ...grok(), skills: [...grok().skills, { name: 'Juggling', level: 9 }], abilities: [{ name: 'Lost Art', count: 1 }] };

    const card = buildCard(npc, ref, true);
    expect(card.skills).toBe('Awareness 12, Brawling 15, Juggling 9');
    expect(card.abilities).toEqual([{ text: 'Lost Art', detail: null }]);
  });
});

describe('cardToText', () => {
  it('Grok without descriptions', () => {
    expect(cardToText(buildCard(grok(), ref, false))).toBe(
      [
        'Grok',
        'Scarred chief of the Red Ford bandits.',
        '',
        'Movement: 10 · Damage Bonus: STR: +D6',
        'Armor: Chainmail, open helmet (5) · HP: 30 · WP: 16',
        'Skills: Awareness 12, Brawling 15',
        'Heroic Abilities: Berserker, Veteran, Robust ×6',
        'Weapons: Heavy warhammer (skill level 15, damage 2D10)',
        'Spells: Dispel',
      ].join('\n'),
    );
  });

  it('with descriptions, list rows put each entry on its own line', () => {
    const text = cardToText(buildCard(grok(), ref, true));

    expect(text).toContain(['Heroic Abilities:', `- Berserker (3 WP): ${berserkerEffect}`, `- Veteran (1 WP): `].join('\n'));
    expect(text).toContain('- Robust ×6\nWeapons:');
    expect(text).toContain(`Spells:\n- Dispel (rank 1; Action, or stretch for a ritual; 10 metres; Instant): ${dispelDescription}`);
  });

  it('hidden rows produce no line', () => {
    const bandit = buildCard(fromTypical(BANDIT, ref), ref, false);

    expect(cardToText(bandit).split('\n')).toEqual([
      'Bandit',
      '',
      'Movement: 10',
      'HP: 12',
      'Skills: Evade 10',
      'Weapons: Short sword (skill level 12, damage D10), short bow (skill level 12, damage D10)',
    ]);
  });
});

describe('cardToMarkdown', () => {
  it('Grok without descriptions', () => {
    expect(cardToMarkdown(buildCard(grok(), ref, false))).toBe(
      [
        '## Grok',
        '',
        'Scarred chief of the Red Ford bandits.',
        '',
        '**Movement:** 10 · **Damage Bonus:** STR: +D6  ',
        '**Armor:** Chainmail, open helmet (5) · **HP:** 30 · **WP:** 16  ',
        '**Skills:** Awareness 12, Brawling 15  ',
        '**Heroic Abilities:** Berserker, Veteran, Robust ×6  ',
        '**Weapons:** Heavy warhammer (skill level 15, damage 2D10)  ',
        '**Spells:** Dispel  ',
      ].join('\n'),
    );
  });

  it('with descriptions, list rows become Markdown lists', () => {
    const md = cardToMarkdown(buildCard(grok(), ref, true));

    expect(md).toContain(['**Heroic Abilities:**', '', `- **Berserker (3 WP)**: ${berserkerEffect}`].join('\n'));
    expect(md).toContain('- **Robust ×6**\n\n**Weapons:**');
  });
});
