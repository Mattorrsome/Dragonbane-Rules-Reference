namespace Dragonbane.Api.Data.Entities;

/// <summary>A typical NPC from the book's table. Its lists keep source order through their Ids.</summary>
public class Npc : INamedEntity
{
    public int Id { get; set; }
    /// <summary>"Bandit chief": the type as written, without "(boss)".</summary>
    public string Name { get; set; } = "";
    public bool IsBoss { get; set; }
    public int Hp { get; set; }
    public int? Wp { get; set; }
    /// <summary>"STR +D6" → attribute STR, dice "D6"; both null for "-".</summary>
    public int? DamageBonusAttributeId { get; set; }
    public Attribute? DamageBonusAttribute { get; set; }
    public string? DamageBonusDice { get; set; }
    public List<NpcSkill> Skills { get; set; } = [];
    public List<NpcHeroicAbility> HeroicAbilities { get; set; } = [];
    public List<NpcGear> Gear { get; set; } = [];
}

/// <summary>A skill level. "Magic school" is not in the Skills table, so it is kept by name instead of linked.</summary>
public class NpcSkill : IEntity
{
    public int Id { get; set; }
    public int NpcId { get; set; }
    public int? SkillId { get; set; }
    public Skill? Skill { get; set; }
    public string? UnlinkedName { get; set; }
    public int Level { get; set; }
}

/// <summary>"Robust x6" → Robust, count 6; abilities without a count have 1.</summary>
public class NpcHeroicAbility : IEntity
{
    public int Id { get; set; }
    public int NpcId { get; set; }
    public int HeroicAbilityId { get; set; }
    public HeroicAbility HeroicAbility { get; set; } = null!;
    public int Count { get; set; }
}

public class NpcGear : IEntity
{
    public int Id { get; set; }
    public int NpcId { get; set; }
    public int EquipmentItemId { get; set; }
    public EquipmentItem EquipmentItem { get; set; } = null!;
}
