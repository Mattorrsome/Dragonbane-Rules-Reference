using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;
using Dragonbane.Api.Import;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Dragonbane.Api.Tests.Import;

public sealed class TreasureImporterTests : IDisposable
{
    readonly SqliteConnection _connection = new("Data Source=:memory:");
    readonly DragonbaneDbContext _db;
    readonly IReadOnlyList<MarkdownSection> _treasure = Read("Dragonbane_Treasure_Table.md");

    public TreasureImporterTests()
    {
        _connection.Open();
        _db = new DragonbaneDbContext(new DbContextOptionsBuilder<DragonbaneDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();
        var equipment = Read("Dragonbane_Equipment_Tables.md");
        CurrencyImporter.Import(equipment, _db);
        EquipmentImporter.Import(equipment, _db);
        SpellsImporter.Import(Read("Dragonbane_Spell_Tables.md"), _db);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    static IReadOnlyList<MarkdownSection> Read(string file) =>
        MarkdownDocument.Parse(File.ReadAllText(Path.Combine(TestPaths.SourceMaterial, file)));

    TreasureEntry Entry(int roll)
    {
        TreasureImporter.Import(_treasure, _db);
        _db.ChangeTracker.Clear();
        return _db.TreasureEntries
            .Include(e => e.Rolls).ThenInclude(r => r.Coin)
            .Include(e => e.Rolls).ThenInclude(r => r.Outcomes).ThenInclude(o => o.Rolls)
            .Single(e => e.Roll == roll);
    }

    [Fact]
    public void Imports_40_entries()
    {
        Assert.Empty(Entry(37).Rolls);
        Assert.Equal(40, _db.TreasureEntries.Count());
    }

    [Fact]
    public void Coin_rolls()
    {
        var four = Assert.Single(Entry(4).Rolls);
        Assert.Equal((2, 6, 10, "Copper", RollPurpose.Coins), (four.DiceCount, four.DieSides, four.Multiplier, four.Coin?.Name, four.Purpose));
        var eight = Assert.Single(_db.TreasureEntries.Include(e => e.Rolls).ThenInclude(r => r.Coin).Single(e => e.Roll == 8).Rolls);
        Assert.Equal((1, 6, 5, "Silver"), (eight.DiceCount, eight.DieSides, eight.Multiplier, eight.Coin?.Name));
    }

    [Fact]
    public void Gem_values()
    {
        var outcomes = Assert.Single(Entry(26).Rolls).Outcomes.OrderBy(o => o.Face).ToList();

        Assert.Equal(("glass", 2, "2 copper"), (outcomes[0].Label, outcomes[0].ValueCopper, outcomes[0].ValueText));
        Assert.Equal(("diamond", 10000), (outcomes[5].Label, outcomes[5].ValueCopper));
    }

    [Fact]
    public void Mastercrafted_links()
    {
        var face3 = Assert.Single(Entry(31).Rolls).Outcomes.Single(o => o.Face == 3);

        Assert.True(face3.IsMastercrafted);
        Assert.Equal("Battleaxe", _db.EquipmentItems.Single(i => i.Id == face3.EquipmentItemId).Name);
    }

    [Fact]
    public void Grimoire()
    {
        var rolls = Entry(35).Rolls.OrderBy(r => r.Sequence).ToList();

        Assert.Equal([RollPurpose.Pick, RollPurpose.SpellRank, RollPurpose.Number], rolls.Select(r => r.Purpose));
        Assert.Equal(-1, rolls[1].Modifier);
    }

    [Fact]
    public void Bottle_nested_hp()
    {
        var face6 = Assert.Single(Entry(36).Rolls).Outcomes.Single(o => o.Face == 6);

        var hp = Assert.Single(face6.Rolls);
        Assert.Equal((3, 6, RollPurpose.Number), (hp.DiceCount, hp.DieSides, hp.Purpose));
    }

    [Fact]
    public void Seed_validation_rejects_bad_item()
    {
        var seed = TreasureSeed.Rolls.ToDictionary(p => p.Key, p => p.Value);
        seed[28] = [new SeedRoll("weapon", 1, 1, RollPurpose.Pick, Outcomes: [new SeedOutcome("vorpal", Item: "Vorpal sword")])];

        var ex = Assert.Throws<InvalidDataException>(() => TreasureImporter.Import(_treasure, _db, seed));
        Assert.Contains("Vorpal sword", ex.Message);
    }
}
