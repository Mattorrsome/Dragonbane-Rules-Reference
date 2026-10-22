namespace Dragonbane.Api.Data.Entities;

public class CurrencyRate : INamedEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int CopperValue { get; set; }
}
