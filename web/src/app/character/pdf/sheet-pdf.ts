import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb } from 'pdf-lib';
import { CurrencyRates } from '../../core/currency-rates';
import { ATTRIBUTES, DAMAGE_BONUS_ATTRIBUTES, findItem, same } from '../../hero/hero';
import { abilityEntries, CardEntry, spellEntries } from '../../hero/hero-card';
import { COINS, splitCoins } from '../../money/coins';
import { Character, CreationReference, derived, skillLevel } from '../character';
import { kinEntries } from '../character-card';
import { gearLabel } from '../display';
import { placeGear } from './gear-placement';
import { SheetAssets } from './sheet-assets';
import { SHEET_FIELDS, SheetBox, SheetField } from './sheet-fields';

/** Caveat's contextual alternates (calt) come out as blank glyphs, so they are off. */
export const HAND_FONT_OPTIONS = { subset: true, features: { calt: false } };

/** What the character sheet says, field by field (missing or empty: left blank). Abilities and spells are names only. */
export function sheetValues(c: Character, ref: CreationReference, rates?: CurrencyRates | null): Partial<Record<SheetField, string>> {
  const d = derived(c, ref);
  const placed = placeGear(c, ref);
  const v: Partial<Record<SheetField, string>> = {
    name: c.name, kin: c.kin, age: c.age, profession: c.school ? `${c.profession} – ${c.school}` : c.profession,
    weakness: c.weakness, appearance: c.appearance, memento: c.memento, tiny: placed.tiny.join(', '),
    movement: String(d.movement), encumbrance: String(d.capacity), wpMax: String(d.wpMax), hpMax: String(d.hpMax),
  };
  for (const a of ATTRIBUTES) v[`attribute:${a}`] = String(c.attributes[a]);
  for (const a of DAMAGE_BONUS_ATTRIBUTES) v[`damageBonus:${a}`] = d.damageBonuses.find(b => b.attribute === a)?.dice ?? '–';

  const names = [...kinEntries(c, ref, false), ...abilityEntries(c.abilities, ref, false), ...spellEntries(c.spells, ref, false)];
  // The sheet has 15 lines; page 2 describes every one.
  names.slice(0, 15).forEach((e, i) => (v[`abilities:${i + 1}` as SheetField] = e.text));

  for (const skill of ref.skills) {
    const field = `skill:${skill.name}` as SheetField;
    if (field in SHEET_FIELDS) v[field] = String(skillLevel(c, skill));
  }
  const secondary = c.skills
    .map(s => ({ s, skill: ref.skills.find(r => same(r.name, s.name)) }))
    .filter(x => x.skill?.type === 'Secondary')
    .slice(0, 7);
  secondary.forEach(({ s, skill }, i) => {
    v[`secondary:${i + 1}:level` as SheetField] = String(s.level);
    v[`secondary:${i + 1}:name` as SheetField] = `${skill!.name} (${skill!.attribute.slice(0, 3)})`;
  });

  placed.inventory.forEach((label, i) => (v[`inventory:${i + 1}` as SheetField] = label));
  const coins = rates ? splitCoins(c.copper, rates) : { gold: 0, silver: 0, copper: c.copper };
  for (const coin of COINS) if (coins[coin]) v[`money:${coin}`] = String(coins[coin]);

  for (const slot of ['armour', 'helmet'] as const) {
    const worn = placed[slot];
    if (!worn) continue;
    v[slot] = gearLabel({ ...worn, quantity: 1 });
    v[`${slot}:rating`] = String(findItem(ref, worn.name)!.armour!.rating);
  }
  placed.weapons.forEach((w, i) => {
    const weapon = findItem(ref, w.name)!.weapon!;
    const row = `weapon:${i + 1}` as `weapon:1`;
    Object.assign(v, {
      [`${row}:name`]: gearLabel(w), [`${row}:grip`]: weapon.grip ?? '', [`${row}:range`]: weapon.range,
      [`${row}:damage`]: weapon.damage, [`${row}:durability`]: weapon.durability?.toString() ?? '', [`${row}:features`]: weapon.featuresText,
    });
  });
  return v;
}

