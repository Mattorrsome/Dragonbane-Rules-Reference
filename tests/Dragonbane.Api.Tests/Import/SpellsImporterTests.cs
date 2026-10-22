using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;
using Dragonbane.Api.Import;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Dragonbane.Api.Tests.Import;

public sealed class SpellsImporterTests : IDisposable
{
    readonly SqliteConnection _connection = new("Data Source=:memory:");
    readonly DragonbaneDbContext _db;

    public SpellsImporterTests()
    {
        _connection.Open();
        _db = new DragonbaneDbContext(new DbContextOptionsBuilder<DragonbaneDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();

        var equipment = Read("Dragonbane_Equipment_Tables.md");
        CurrencyImporter.Import(equipment, _db);
        EquipmentImporter.Import(equipment, _db);
        SpellsImporter.Import(Read("Dragonbane_Spell_Tables.md"), _db);
        _db.ChangeTracker.Clear();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    static IReadOnlyList<MarkdownSection> Read(string file) =>
        MarkdownDocument.Parse(File.ReadAllText(Path.Combine(TestPaths.SourceMaterial, file)));

    List<string> RequirementsOf(string name) =>
        _db.Spells.Where(s => s.Name == name).SelectMany(s => s.Requirements).Select(r => r.Name).ToList();

    [Fact]
    public void Imports_counts()
    {
        Assert.Equal(13, _db.MagicSchools.Count());
        Assert.Equal(38, _db.Spells.Count(s => s.Kind == SpellKind.Trick));
        Assert.Equal(245, _db.Spells.Count(s => s.Kind == SpellKind.Spell));
        Assert.Equal(33, _db.Spells.Count(s => s.Kind == SpellKind.Recipe));
    }

    [Fact]
    public void Tricks_follow_user_rule()
    {
        var tricks = _db.Spells.Include(s => s.Requirements).Where(s => s.Kind == SpellKind.Trick).ToList();

        Assert.All(tricks, t =>
        {
            Assert.Equal("Action", t.CastingTime);
            Assert.Equal(0, t.Rank);
            Assert.Equal("Gesture", Assert.Single(t.Requirements).Name);
        });
        Assert.DoesNotContain(_db.Set<RankedSpell>(), s => s.Kind == SpellKind.Trick);
    }

    [Fact]
    public void Splits_requirements()
    {
        Assert.Equal(["Gesture", "Word"], RequirementsOf("DISPEL").Order());
        Assert.Equal(["Alchemical laboratory", "Ingredients: general herbs, wolf blood"], RequirementsOf("FOCUS TONIC").Order());
    }

    [Fact]
    public void Parses_recipe_cost()
    {
        var recipes = _db.Recipes.Include(r => r.Supply).ToList();

        var herbal = recipes.Single(r => r.Name == "HERBAL CONCOCTION");
        Assert.Equal((100, null, "Uncommon"), (herbal.CostPerDoseCopper, herbal.CostPerDoseUnit, herbal.Supply?.Name));
        var sleeping = recipes.Single(r => r.Name == "SLEEPING POISON");
        Assert.Equal((60, " × potency", "Uncommon"), (sleeping.CostPerDoseCopper, sleeping.CostPerDoseUnit, sleeping.Supply?.Name));
        Assert.Contains(recipes, r => r.CostPerDoseCopper == null && r.SupplyId == null);
        Assert.Contains("Cost per dose:", herbal.Description);
    }

    [Fact]
    public void Keeps_school_notes() =>
        Assert.StartsWith("All recipes require an alchemical laboratory", _db.MagicSchools.Single(s => s.Name == "Alchemy").Note);

    [Fact]
    public void Converts_br() =>
        Assert.Contains("\n", _db.Spells.Single(s => s.Name == "REJUVENATION").Description);
}
