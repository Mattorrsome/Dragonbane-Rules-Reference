import { Attribute, ATTRIBUTES, findItem, formatDamageBonus } from '../hero/hero';
import { abilityEntries, CardEntry, spellEntries } from '../hero/hero-card';
import { Npc, NpcReference, npcAttributes } from './npc';

/**
 * The export card's rows in book order (see NPC_Image_Example.png). Empty strings, empty lists and null mean the
 * row is hidden. The same card feeds the image, the text and the Markdown.
 */
export interface NpcCard {
  name: string;
  description: string;
  movement: number;
  damageBonus: string | null;
  armour: string | null;
  hp: number;
  wp: number | null;
  skills: string;
  abilities: CardEntry[];
  weapons: string;
  spells: CardEntry[];
  gear: string;
  /** The six attribute scores in book order, or null when they are not shown. */
  attributes: { label: Attribute; value: number }[] | null;
}

const MISSING_LEVEL = '–';

export function buildCard(npc: Npc, ref: NpcReference, withDescriptions: boolean, withAttributes = false): NpcCard {
  const scores = npcAttributes(npc);
  const items = npc.gear.map(name => ({ name, item: findItem(ref, name) }));
  const weapons = items.filter(i => i.item?.weapon);
  const armour = items.filter(i => i.item?.armour);
  const level = (skill: string) => npc.skills.find(s => s.name.toLowerCase() === skill.toLowerCase())?.level;

  return {
    name: npc.name,
    description: npc.description.trim(),
    movement: npc.movement,
    damageBonus: npc.damageBonuses.map(formatDamageBonus).join(', ') || null,
    armour: armour.length
      ? `${bookList(armour.map(a => a.name))} (${armour.reduce((sum, a) => sum + a.item!.armour!.rating, 0)})`
      : null,
    hp: npc.hp,
    wp: npc.wp,
    // Every skill, weapon skills too, although the weapon line repeats their level (the book's boxes leave them out).
    skills: npc.skills.map(s => `${s.name} ${s.level}`).join(', '),
    abilities: abilityEntries(npc.abilities, ref, withDescriptions),
    weapons: bookList(
      weapons.map(w => `${w.name} (skill level ${level(w.item!.weapon!.skill) ?? MISSING_LEVEL}, damage ${w.item!.weapon!.damage})`),
    ),
    spells: spellEntries(npc.spells, ref, withDescriptions),
    gear: bookList(items.filter(i => !i.item?.weapon && !i.item?.armour).map(i => i.name)),
    attributes: withAttributes ? ATTRIBUTES.map(label => ({ label, value: scores[label] })) : null,
  };
}

/** "Chainmail, open helmet": the first item keeps its case, the rest start lower case, as in the book. */
function bookList(names: string[]): string {
  return names.map((n, i) => (i === 0 ? n : n.charAt(0).toLowerCase() + n.slice(1))).join(', ');
}

interface Row {
  label: string;
  text?: string;
  entries?: CardEntry[];
}

/** The rows below the description, each line already split into its labelled parts; hidden parts are left out. */
function rows(card: NpcCard): Row[][] {
  const line = (...parts: (Row | false)[]) => parts.filter((p): p is Row => !!p);
  return [
    line(...(card.attributes ?? []).map(a => ({ label: a.label, text: `${a.value}` }))),
    line({ label: 'Movement', text: `${card.movement}` }, !!card.damageBonus && { label: 'Damage Bonus', text: card.damageBonus! }),
    line(!!card.armour && { label: 'Armor', text: card.armour! }, { label: 'HP', text: `${card.hp}` }, card.wp !== null && { label: 'WP', text: `${card.wp}` }),
    line(!!card.skills && { label: 'Skills', text: card.skills }),
    line(card.abilities.length > 0 && { label: 'Heroic Abilities', entries: card.abilities }),
    line(!!card.weapons && { label: 'Weapons', text: card.weapons }),
    line(card.spells.length > 0 && { label: 'Spells', entries: card.spells }),
    line(!!card.gear && { label: 'Gear', text: card.gear }),
  ].filter(l => l.length > 0);
}

/** A list row is written as one line until any entry has a description; then one entry per line. */
const listed = (row: Row) => !!row.entries?.some(e => e.detail);
const inline = (row: Row) => row.text ?? row.entries!.map(e => e.text).join(', ');

export function cardToText(card: NpcCard): string {
  const out = [card.name, ...(card.description ? [card.description] : []), ''];
  for (const line of rows(card)) {
    if (line.length === 1 && listed(line[0])) {
      out.push(`${line[0].label}:`, ...line[0].entries!.map(e => (e.detail ? `- ${e.text}: ${e.detail}` : `- ${e.text}`)));
    } else {
      out.push(line.map(r => `${r.label}: ${inline(r)}`).join(' · '));
    }
  }
  return out.join('\n');
}

export function cardToMarkdown(card: NpcCard): string {
  const out = [`## ${card.name}`, '', ...(card.description ? [card.description, ''] : [])];
  for (const line of rows(card)) {
    if (line.length === 1 && listed(line[0])) {
      // Lists need a blank line around them to render as lists.
      out.push(`**${line[0].label}:**`, '', ...line[0].entries!.map(e => (e.detail ? `- **${e.text}**: ${e.detail}` : `- **${e.text}**`)), '');
    } else {
      // Two trailing spaces: a line break inside the stat block.
      out.push(line.map(r => `**${r.label}:** ${inline(r)}`).join(' · ') + '  ');
    }
  }
  return out.join('\n').replace(/\n+$/, '');
}
