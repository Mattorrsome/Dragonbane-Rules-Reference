namespace Dragonbane.Api.Data.Entities;

public class MagicSchool : INamedEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string? Note { get; set; }
}

public class Requirement : IEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

public enum SpellKind { Trick, Spell, Recipe }

public class Spell : IEntity
{
    public int Id { get; set; }
    public int SchoolId { get; set; }
    public MagicSchool School { get; set; } = null!;
    public string Name { get; set; } = "";
    public int Rank { get; set; }
    public SpellKind Kind { get; set; }
    public string CastingTime { get; set; } = "";
    public string RequirementText { get; set; } = "";
    public string Description { get; set; } = "";
    public List<Requirement> Requirements { get; set; } = [];
}

public class RankedSpell : Spell
{
    public string Prerequisite { get; set; } = "";
    public string Range { get; set; } = "";
    public string Duration { get; set; } = "";
}

public class Recipe : RankedSpell
{
    public int? CostPerDoseCopper { get; set; }
    public string? CostPerDoseUnit { get; set; }
    public int? SupplyId { get; set; }
    public Supply? Supply { get; set; }
}
