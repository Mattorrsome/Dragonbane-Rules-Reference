import { sentenceCase } from '../shared/text';
import { Ability, HeroReference, isStacking, SpellRef, stackingLast } from './hero';

/** One entry in a list row; `detail` is the smaller description line, shown only when descriptions are on. */
export interface CardEntry {
  text: string;
  detail: string | null;
}

/** Non-stacking abilities in their own order, then Robust, then Focused; stacking ones show "×N" and never a description. */
export function abilityEntries(abilities: readonly Ability[], ref: HeroReference, withDescriptions: boolean): CardEntry[] {
  return stackingLast(abilities).map(a => {
    if (isStacking(a.name)) return { text: `${a.name} ×${a.count}`, detail: null };
    const ability = ref.abilities.find(h => h.name.toLowerCase() === a.name.toLowerCase());
    return withDescriptions && ability
      ? { text: `${a.name} (${ability.wp} WP)`, detail: ability.effect }
      : { text: a.name, detail: null };
  });
}

export function spellEntries(spells: readonly SpellRef[], ref: HeroReference, withDescriptions: boolean): CardEntry[] {
  return spells.map(chosen => {
    const spell = ref.spells.find(s => s.name === chosen.name && s.school === chosen.school && s.kind === chosen.kind);
    const name = sentenceCase(chosen.name);
    if (!withDescriptions || !spell) return { text: name, detail: null };
    const details = spell.ranked
      ? `rank ${spell.rank}; ${spell.castingTime}; ${spell.ranked.range}; ${spell.ranked.duration}`
      : 'trick';
    return { text: `${name} (${details})`, detail: spell.description };
  });
}

/** "Dispel (General Magic)", "Erase (Symbolism, trick)": unique, so a picked label finds its spell. */
export function spellLabel(spell: SpellRef): string {
  const kind = spell.kind === 'Spell' ? '' : `, ${spell.kind.toLowerCase()}`;
  return `${sentenceCase(spell.name)} (${spell.school}${kind})`;
}
