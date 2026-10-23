import { EquipmentCategoryDto, EquipmentItemDto } from '../../api/models';

/** One table column: header text plus how to read the cell from an item ('cost' is priced live). */
export interface Column {
  header: string;
  value: (item: EquipmentItemDto) => string | number | null | undefined;
  cost?: true;
}

const COST: Column = { header: 'Cost', value: () => null, cost: true };
const SUPPLY: Column = { header: 'Supply', value: i => i.supply };

/** Columns as the source tables have them, per kind of category. */
export function columnsFor(category: EquipmentCategoryDto, sample: EquipmentItemDto | undefined): Column[] {
  if (sample?.weapon) {
    return [
      { header: 'Grip', value: i => i.weapon?.grip },
      { header: 'STR', value: i => i.weapon?.strRequirement },
      { header: 'Range', value: i => i.weapon?.range },
      { header: 'Damage', value: i => i.weapon?.damage },
      { header: 'Durability', value: i => i.weapon?.durability },
      COST,
      SUPPLY,
      { header: 'Features', value: i => i.weapon?.featuresText },
    ];
  }
  if (sample?.armour) {
    return [
      { header: 'Rating', value: i => (i.armour?.isHelmet ? `+${i.armour.rating}` : i.armour?.rating) },
      COST,
      SUPPLY,
      { header: 'Effect', value: i => i.effect },
    ];
  }
  return [
    COST,
    SUPPLY,
    ...(category.hasWeight ? [{ header: 'Weight', value: (i: EquipmentItemDto) => i.weight }] : []),
    ...(category.effectHeader ? [{ header: category.effectHeader, value: (i: EquipmentItemDto) => i.effect }] : []),
  ];
}
