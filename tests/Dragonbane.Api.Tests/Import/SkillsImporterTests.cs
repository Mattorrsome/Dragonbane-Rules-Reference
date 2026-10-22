using Dragonbane.Api.Data;
using Dragonbane.Api.Import;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Dragonbane.Api.Tests.Import;

public sealed class SkillsImporterTests : IDisposable
{
    readonly SqliteConnection _connection = new("Data Source=:memory:");
    readonly DragonbaneDbContext _db;

    public SkillsImporterTests()
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

    static IReadOnlyList<MarkdownSection> Read(string file) =>
        MarkdownDocument.Parse(File.ReadAllText(Path.Combine(TestPaths.SourceMaterial, file)));

    [Fact]
    public void Imports_skills()
    {
        SkillsImporter.Import(Read("Dragonbane_Skills_Table.md"), _db);
        _db.ChangeTracker.Clear();

        Assert.Equal(42, _db.Skills.Count());
        var types = _db.SkillTypes.OrderBy(t => t.Id)
            .Select(t => new { t.Name, Count = _db.Skills.Count(s => s.SkillTypeId == t.Id) }).ToList();
        Assert.Equal(["Core", "Weapon", "Secondary"], types.Select(t => t.Name));
        Assert.Equal([20, 10, 12], types.Select(t => t.Count));
        var harmonism = _db.Skills.Include(s => s.Attribute).Single(s => s.Name == "Harmonism");
        Assert.Equal("CHA", harmonism.Attribute.Code);
        Assert.Equal("uses PERFORMANCE", harmonism.AttributeNote);
    }

    [Fact]
    public void Imports_heroic_abilities()
    {
        HeroicAbilitiesImporter.Import(Read("Dragonbane_Heroic_Abilities_Table.md"), _db);
        _db.ChangeTracker.Clear();

        Assert.Equal(44, _db.HeroicAbilities.Count());
        Assert.Equal("Varies", _db.HeroicAbilities.Single(h => h.Name == "Catlike").Wp);
    }
}
