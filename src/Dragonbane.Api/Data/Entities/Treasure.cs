namespace Dragonbane.Api.Data.Entities;

public enum RollPurpose { Coins, Pick, Number, SpellRank }

public class TreasureEntry : IEntity
{
    public int Id { get; set; }
    public int Roll { get; set; }
    public string Name { get; set; } = "";
    public string EffectText { get; set; } = "";
    public List<TreasureRoll> Rolls { get; set; } = [];
}

/// <summary>A dice spec owned by exactly one parent: a treasure entry or an outcome of another roll.</summary>
public class TreasureRoll : IEntity
{
    public int Id { get; set; }
    public int? EntryId { get; set; }
    public int? OutcomeId { get; set; }
    public int Sequence { get; set; }
    public string Label { get; set; } = "";
    public int DiceCount { get; set; }
    public int DieSides { get; set; }
    public int Modifier { get; set; }
    public int Multiplier { get; set; }
    public RollPurpose Purpose { get; set; }
    public int? CoinId { get; set; }
    public CurrencyRate? Coin { get; set; }
    public List<TreasureOutcome> Outcomes { get; set; } = [];
}

public class TreasureOutcome : IEntity
{
    public int Id { get; set; }
    public int RollId { get; set; }
    public int Face { get; set; }
    public string Label { get; set; } = "";
    public int? ValueCopper { get; set; }
    public string? ValueText { get; set; }
    public int? EquipmentItemId { get; set; }
    public bool IsMastercrafted { get; set; }
    public int? MagicSchoolId { get; set; }
    public List<TreasureRoll> Rolls { get; set; } = [];
}
