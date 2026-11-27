import { CurrencyRates } from '../core/currency-rates';
import { ATTRIBUTES, findItem, formatDamageBonus, same } from '../hero/hero';
import { abilityEntries, CardEntry, entryLines, hasDetail, spellEntries } from '../hero/hero-card';
import { Character, CreationReference, derived, skillLevel } from './character';
import { gearLabel, moneyText } from './display';

/** One labelled row: plain `text`, or list `entries` (one per line once any has a description). Empty rows are not built. */
export interface CardRow {
  label: string;
  text: string;
  entries?: CardEntry[];
}

/** The export card: the image, the text and the Markdown all come from this. */
export interface CharacterCard {
  /** The name, with the nickname after it when there is one. */
  name: string;
  /** "Human, Mage (Elementalism), Old" */
  identity: string;
  rows: CardRow[];
}

/** The kin abilities, as `abilityEntries` gives heroic ones ("Adaptive (3 WP)" and the effect with descriptions). */
export function kinEntries(c: Character, ref: CreationReference, withDescriptions: boolean): CardEntry[] {
  const kin = ref.kin.find(k => same(k.name, c.kin));
  return c.kinAbilities.map((name): CardEntry => {
    const ability = kin?.abilities.find(a => same(a.name, name));
    return withDescriptions && ability
      ? { text: ability.wp === null ? name : `${name} (${ability.wp} WP)`, detail: ability.effect }
      : { text: name, detail: null };
  });
}

export function buildCharacterCard(c: Character, ref: CreationReference, withDescriptions: boolean, rates?: CurrencyRates | null): CharacterCard {
  const d = derived(c, ref);
  const list = (label: string, entries: CardEntry[]): CardRow => ({ label, text: entries.map(e => e.text).join(', '), entries });
  const text = (label: string, value: string): CardRow => ({ label, text: value });

  const baseLevel = (name: string) => {
    const skill = ref.skills.find(s => same(s.name, name));
    return skill ? skillLevel({ ...c, skills: [] }, skill) : null;
  };
  const skills = c.skills.filter(s => s.trained || s.level !== baseLevel(s.name)).map(s => `${s.name} ${s.level}`);

  const weapons: string[] = [];
  const armour: string[] = [];
  const gear: string[] = [];
  for (const g of c.gear) {
    const item = findItem(ref, g.name);
    const label = gearLabel({ ...g, note: '' });
    const note = g.note ? ` (${g.note})` : '';
    if (item?.weapon) {
      const skill = ref.skills.find(s => same(s.name, item.weapon!.skill));
      weapons.push(`${label} (damage ${item.weapon.damage}${skill ? `, skill level ${skillLevel(c, skill)}` : ''})${note}`);
    } else if (item?.armour) armour.push(`${label} (${item.armour.rating})${note}`);
    else gear.push(label + note);
  }

  const bonus = d.damageBonuses.map(formatDamageBonus).join(', ');

  const rows: CardRow[] = [
    text('Attributes', ATTRIBUTES.map(a => `${a} ${c.attributes[a]}`).join(' ')),
    text('Ratings', [`HP ${d.hpMax}`, `WP ${d.wpMax}`, `Movement ${d.movement}`, ...(bonus ? [`Damage Bonus ${bonus}`] : []), `Carrying capacity ${d.capacity}`].join(' · ')),
    text('Skills', skills.join(', ')),
    list('Abilities', [...kinEntries(c, ref, withDescriptions), ...abilityEntries(c.abilities, ref, withDescriptions)]),
    list('Spells', spellEntries(c.spells, ref, withDescriptions)),
    text('Weapons', weapons.join(', ')),
    text('Armour', armour.join(', ')),
    text('Gear', gear.join(', ')),
    text('Money', c.copper > 0 ? moneyText(c.copper, rates) : ''),
    text('Weakness', c.weakness),
    text('Memento', c.memento),
    text('Appearance', c.appearance),
  ].filter(r => r.text);

  const school = c.school ? ` (${c.school})` : '';
  return { name: [c.name || 'Unnamed hero', c.nickname].filter(Boolean).join(' '), identity: [c.kin, `${c.profession}${school}`, c.age].filter(Boolean).join(', '), rows };
}

export function characterCardToText(card: CharacterCard): string {
  const out = [card.name, card.identity, ''];
  for (const row of card.rows) {
    if (hasDetail(row.entries)) out.push(`${row.label}:`, ...entryLines(row.entries!, false));
    else out.push(`${row.label}: ${row.text}`);
  }
  return out.join('\n');
}

export function characterCardToMarkdown(card: CharacterCard): string {
  const out = [`# ${card.name}`, '', card.identity, ''];
  for (const row of card.rows) {
    out.push(`## ${row.label}`, '');
    if (hasDetail(row.entries)) out.push(...entryLines(row.entries!, true));
    else out.push(row.text);
    out.push('');
  }
  return out.join('\n').replace(/\n+$/, '');
}
