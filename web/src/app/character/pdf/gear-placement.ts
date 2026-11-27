import { findItem } from '../../hero/hero';
import { Character, CreationReference, GearItem } from '../character';
import { gearLabel } from '../display';

const READY_WEAPONS = 3;
const INVENTORY_ROWS = 10;

export interface PlacedGear {
  weapons: GearItem[];
  armour: GearItem | null;
  helmet: GearItem | null;
  inventory: string[];
  tiny: string[];
  overflow: string[];
}

/** "1", "2", "1/4" as a number. */
function weightOf(text: string): number {
  const [top, bottom = '1'] = text.split('/');
  return Number(top) / Number(bottom);
}

/**
 * Where each piece of gear goes on the sheet, from the Equipment table: the first three weapons or shields are ready,
 * the first armour and helmet are worn, weight "-" items are tiny, and the rest fill inventory rows by weight
 * (a row per started weight, so up to four field rations share one). What has no row (no weight at all: clothes,
 * animals, vehicles) or no longer fits is overflow.
 */
export function placeGear(c: Character, ref: CreationReference): PlacedGear {
  const placed: PlacedGear = { weapons: [], armour: null, helmet: null, inventory: [], tiny: [], overflow: [] };
  for (const g of c.gear) {
    if (g.quantity < 1) continue;
    const item = findItem(ref, g.name);
    const label = gearLabel(g);
    if (item?.weapon) {
      const ready = Math.min(g.quantity, READY_WEAPONS - placed.weapons.length);
      for (let i = 0; i < ready; i++) placed.weapons.push({ ...g, quantity: 1 });
      if (g.quantity > ready) placed.overflow.push(gearLabel({ ...g, quantity: g.quantity - ready }));
    } else if (item?.armour) {
      const slot = item.armour.isHelmet ? 'helmet' : 'armour';
      if (placed[slot]) placed.overflow.push(label);
      else placed[slot] = g;
    } else if (item?.weight === '-') {
      placed.tiny.push(label);
    } else if (item && item.weight === null) {
      placed.overflow.push(label);
    } else {
      // An item not in the table is carried as weight 1.
      const rows = item?.weight ? Math.ceil(g.quantity * weightOf(item.weight)) : g.quantity;
      if (placed.inventory.length + rows > INVENTORY_ROWS) placed.overflow.push(label);
      else placed.inventory.push(label, ...Array<string>(rows - 1).fill(`(${g.name})`));
    }
  }
  return placed;
}
