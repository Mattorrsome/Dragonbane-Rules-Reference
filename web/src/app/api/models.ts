import { components } from './schema';

type Schemas = components['schemas'];

export type SkillDto = Schemas['SkillDto'];
export type SkillTypeDto = Schemas['SkillTypeDto'];
export type HeroicAbilityDto = Schemas['HeroicAbilityDto'];
export type SpellDto = Schemas['SpellDto'];
export type SpellKind = Schemas['SpellKind'];
export type RankedSpellDto = Schemas['RankedSpellDto'];
export type RecipeDto = Schemas['RecipeDto'];
export type MagicSchoolDto = Schemas['MagicSchoolDto'];
export type EquipmentItemDto = Schemas['EquipmentItemDto'];
export type WeaponDto = Schemas['WeaponDto'];
export type ArmourDto = Schemas['ArmourDto'];
export type EquipmentCategoryDto = Schemas['EquipmentCategoryDto'];
export type SupplyDto = Schemas['GlossaryDtoOfSupply'];
export type WeaponTermDto = Schemas['GlossaryDtoOfWeaponTerm'];
export type WeaponFeatureDto = Schemas['GlossaryDtoOfWeaponFeature'];
export type TreasureEntryDto = Schemas['TreasureEntryDto'];
export type TreasureRollDto = Schemas['TreasureRollDto'];
export type TreasureOutcomeDto = Schemas['TreasureOutcomeDto'];
export type RollPurpose = Schemas['RollPurpose'];
export type CurrencyRateDto = Schemas['CurrencyRateDto'];
export type NpcDto = Schemas['NpcDto'];
export type NpcSkillDto = Schemas['NpcSkillDto'];
export type NpcHeroicAbilityDto = Schemas['NpcHeroicAbilityDto'];

/** How prices are shown: as written in the source, or converted into one coin. */
export type CoinStandard = 'written' | 'copper' | 'silver' | 'gold';
