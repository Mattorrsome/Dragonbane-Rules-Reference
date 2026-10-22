namespace Dragonbane.Api.Data.Entities;

public interface IEntity
{
    int Id { get; }
}

public interface INamedEntity : IEntity
{
    string Name { get; }
}
