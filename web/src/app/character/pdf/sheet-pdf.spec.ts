import fontkit from '@pdf-lib/fontkit';
import { PDFDocument } from 'pdf-lib';
import { EquipmentItemDto } from '../../api/models';
import { Character, CreationReference } from '../character';
import { creationRef } from '../character.fixture';
import { SHEET_FIELDS, SheetField } from './sheet-fields';
import { SheetAssets } from './sheet-assets';
import { buildSheetPdf, fitText, HAND_FONT_OPTIONS, sheetValues } from './sheet-pdf';

// The real assets from public/ (the test runner's working directory is web/).
const fs = (globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): { readFileSync(path: string): Uint8Array } } })
  .process.getBuiltinModule('node:fs');
/** Copied into this realm's ArrayBuffer: pdf-lib checks `instanceof ArrayBuffer`, and Node's is not jsdom's. */
function buffer(from: ArrayLike<number>): ArrayBuffer {
  const out = new ArrayBuffer(from.length);
  new Uint8Array(out).set(from);
  return out;
}
// A 1 × 1 PNG stands in for the parchment, which the browser converts from WebP.
const PNG = Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
const assets = (): SheetAssets => ({
  sheet: buffer(fs.readFileSync('public/character-sheet.pdf')),
  font: buffer(fs.readFileSync('public/fonts/Caveat-Regular.ttf')),
  heading: buffer(fs.readFileSync('public/Colus.otf')),
  parchment: buffer(PNG),
});
const RATES = { copper: 1, silver: 10, gold: 100 };

const weapon = (name: string, grip: string, range: string, damage: string, durability: number, featuresText: string) =>
  ({ name, weight: null, effect: null, armour: null, weapon: { grip, range, damage, durability, featuresText, skill: 'Staves' } }) as unknown as EquipmentItemDto;
const thing = (name: string, weight: string | null, extra: Partial<EquipmentItemDto> = {}) =>
  ({ name, weight, effect: null, weapon: null, armour: null, ...extra }) as EquipmentItemDto;

const ref: CreationReference = {
  ...creationRef,
  spells: creationRef.spells.map(s => ({ ...s, castingTime: 'Action', description: `${s.name} description.`, ranked: s.kind === 'Spell' ? { prerequisite: '', range: '10 metres', duration: 'Instant' } : null })),
  abilities: creationRef.abilities.map(a => ({ ...a, wp: '3', effect: `${a.name} effect.` })),
  equipment: [
    weapon('Staff', '2H', '2', 'D8', 9, 'Bludgeoning'), weapon('Dagger', '1H', 'STR', 'D8', 6, 'Subtle, piercing'),
    weapon('Short sword', '1H', '2', 'D10', 12, 'Slashing'),
    thing('Leather armour', null, { armour: { rating: 1, isHelmet: false } as EquipmentItemDto['armour'] }),
    thing('Open helmet', null, { armour: { rating: 1, isHelmet: true } as EquipmentItemDto['armour'] }),
    thing('Spellbook', '1'), thing('Torch', '1'), thing('Flint and tinder', '-'), thing('Simple clothes', null),
  ],
};

function aodhan(): Character {
  return {
    name: 'Archmaster Aodhan', nickname: '', kin: 'Human', profession: 'Mage', school: 'Elementalism', age: 'Old',
    attributes: { STR: 8, CON: 11, AGL: 9, INT: 16, WIL: 18, CHA: 14 },
    skills: [{ name: 'Elementalism', level: 14, trained: true }, { name: 'Awareness', level: 14, trained: true }],
    abilities: [],
    kinAbilities: ['Adaptive'],
    spells: [
      { name: 'FIREBALL', school: 'Elementalism', kind: 'Spell' }, { name: 'GUST OF WIND', school: 'Elementalism', kind: 'Spell' },
      { name: 'Heat/Chill', school: 'Elementalism', kind: 'Trick' },
    ],
    gear: [
      { name: 'Staff', quantity: 1, note: '' }, { name: 'Spellbook', quantity: 1, note: '' }, { name: 'Torch', quantity: 1, note: '' },
      { name: 'Flint and tinder', quantity: 1, note: '' }, { name: 'Simple clothes', quantity: 1, note: '' },
    ],
    copper: 70, weakness: 'Fainthearted. You always stay at the back of the group.',
    memento: 'Worn diary full of your experiences and discoveries.', appearance: 'Tall and wiry. Long white beard.',
  };
}

