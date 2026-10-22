using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;
using Dragonbane.Api.Import;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Dragonbane.Api.Tests.Import;

public sealed class EquipmentImporterTests : IDisposable
{
    readonly SqliteConnection _connection = new("Data Source=:memory:");
    readonly DragonbaneDbContext _db;

    public EquipmentImporterTests()
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

    void ImportRealFile()
    {
        var doc = MarkdownDocument.Parse(
            File.ReadAllText(Path.Combine(TestPaths.SourceMaterial, "Dragonbane_Equipment_Tables.md")));
        CurrencyImporter.Import(doc, _db);
        EquipmentImporter.Import(doc, _db);
        _db.ChangeTracker.Clear();
    }

    [Fact]
    public void Imports_all_items()
    {
        ImportRealFile();

        Assert.Equal(15, _db.EquipmentCategories.Count());
        Assert.Equal(157, _db.EquipmentItems.Count());
        Assert.Equal(35, _db.Weapons.Count());
        Assert.Equal(6, _db.Armour.Count());
        Assert.Equal(2, _db.Armour.Count(a => a.IsHelmet));
        Assert.Equal(3, _db.CurrencyRates.Count());
        Assert.Equal(100, _db.CurrencyRates.Single(r => r.Name == "Gold").CopperValue);
    }

    [Fact]
    public void Maps_weapon_features_and_damage_types()
    {
        ImportRealFile();
        var weapons = _db.Weapons.Include(w => w.Features).Include(w => w.DamageTypes).ToList();

        var dagger = weapons.Single(w => w.Name == "Dagger");
        Assert.Equal(["Can be thrown", "Subtle"], dagger.Features.Select(f => f.Name).Order());
        Assert.Equal(["Piercing", "Slashing"], dagger.DamageTypes.Select(d => d.Name).Order());
        var flail = weapons.Single(w => w.Name == "Flail");
        Assert.Equal("cannot parry", flail.Effect);
        Assert.Null(flail.Durability);
        Assert.Equal("STR x 2", weapons.Single(w => w.Name == "Short spear").Range);
    }

    [Fact]
    public void Maps_costs()
    {
        ImportRealFile();

        var bodyguard = _db.EquipmentItems.Single(i => i.Name == "Bodyguard");
        Assert.Equal((200, "/day"), (bodyguard.CostCopper, bodyguard.CostUnit));
        Assert.True(_db.EquipmentItems.Single(i => i.Name == "Teacher").CostOrMore);
        Assert.Null(_db.EquipmentItems.Single(i => i.Name == "Unarmed").CostCopper);
        Assert.Equal("1/4", _db.EquipmentItems.Single(i => i.Name == "Field ration").Weight);
    }

    [Fact]
    public void Keeps_mastercrafted_note()
    {
        ImportRealFile();

        Assert.StartsWith("A mastercrafted version costs 10 times normal",
            _db.EquipmentCategories.Single(c => c.Name == "Melee weapons").Note);
    }

    [Fact]
    public void Category_headers()
    {
        ImportRealFile();

        Assert.Equal("Effect/capacity", _db.EquipmentCategories.Single(c => c.Name == "Animals for purchase").EffectHeader);
        var services = _db.EquipmentCategories.Single(c => c.Name == "Services");
        Assert.False(services.CanResell);
        Assert.False(services.HasWeight);
    }

    [Fact]
    public void Unknown_feature_token_fails_loudly()
    {
        var doc = MarkdownDocument.Parse("""
            ## Melee weapons

            | Weapon | Grip | STR | Range | Damage | Durability | Cost Copper | Cost | Supply | Features |
            | --- | --- | ---: | ---: | --- | ---: | ---: | ---: | --- | --- |
            | Club | 1H | - | 2 | D8 | 9 | 10 | 1 silver | - | Bludgeoning, sparkly |
            """);

        var ex = Assert.Throws<InvalidDataException>(() => EquipmentImporter.Import(doc, _db));
        Assert.Contains("sparkly", ex.Message);
    }
}
