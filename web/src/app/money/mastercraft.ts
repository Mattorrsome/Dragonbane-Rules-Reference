import { EquipmentItemDto } from '../api/models';

export interface WeaponStats {
  costCopper: number | null;
  strRequirement: number | null;
  durability: number | null;
}

/** The mastercrafted rule from the Melee weapons note: ×10 cost, STR −3 (≤0 → none), durability +3. */
export function mastercraft(stats: WeaponStats): WeaponStats {
  const str = stats.strRequirement === null ? null : stats.strRequirement - 3;
  return {
    costCopper: stats.costCopper === null ? null : stats.costCopper * 10,
    strRequirement: str !== null && str > 0 ? str : null,
    durability: stats.durability === null ? null : stats.durability + 3,
  };
}

/** The item as its mastercrafted version (cost, STR and durability changed); items without weapon stats are returned as-is. */
export function mastercraftedItem(item: EquipmentItemDto): EquipmentItemDto {
  if (!item.weapon) return item;
  const mc = mastercraft({ costCopper: item.costCopper, strRequirement: item.weapon.strRequirement, durability: item.weapon.durability });
  return { ...item, costCopper: mc.costCopper, weapon: { ...item.weapon, strRequirement: mc.strRequirement, durability: mc.durability } };
}
