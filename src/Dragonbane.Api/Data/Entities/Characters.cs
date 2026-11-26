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