/** Every sheet row in use: 15 ability lines, 7 secondary skills, 3 weapons, armour, helmet, 10 inventory rows, all three coins. */
function full(): Character {
  const c = aodhan();
  const secondary = ['Elementalism', 'Animism', 'Demonology', 'Illusionism', 'Mentalism', 'Necromancy', 'Symbolism'];
  return {
    ...c,
    skills: [...c.skills, ...secondary.slice(1).map(name => ({ name, level: 5, trained: false }))],
    abilities: [{ name: 'Veteran', count: 1 }, { name: 'Robust', count: 2 }],
    spells: ref.spells.filter(s => s.school === 'Elementalism' || s.school === 'General Magic').map(s => ({ name: s.name, school: s.school, kind: s.kind })),
    gear: [
      { name: 'Staff', quantity: 1, note: '' }, { name: 'Dagger', quantity: 1, note: '' }, { name: 'Short sword', quantity: 1, note: '' },
      { name: 'Leather armour', quantity: 1, note: '' }, { name: 'Open helmet', quantity: 1, note: '' },
      { name: 'Torch', quantity: 10, note: '' }, { name: 'Flint and tinder', quantity: 1, note: '' },
    ],
    copper: 1234,
  };
}

describe('sheetValues', () => {
  it("writes Aodhan's identity, attributes, ratings and names-only abilities", () => {
    const v = sheetValues(aodhan(), ref, RATES);

    expect(v.profession).toBe('Mage – Elementalism');
    expect(v['damageBonus:STR']).toBe('–');
    expect(v['damageBonus:AGL']).toBe('–');
    expect(v['attribute:INT']).toBe('16');
    expect([v['abilities:1'], v['abilities:2'], v['abilities:3'], v['abilities:4'], v['abilities:5']])
      .toEqual(['Adaptive', 'Fireball', 'Gust of wind', 'Heat/chill', undefined]);
    expect([v.movement, v.encumbrance, v.wpMax, v.hpMax]).toEqual(['8', '4', '18', '11']);
    expect([v['skill:Awareness'], v['skill:Acrobatics'], v['secondary:1:level'], v['secondary:1:name']]).toEqual(['14', '5', '14', 'Elementalism (INT)']);
    expect([v['money:gold'], v['money:silver'], v['money:copper']]).toEqual([undefined, '7', undefined]);
    expect([v['inventory:1'], v['inventory:2'], v.tiny]).toEqual(['Spellbook', 'Torch', 'Flint and tinder']);
    expect([v['weapon:1:name'], v['weapon:1:grip'], v['weapon:1:range'], v['weapon:1:damage'], v['weapon:1:durability'], v['weapon:1:features']])
      .toEqual(['Staff', '2H', '2', 'D8', '9', 'Bludgeoning']);
  });

  it('a full character writes every field the sheet has', () => {
    const v = sheetValues(full(), ref, RATES);

    const missing = (Object.keys(SHEET_FIELDS) as SheetField[]).filter(f => !v[f]);
    expect(missing).toEqual([]);
    expect([v['money:gold'], v['money:silver'], v['money:copper']]).toEqual(['12', '3', '4']);
    expect([v.armour, v['armour:rating'], v.helmet, v['helmet:rating']]).toEqual(['Leather armour', '1', 'Open helmet', '1']);
  });
});

describe('fitText', () => {
  it('never writes wider than its box, shrinking, wrapping and then cutting with "…"', async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(assets().font, HAND_FONT_OPTIONS);
    const long = 'Fainthearted. You always stay at the back of the group, and never once lead the way into a dark place. '.repeat(3);

    // One field of each box shape: measuring is slow, and same-shaped rows fit alike.
    const shapes = new Map(Object.entries(SHEET_FIELDS).map(([field, box]) => [`${box.width}/${box.size}/${box.lines ?? 1}`, [field, box] as const]));
    for (const [field, box] of shapes.values()) {
      const fitted = fitText(font, long, box);
      expect(fitted.size, field).toBeGreaterThanOrEqual(box.size * 0.6);
      expect(fitted.lines.length, field).toBeLessThanOrEqual(box.lines ?? 1);
      for (const line of fitted.lines) expect(font.widthOfTextAtSize(line, fitted.size), field).toBeLessThanOrEqual(box.width);
    }
    expect(fitText(font, long, SHEET_FIELDS.kin).lines[0]).toMatch(/…$/);
    expect(fitText(font, 'Human', SHEET_FIELDS.kin)).toEqual({ size: SHEET_FIELDS.kin.size, lines: ['Human'] });
  });
});

describe('buildSheetPdf', () => {
  it("Aodhan's PDF is the sheet page then at least one page of descriptions, all the sheet's size", async () => {
    const pdf = await PDFDocument.load(await buildSheetPdf(aodhan(), ref, RATES, assets()));
    const sheet = (await PDFDocument.load(assets().sheet)).getPage(0).getSize();

    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    for (const page of pdf.getPages()) expect(page.getSize()).toEqual(sheet);
  });

  it('builds with a 200-character weakness, characters the font lacks, 20 gear items and every row full', async () => {
    const c: Character = {
      ...full(),
      name: 'Ærwyn ✨',
      weakness: 'W'.repeat(200),
      gear: [...full().gear, ...Array.from({ length: 20 }, (_, i) => ({ name: `Trinket ${i + 1}`, quantity: 1, note: '' }))],
    };
    const pdf = await PDFDocument.load(await buildSheetPdf(c, ref, RATES, assets()));

    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