/** Greedy word wrap to `width`; a word wider than a line is broken. */
function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= width;
  const lines: string[] = [];
  let line = '';
  for (let word of text.split(' ').filter(Boolean)) {
    while (!fits(word)) {
      let cut = word.length - 1;
      while (cut > 1 && !fits(word.slice(0, cut))) cut--;
      if (line) lines.push(line);
      lines.push(word.slice(0, cut));
      line = '';
      word = word.slice(cut);
    }
    const next = line ? `${line} ${word}` : word;
    if (fits(next)) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const MIN_SCALE = 0.6;

/** The text at the largest size (down to 60% of the box's) that wraps into the box's lines; else cut with "…" at 60%. */
export function fitText(font: PDFFont, text: string, box: SheetBox): { size: number; lines: string[] } {
  const maxLines = box.lines ?? 1;
  const min = box.size * MIN_SCALE;
  // No size above the one that fits the whole text into the lines laid end to end can fit, so start there.
  const most = (box.size * box.width * maxLines) / font.widthOfTextAtSize(text, box.size);
  for (let size = Math.max(min, Math.min(box.size, Math.floor(most * 2) / 2)); ; size = Math.max(min, size - 0.5)) {
    const lines = wrap(font, text, size, box.width);
    if (lines.length <= maxLines) return { size, lines };
    if (size === min) {
      let last = lines[maxLines - 1];
      while (last && font.widthOfTextAtSize(`${last.trimEnd()}…`, size) > box.width) last = last.slice(0, -1);
      return { size, lines: [...lines.slice(0, maxLines - 1), `${last.trimEnd()}…`] };
    }
  }
}

/** Single-spaced text with each character the font cannot draw as "?". */
function drawable(font: PDFFont): (text: string) => string {
  const chars = new Set(font.getCharacterSet());
  return text => Array.from(text.replace(/\s+/g, ' ').trim(), ch => (chars.has(ch.codePointAt(0)!) ? ch : '?')).join('');
}

// --ink and --dragon-red from tokens.css.
const INK = rgb(0x23 / 255, 0x1f / 255, 0x20 / 255);
const RED = rgb(0xe7 / 255, 0x2f / 255, 0x32 / 255);
const MARGIN = 56;

/** The filled-in sheet, then parchment pages describing the abilities, spells and the gear that had no row. */
export async function buildSheetPdf(c: Character, ref: CreationReference, rates: CurrencyRates | null | undefined, assets: SheetAssets): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.load(assets.sheet);
  // pdf-lib saves into a plain ArrayBuffer; the cast lets the bytes go straight into a Blob.
  const save = () => doc.save() as Promise<Uint8Array<ArrayBuffer>>;
  doc.registerFontkit(fontkit);
  doc.setTitle(c.name);
  const hand = await doc.embedFont(assets.font, HAND_FONT_OPTIONS);
  const handText = drawable(hand);
  const sheet = doc.getPage(0);

  for (const [field, value] of Object.entries(sheetValues(c, ref, rates)) as [SheetField, string][]) {
    const text = handText(value);
    if (!text) continue;
    const box = SHEET_FIELDS[field];
    const { size, lines } = fitText(hand, text, box);
    lines.forEach((line, i) => {
      const x = box.align === 'center' ? box.x + (box.width - hand.widthOfTextAtSize(line, size)) / 2 : box.x;
      sheet.drawText(line, { x, y: box.y - i * (box.lineHeight ?? 0), size, font: hand, color: INK });
    });
  }

  const abilities = [...kinEntries(c, ref, true), ...abilityEntries(c.abilities, ref, true)];
  const spells = spellEntries(c.spells, ref, true);
  const overflow = placeGear(c, ref).overflow;
  if (!abilities.length && !spells.length && !overflow.length) return save();

  // Whole, not subset: a subset Colus draws its letters spaced apart.
  const heading = await doc.embedFont(assets.heading);
  const parchment = await doc.embedPng(assets.parchment);
  const flow = new Flow(doc, sheet.getSize(), parchment);
  flow.write(heading, c.name, 26, RED);
  const section = (title: string, entries: CardEntry[]) => {
    if (!entries.length) return;
    flow.gap(10);
    flow.write(heading, title, 17, RED);
    for (const e of entries) {
      flow.gap(5);
      flow.write(hand, e.text, 17, INK);
      if (e.detail) flow.write(hand, e.detail, 14, INK);
    }
  };
  section('Abilities', abilities);
  section('Spells', spells);
  section('Other gear', overflow.map(text => ({ text, detail: null })));
  return save();
}

/** Writes wrapped lines down parchment pages of the sheet's size, starting a new page when one is full. */
class Flow {
  private page!: PDFPage;
  private y = 0;

  constructor(private readonly doc: PDFDocument, private readonly size: { width: number; height: number }, private readonly tile: PDFImage) {
    this.newPage();
  }

  private newPage(): void {
    const { width, height } = this.size;
    this.page = this.doc.addPage([width, height]);
    // The tile scaled to the page width, repeated down it, as the app's scroll does.
    const tileHeight = this.tile.height * (width / this.tile.width);
    for (let top = height; top > 0; top -= tileHeight) this.page.drawImage(this.tile, { x: 0, y: top - tileHeight, width, height: tileHeight });
    this.y = height - MARGIN;
  }

  gap(points: number): void {
    this.y -= points;
  }

  write(font: PDFFont, text: string, size: number, color = INK): void {
    const clean = drawable(font);
    const lines = text.split('\n').flatMap(paragraph => wrap(font, clean(paragraph), size, this.size.width - 2 * MARGIN));
    for (const line of lines) {
      if (this.y - size * 1.2 < MARGIN) this.newPage();
      this.y -= size * 1.2;
      this.page.drawText(line, { x: MARGIN, y: this.y, size, font, color });
    }
  }
}
