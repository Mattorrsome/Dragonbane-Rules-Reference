namespace Dragonbane.Api.Data.Entities;

public class SkillType : INamedEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

public class Attribute : IEntity
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
}

public class Skill : IEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int SkillTypeId { get; set; }
    public SkillType SkillType { get; set; } = null!;
    public int AttributeId { get; set; }
    public Attribute Attribute { get; set; } = null!;
    public string? AttributeNote { get; set; }
    public string Description { get; set; } = "";
}

public class HeroicAbility : IEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Prerequisite { get; set; } = "";
    public string Wp { get; set; } = "";
    public string Effect { get; set; } = "";
}
