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
