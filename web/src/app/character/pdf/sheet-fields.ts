import { ATTRIBUTES, Attribute } from '../../hero/hero';

/** The core and weapon skills as the sheet prints them, by their Skills-table names, top to bottom. */
const CORE_SKILLS = [
  'Acrobatics', 'Awareness', 'Bartering', 'Beast Lore', 'Bluffing', 'Bushcraft', 'Crafting', 'Evade', 'Healing',
  'Hunting and Fishing', 'Languages', 'Myths and Legends', 'Performance', 'Persuasion', 'Riding', 'Seamanship',
  'Sleight of Hand', 'Sneaking', 'Spot Hidden', 'Swimming',
] as const;
const WEAPON_SKILLS = ['Axes', 'Bows', 'Brawling', 'Crossbows', 'Hammers', 'Knives', 'Slings', 'Spears', 'Staves', 'Swords'] as const;
const WEAPON_COLUMNS = ['name', 'grip', 'range', 'damage', 'durability', 'features'] as const;

type Row3 = 1 | 2 | 3;
type Row6 = Row3 | 4 | 5 | 6;
type Row7 = Row6 | 7;
type Row10 = Row7 | 8 | 9 | 10;
type Row15 = Row10 | 11 | 12 | 13 | 14 | 15;

export type SheetField =
  | 'name' | 'kin' | 'age' | 'profession' | 'weakness' | 'appearance'
  | `attribute:${Attribute}`
  | 'damageBonus:STR' | 'damageBonus:AGL' | 'movement' | 'encumbrance'
  | `abilities:${Row15}`
  | `skill:${(typeof CORE_SKILLS)[number] | (typeof WEAPON_SKILLS)[number]}`
  | `secondary:${Row7}:${'level' | 'name'}`
  | `inventory:${Row10}`
  | 'memento' | 'tiny'
  | `money:${'gold' | 'silver' | 'copper'}`
  | 'armour' | 'armour:rating' | 'helmet' | 'helmet:rating'
  | `weapon:${Row3}:${(typeof WEAPON_COLUMNS)[number]}`
  | 'wpMax' | 'hpMax';

/**
 * Where a value is written, in PDF points from the page's bottom-left: (x, y) is the left end of the first line's
 * baseline, `width` the room to its right, `size` the font size. A box of several `lines` steps down `lineHeight` each.
 * A `center` box (a circle or short banner) centres its text in the width.
 */
export interface SheetBox {
  x: number;
  y: number;
  width: number;
  size: number;
  lines?: number;
  lineHeight?: number;
  align?: 'center';
}

const HAND = 16;
const SKILL_STEP = 14.17;

/** `count` rows down from (x, y), `step` apart, keyed by `key(row number)`. */
function rows<K extends string>(count: number, key: (row: number) => string, box: SheetBox, step: number): Record<K, SheetBox> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => [key(i + 1), { ...box, y: +(box.y - i * step).toFixed(1) }]),
  ) as Record<K, SheetBox>;
}

const named = <K extends string, N extends string>(names: readonly N[], key: (name: N) => string, box: SheetBox, step: number) =>
  rows<K>(names.length, row => key(names[row - 1]), box, step);

/** Measured against page 2 of DB-Character-Sheet.pdf with `scripts/calibrate-sheet.mjs`. */
export const SHEET_FIELDS: Record<SheetField, SheetBox> = {
  kin: { x: 35, y: 736, width: 100, size: HAND },
  age: { x: 147, y: 736, width: 57, size: HAND },
  profession: { x: 35, y: 719, width: 169, size: HAND },
  weakness: { x: 35, y: 701, width: 169, size: HAND, lines: 2, lineHeight: 16.7 },
  appearance: { x: 409, y: 752, width: 169, size: HAND, lines: 5, lineHeight: 17 },
  name: { x: 238, y: 674, width: 148, size: 20, align: 'center' },
  ...attributeBoxes(),
  'damageBonus:STR': { x: 154, y: 553, width: 26, size: HAND, align: 'center' },
  'damageBonus:AGL': { x: 340, y: 553, width: 26, size: HAND, align: 'center' },
  movement: { x: 530, y: 553, width: 26, size: HAND, align: 'center' },
  encumbrance: { x: 530, y: 520, width: 26, size: HAND, align: 'center' },
  ...rows<`abilities:${Row15}`>(15, r => `abilities:${r}`, { x: 35, y: 498, width: 124, size: HAND }, 14.4),
  ...named<`skill:${(typeof CORE_SKILLS)[number]}`, (typeof CORE_SKILLS)[number]>(CORE_SKILLS, s => `skill:${s}`, { x: 197, y: 497, width: 22, size: HAND }, SKILL_STEP),
  ...named<`skill:${(typeof WEAPON_SKILLS)[number]}`, (typeof WEAPON_SKILLS)[number]>(WEAPON_SKILLS, s => `skill:${s}`, { x: 321, y: 483, width: 22, size: HAND }, SKILL_STEP),
  ...rows<`secondary:${Row7}:level`>(7, r => `secondary:${r}:level`, { x: 321, y: 314, width: 22, size: HAND }, SKILL_STEP),
  ...rows<`secondary:${Row7}:name`>(7, r => `secondary:${r}:name`, { x: 350, y: 314, width: 74, size: HAND }, SKILL_STEP),
  ...rows<`inventory:${Row10}`>(10, r => `inventory:${r}`, { x: 463, y: 499, width: 115, size: HAND }, 14.07),
  memento: { x: 453, y: 343, width: 125, size: HAND, lines: 3, lineHeight: 14.4 },
  tiny: { x: 459, y: 275, width: 116, size: HAND, lines: 5, lineHeight: 14.2 },
  'money:gold': { x: 96, y: 274, width: 55, size: HAND },
  'money:silver': { x: 96, y: 245, width: 55, size: HAND },
  'money:copper': { x: 96, y: 215, width: 55, size: HAND },
  armour: { x: 93, y: 158, width: 100, size: HAND },
  'armour:rating': { x: 45, y: 145, width: 20, size: HAND, align: 'center' },
  helmet: { x: 263, y: 158, width: 129, size: HAND },
  'helmet:rating': { x: 226, y: 152, width: 20, size: HAND, align: 'center' },
  ...weaponRows(),
  wpMax: { x: 424, y: 138, width: 26, size: 22, align: 'center' },
  hpMax: { x: 424, y: 73, width: 26, size: 22, align: 'center' },
};

function attributeBoxes() {
  return Object.fromEntries(ATTRIBUTES.map((a, i) => [`attribute:${a}`, { x: +(147.6 + i * 58.2).toFixed(1), y: 622.5, width: 26, size: 24, align: 'center' as const }])) as
    Record<`attribute:${Attribute}`, SheetBox>;
}

function weaponRows() {
  const columns: Record<(typeof WEAPON_COLUMNS)[number], [x: number, width: number]> = {
    name: [35, 93], grip: [140, 30], range: [183, 30], damage: [225, 30], durability: [267, 20], features: [289, 103],
  };
  return Object.assign({}, ...WEAPON_COLUMNS.map(column =>
    rows(3, r => `weapon:${r}:${column}`, { x: columns[column][0], y: 67, width: columns[column][1], size: HAND }, 16),
  )) as Record<`weapon:${Row3}:${(typeof WEAPON_COLUMNS)[number]}`, SheetBox>;
}
