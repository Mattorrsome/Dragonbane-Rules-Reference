namespace Dragonbane.Api.Data.Entities;

public interface IEntity
{
    int Id { get; }
}

public interface INamedEntity : IEntity
{
    string Name { get; }
}

/// <summary>A name/description glossary row: supplies, weapon terms and weapon features.</summary>
public interface IGlossaryEntity : INamedEntity
{
    string Description { get; }
}
