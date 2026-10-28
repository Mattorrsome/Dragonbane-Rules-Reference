import { sentenceCase } from '../shared/text';
import { findItem, isStacking, Npc, NpcReference, stackingLast } from './npc';

/** One entry in a list row; `detail` is the smaller description line, shown only when descriptions are on. */
export interface CardEntry {
  text: string;
  detail: string | null;
}

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
}

const MISSING_LEVEL = '–';

export function buildCard(npc: Npc, ref: NpcReference, withDescriptions: boolean): NpcCard {
  const items = npc.gear.map(name => ({ name, item: findItem(ref, name) }));
  const weapons = items.filter(i => i.item?.weapon);
  const armour = items.filter(i => i.item?.armour);
  const level = (skill: string) => npc.skills.find(s => s.name.toLowerCase() === skill.toLowerCase())?.level;
  // A skill shown in a weapon line is not repeated in Skills (as in the book's boxes).
  const weaponSkills = new Set(weapons.map(w => w.item!.weapon!.skill.toLowerCase()));

  return {
    name: npc.name,
    description: npc.description.trim(),
    movement: npc.movement,
    damageBonus: npc.damageBonuses.map(b => `${b.attribute}: +${b.dice}`).join(', ') || null,
    armour: armour.length
      ? `${bookList(armour.map(a => a.name))} (${armour.reduce((sum, a) => sum + a.item!.armour!.rating, 0)})`
      : null,
    hp: npc.hp,
    wp: npc.wp,
    skills: npc.skills.filter(s => !weaponSkills.has(s.name.toLowerCase())).map(s => `${s.name} ${s.level}`).join(', '),
    abilities: abilityEntries(npc, ref, withDescriptions),
    weapons: bookList(
      weapons.map(w => `${w.name} (skill level ${level(w.item!.weapon!.skill) ?? MISSING_LEVEL}, damage ${w.item!.weapon!.damage})`),
    ),
    spells: npc.spells.map(chosen => {
      const spell = ref.spells.find(s => s.name === chosen.name && s.school === chosen.school && s.kind === chosen.kind);
      const name = sentenceCase(chosen.name);
      if (!withDescriptions || !spell) return { text: name, detail: null };
      const details = spell.ranked
        ? `rank ${spell.rank}; ${spell.castingTime}; ${spell.ranked.range}; ${spell.ranked.duration}`
        : 'trick';
      return { text: `${name} (${details})`, detail: spell.description };
    }),
    gear: bookList(items.filter(i => !i.item?.weapon && !i.item?.armour).map(i => i.name)),
  };
}

/** Non-stacking abilities in NPC order, then Robust, then Focused; stacking ones show "×N" and never a description. */
function abilityEntries(npc: Npc, ref: NpcReference, withDescriptions: boolean): CardEntry[] {
  return stackingLast(npc.abilities).map(a => {
    if (isStacking(a.name)) return { text: `${a.name} ×${a.count}`, detail: null };
    const ability = ref.abilities.find(h => h.name.toLowerCase() === a.name.toLowerCase());
    return withDescriptions && ability
      ? { text: `${a.name} (${ability.wp} WP)`, detail: ability.effect }
      : { text: a.name, detail: null };
  });
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
