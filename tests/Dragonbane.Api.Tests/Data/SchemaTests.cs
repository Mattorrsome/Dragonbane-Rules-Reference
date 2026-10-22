using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Dragonbane.Api.Tests.Data;

public sealed class SchemaTests : IDisposable
{
    readonly SqliteConnection _connection = new("Data Source=:memory:");
    readonly DragonbaneDbContext _db;

    public SchemaTests()
    {
        _connection.Open();
        _db = new DragonbaneDbContext(new DbContextOptionsBuilder<DragonbaneDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public void Creates_tpt_and_junction_tables()
    {
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table'";
        var tables = new List<string>();
        using (var reader = cmd.ExecuteReader())
            while (reader.Read()) tables.Add(reader.GetString(0));

        Assert.Subset(tables.ToHashSet(), new HashSet<string>
        {
            "Spell", "RankedSpell", "Recipe", "EquipmentItem", "Weapon", "Armour",
            "SpellRequirement", "WeaponWeaponFeature", "WeaponDamageType", "TreasureRoll",
        });
    }

    [Fact]
    public void Rejects_roll_with_two_parents()
    {
        var entry = new TreasureEntry { Roll = 1, Name = "Chest", EffectText = "x" };
        var parentRoll = new TreasureRoll { Label = "a", DiceCount = 1, DieSides = 6, Multiplier = 1, Purpose = RollPurpose.Pick };
        entry.Rolls.Add(parentRoll);
        var outcome = new TreasureOutcome { Face = 1, Label = "o" };
        parentRoll.Outcomes.Add(outcome);
        _db.Add(entry);
        _db.SaveChanges();

        _db.Add(new TreasureRoll
        {
            EntryId = entry.Id, OutcomeId = outcome.Id, Label = "b",
            DiceCount = 1, DieSides = 6, Multiplier = 1, Purpose = RollPurpose.Coins,
        });

        Assert.Throws<DbUpdateException>(() => _db.SaveChanges());
    }
}
