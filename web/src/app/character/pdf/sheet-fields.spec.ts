import { SHEET_FIELDS, SheetField } from './sheet-fields';

/** The size of page 2 of DB-Character-Sheet.pdf, in points. */
const PAGE = { width: 612.283, height: 790.866 };

describe('SHEET_FIELDS', () => {
  it('gives every field a box inside the page', () => {
    for (const [field, box] of Object.entries(SHEET_FIELDS)) {
      const lines = box.lines ?? 1;
      expect(box.width, field).toBeGreaterThan(0);
      expect(box.size, field).toBeGreaterThan(0);
      expect(box.x, field).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, field).toBeLessThanOrEqual(PAGE.width);
      expect(box.y - (lines - 1) * (box.lineHeight ?? 0), field).toBeGreaterThanOrEqual(0);
      expect(box.y + box.size, field).toBeLessThanOrEqual(PAGE.height);
    }
  });

  it('names every row the sheet prints', () => {
    const expected: SheetField[] = [
      'name', 'kin', 'age', 'profession', 'weakness', 'appearance', 'attribute:STR', 'attribute:CHA',
      'damageBonus:STR', 'damageBonus:AGL', 'movement', 'encumbrance', 'abilities:1', 'abilities:15',
      'skill:Acrobatics', 'skill:Hunting and Fishing', 'skill:Swimming', 'skill:Axes', 'skill:Swords',
      'secondary:1:level', 'secondary:6:name', 'inventory:1', 'inventory:10', 'memento', 'tiny',
      'money:gold', 'money:silver', 'money:copper', 'armour', 'armour:rating', 'helmet', 'helmet:rating',
      'weapon:1:name', 'weapon:3:features', 'weapon:2:durability', 'wpMax', 'hpMax',
    ];
    for (const field of expected) expect(SHEET_FIELDS[field], field).toBeDefined();
    // 16 identity, attribute and rating fields, 15 ability lines, 30 skills, 6 × 2 secondary, 10 inventory, memento, tiny, 3 coins, 4 armour, 3 × 6 weapon, WP and HP
    expect(Object.keys(SHEET_FIELDS).length).toBe(112);
  });
});
