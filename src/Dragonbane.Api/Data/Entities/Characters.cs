namespace Dragonbane.Api.Data.Entities;

/// <summary>A kin from the D12 table. Abilities and names keep source order through their Ids.</summary>
public class Kin : INamedEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int RollFrom { get; set; }
    public int RollTo { get; set; }
    public int Movement { get; set; }
    public List<KinAbility> Abilities { get; set; } = [];
    public List<KinName> Names { get; set; } = [];
}

/// <summary>An innate ability. A null Wp means "no WP".</summary>
public class KinAbility : INamedEntity
{
    public int Id { get; set; }
    public int KinId { get; set; }
    public string Name { get; set; } = "";
    public int? Wp { get; set; }
    public string Effect { get; set; } = "";
}

public class KinName : INamedEntity
{
    public int Id { get; set; }
    public int KinId { get; set; }
    public int Roll { get; set; }
    public string Name { get; set; } = "";
}

public class Age : INamedEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int RollFrom { get; set; }
    public int RollTo { get; set; }
    /// <summary>The N in "6 profession + N free".</summary>
    public int FreeSkills { get; set; }
    public List<AgeAdjustment> Adjustments { get; set; } = [];
}

public class AgeAdjustment : IEntity
{
    public int Id { get; set; }
    public int AgeId { get; set; }
    public int AttributeId { get; set; }
    public Attribute Attribute { get; set; } = null!;
    public int Delta { get; set; }
}

public class Memento : IEntity
{
    public int Id { get; set; }
    public int Roll { get; set; }
    public string Text { get; set; } = "";
}

public class Weakness : IEntity
{
    public int Id { get; set; }
    public int Roll { get; set; }
    public string Name { get; set; } = "";
    public string Text { get; set; } = "";
}

public class Appearance : IEntity
{
    public int Id { get; set; }
    public int Roll { get; set; }
    public string Text { get; set; } = "";
}

/// <summary>A profession from the D10 table.</summary>
public class Profession : INamedEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int Roll { get; set; }
    public int KeyAttributeId { get; set; }
    public Attribute KeyAttribute { get; set; } = null!;
    public List<ProfessionSkill> Skills { get; set; } = [];
    public List<ProfessionHeroicAbility> HeroicAbilities { get; set; } = [];
    public List<ProfessionNickname> Nicknames { get; set; } = [];
    public List<GearPackage> GearPackages { get; set; } = [];
}

public class ProfessionSkill : IEntity
{
    public int Id { get; set; }
    public int ProfessionId { get; set; }
    public int SkillId { get; set; }
    public Skill Skill { get; set; } = null!;
}

/// <summary>A starting benefit. More than one row means the player chooses one.</summary>
public class ProfessionHeroicAbility : IEntity
{
    public int Id { get; set; }
    public int ProfessionId { get; set; }
    public int HeroicAbilityId { get; set; }
    public HeroicAbility HeroicAbility { get; set; } = null!;
}

public class ProfessionNickname : INamedEntity
{
    public int Id { get; set; }
    public int ProfessionId { get; set; }
    public int Roll { get; set; }
    public string Name { get; set; } = "";
}

public enum GearEntryKind { Item, Silver }

/// <summary>
/// A starting gear package. Exactly one parent is set: a profession (D6 roll range) or a magic school
/// (starting extras, RollFrom = RollTo = 0).
/// </summary>
public class GearPackage : IEntity
{
    public int Id { get; set; }
    public int? ProfessionId { get; set; }
    public int? MagicSchoolId { get; set; }
    public int RollFrom { get; set; }
    public int RollTo { get; set; }
    public List<GearPackageEntry> Entries { get; set; } = [];
}

/// <summary>
/// One line of a package. An Item with several options is a choice. The amount is Quantity, or
/// DiceCount D DiceSides when set. Silver has no options; its dice give the silver.
/// </summary>
public class GearPackageEntry : IEntity
{
    public int Id { get; set; }
    public int GearPackageId { get; set; }
    public GearEntryKind Kind { get; set; }
    public int Quantity { get; set; } = 1;
    public int? DiceCount { get; set; }
    public int? DiceSides { get; set; }
    public List<GearPackageOption> Options { get; set; } = [];
}

/// <summary>An equipment row, or a name for an item the Equipment tables lack. Exactly one is set.</summary>
public class GearPackageOption : IEntity
{
    public int Id { get; set; }
    public int GearPackageEntryId { get; set; }
    public int? EquipmentItemId { get; set; }
    public EquipmentItem? EquipmentItem { get; set; }
    public string? UnlinkedName { get; set; }
}
