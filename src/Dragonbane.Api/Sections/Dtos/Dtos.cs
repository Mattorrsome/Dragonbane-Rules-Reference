using System.Linq.Expressions;
using Dragonbane.Api.Data.Entities;

namespace Dragonbane.Api.Sections.Dtos;

public sealed record SkillDto(int Id, string Name, string Type, int TypeId, string Attribute, string? AttributeNote, string Description)
    : ISectionDto<Skill, SkillDto>
{
    public static Expression<Func<Skill, SkillDto>> Projection { get; } = s =>
        new SkillDto(s.Id, s.Name, s.SkillType.Name, s.SkillTypeId, s.Attribute.Code, s.AttributeNote, s.Description);
}

public sealed record SkillTypeDto(int Id, string Name) : ISectionDto<SkillType, SkillTypeDto>
{
    public static Expression<Func<SkillType, SkillTypeDto>> Projection { get; } = t => new SkillTypeDto(t.Id, t.Name);
}

public sealed record HeroicAbilityDto(int Id, string Name, string Prerequisite, string Wp, string Effect)
    : ISectionDto<HeroicAbility, HeroicAbilityDto>
{
    public static Expression<Func<HeroicAbility, HeroicAbilityDto>> Projection { get; } = h =>
        new HeroicAbilityDto(h.Id, h.Name, h.Prerequisite, h.Wp, h.Effect);
}

public sealed record RankedSpellDto(string Prerequisite, string Range, string Duration);

public sealed record RecipeDto(int? CostPerDoseCopper, string? CostPerDoseUnit, string? Supply);

public sealed record SpellDto(int Id, string Name, int SchoolId, string School, int Rank, SpellKind Kind, string CastingTime,
    string RequirementText, string Description, RankedSpellDto? Ranked, RecipeDto? Recipe) : ISectionDto<Spell, SpellDto>
{
    public static Expression<Func<Spell, SpellDto>> Projection { get; } = s => new SpellDto(
        s.Id, s.Name, s.SchoolId, s.School.Name, s.Rank, s.Kind, s.CastingTime, s.RequirementText, s.Description,
        s is RankedSpell ? new RankedSpellDto(((RankedSpell)s).Prerequisite, ((RankedSpell)s).Range, ((RankedSpell)s).Duration) : null,
        s is Recipe ? new RecipeDto(((Recipe)s).CostPerDoseCopper, ((Recipe)s).CostPerDoseUnit, ((Recipe)s).Supply!.Name) : null);
}

public sealed record MagicSchoolDto(int Id, string Name, string Description, string? Note) : ISectionDto<MagicSchool, MagicSchoolDto>
{
    public static Expression<Func<MagicSchool, MagicSchoolDto>> Projection { get; } = m =>
        new MagicSchoolDto(m.Id, m.Name, m.Description, m.Note);
}

public sealed record WeaponDto(string? Grip, int? StrRequirement, string Range, string Damage, int? Durability, bool IsRanged, string FeaturesText);

public sealed record ArmourDto(int Rating, bool IsHelmet);

public sealed record EquipmentItemDto(int Id, int CategoryId, string Name, int? CostCopper, string? CostUnit, bool CostOrMore,
    string CostText, string? Supply, string? Weight, string? Effect, WeaponDto? Weapon, ArmourDto? Armour)
    : ISectionDto<EquipmentItem, EquipmentItemDto>
{
    public static Expression<Func<EquipmentItem, EquipmentItemDto>> Projection { get; } = i => new EquipmentItemDto(
        i.Id, i.CategoryId, i.Name, i.CostCopper, i.CostUnit, i.CostOrMore, i.CostText, i.Supply!.Name, i.Weight, i.Effect,
        i is Weapon
            ? new WeaponDto(((Weapon)i).Grip, ((Weapon)i).StrRequirement, ((Weapon)i).Range, ((Weapon)i).Damage,
                ((Weapon)i).Durability, ((Weapon)i).IsRanged, ((Weapon)i).FeaturesText)
            : null,
        i is Armour ? new ArmourDto(((Armour)i).Rating, ((Armour)i).IsHelmet) : null);
}

public sealed record EquipmentCategoryDto(int Id, string Name, string NameHeader, string? EffectHeader, bool HasWeight, bool CanResell, string? Note)
    : ISectionDto<EquipmentCategory, EquipmentCategoryDto>
{
    public static Expression<Func<EquipmentCategory, EquipmentCategoryDto>> Projection { get; } = c =>
        new EquipmentCategoryDto(c.Id, c.Name, c.NameHeader, c.EffectHeader, c.HasWeight, c.CanResell, c.Note);
}

/// <summary>Shared shape for the supply, weapon-term and weapon-feature glossaries.</summary>
public sealed record GlossaryDto<TEntity>(int Id, string Name, string Description) : ISectionDto<TEntity, GlossaryDto<TEntity>>
    where TEntity : IGlossaryEntity
{
    public static Expression<Func<TEntity, GlossaryDto<TEntity>>> Projection { get; } = g =>
        new GlossaryDto<TEntity>(g.Id, g.Name, g.Description);
}

public sealed record TreasureOutcomeDto(int Face, string Label, int? ValueCopper, string? ValueText, int? EquipmentItemId,
    bool IsMastercrafted, int? MagicSchoolId, TreasureRollDto[] Rolls);

public sealed record TreasureRollDto(int Sequence, string Label, int DiceCount, int DieSides, int Modifier, int Multiplier,
    RollPurpose Purpose, string? Coin, TreasureOutcomeDto[] Outcomes);

public sealed record TreasureEntryDto(int Id, int Roll, string Name, string EffectText, TreasureRollDto[] Rolls)
    : ISectionDto<TreasureEntry, TreasureEntryDto>
{
    // Two levels, matching the importer's depth cap: nested rolls never have outcomes.
    public static Expression<Func<TreasureEntry, TreasureEntryDto>> Projection { get; } = e => new TreasureEntryDto(
        e.Id, e.Roll, e.Name, e.EffectText,
        e.Rolls.OrderBy(r => r.Sequence).Select(r => new TreasureRollDto(
            r.Sequence, r.Label, r.DiceCount, r.DieSides, r.Modifier, r.Multiplier, r.Purpose, r.Coin!.Name,
            r.Outcomes.OrderBy(o => o.Face).Select(o => new TreasureOutcomeDto(
                o.Face, o.Label, o.ValueCopper, o.ValueText, o.EquipmentItemId, o.IsMastercrafted, o.MagicSchoolId,
                o.Rolls.OrderBy(n => n.Sequence).Select(n => new TreasureRollDto(
                    n.Sequence, n.Label, n.DiceCount, n.DieSides, n.Modifier, n.Multiplier, n.Purpose, n.Coin!.Name,
                    new TreasureOutcomeDto[0])).ToArray())).ToArray())).ToArray());
}

public sealed record CurrencyRateDto(string Name, int CopperValue);
