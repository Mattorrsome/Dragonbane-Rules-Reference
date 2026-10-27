namespace Dragonbane.Api.Data.Entities;

public class EquipmentCategory : INamedEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    /// <summary>Source column header for the item name, e.g. "Weapon" or "Instrument".</summary>
    public string NameHeader { get; set; } = "";
    /// <summary>Source column header mapped to <see cref="EquipmentItem.Effect"/>, e.g. "Musician effect".</summary>
    public string? EffectHeader { get; set; }
    public bool HasWeight { get; set; }
    public bool CanResell { get; set; }
    public string? Note { get; set; }
}

public class Supply : IGlossaryEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
}

public class WeaponTerm : IGlossaryEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
}

public class WeaponFeature : IGlossaryEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
}

public class DamageType : INamedEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

public class EquipmentItem : IEntity
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public EquipmentCategory Category { get; set; } = null!;
    public string Name { get; set; } = "";
    public int? CostCopper { get; set; }
    /// <summary>Unit after the price, e.g. "day" in "200/day".</summary>
    public string? CostUnit { get; set; }
    public bool CostOrMore { get; set; }
    public string CostText { get; set; } = "";
    public int? SupplyId { get; set; }
    public Supply? Supply { get; set; }
    public string? Weight { get; set; }
    public string? Effect { get; set; }
}

public class Weapon : EquipmentItem
{
    public string? Grip { get; set; }
    public int? StrRequirement { get; set; }
    public string Range { get; set; } = "";
    public string Damage { get; set; } = "";
    public int? Durability { get; set; }
    public bool IsRanged { get; set; }
    public string FeaturesText { get; set; } = "";
    /// <summary>The skill an attack with this weapon rolls against (the markdown's Skill column).</summary>
    public int SkillId { get; set; }
    public Skill Skill { get; set; } = null!;
    public List<WeaponFeature> Features { get; set; } = [];
    public List<DamageType> DamageTypes { get; set; } = [];
}

public class Armour : EquipmentItem
{
    public int Rating { get; set; }
    public bool IsHelmet { get; set; }
}
