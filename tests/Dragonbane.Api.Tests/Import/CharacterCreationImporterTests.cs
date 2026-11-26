using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;
using Dragonbane.Api.Import;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Dragonbane.Api.Tests.Import;

public sealed class CharacterCreationImporterTests : IDisposable
{
    const string File_ = "Dragonbane_Character_Creation.md";
    readonly SqliteConnection _connection = new("Data Source=:memory:");
    readonly DragonbaneDbContext _db;

    public CharacterCreationImporterTests()
    {
        _connection.Open();
        _db = new DragonbaneDbContext(new DbContextOptionsBuilder<DragonbaneDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();
        // Age adjustments link to attributes, which the skills import creates (all six).
        SkillsImporter.Import(MarkdownDocument.Parse(Read("Dragonbane_Skills_Table.md")), _db);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    static string Read(string file) => System.IO.File.ReadAllText(Path.Combine(TestPaths.SourceMaterial, file));

    void Import(string? source = null)
    {
        CharacterCreationImporter.Import(MarkdownDocument.Parse(source ?? Read(File_)), _db);
        _db.ChangeTracker.Clear();
    }

    [Fact]
    public void Imports_six_kin_with_rolls_and_movement()
    {
        Import();
        var kin = _db.Kin.OrderBy(k => k.Id).ToList();
        Assert.Equal(6, kin.Count);
        Assert.Equal(("Human", 1, 4, 10), (kin[0].Name, kin[0].RollFrom, kin[0].RollTo, kin[0].Movement));
        Assert.Equal(("Wolfkin", 12, 12, 12), (kin[5].Name, kin[5].RollFrom, kin[5].RollTo, kin[5].Movement));
    }

    [Fact]
    public void Imports_kin_abilities_with_wp_cost()
    {
        Import();
        var abilities = _db.KinAbilities.Where(a => a.KinId == _db.Kin.Single(k => k.Name == "Mallard").Id).OrderBy(a => a.Id).ToList();
        Assert.Equal(["Ill-Tempered", "Webbed Feet"], abilities.Select(a => a.Name));
        Assert.Equal([3, (int?)null], abilities.Select(a => a.Wp));
        Assert.Null(_db.KinAbilities.Single(a => a.Name == "Inner Peace").Wp);
    }

    [Fact]
    public void Imports_six_names_per_kin()
    {
        Import();
        Assert.All(_db.Kin.Include(k => k.Names).ToList(), k => Assert.Equal(6, k.Names.Count));
        var dwarf = _db.KinNames.Where(n => n.KinId == _db.Kin.Single(k => k.Name == "Dwarf").Id && n.Roll == 2);
        Assert.Equal("Halwyld", dwarf.Single().Name);
    }

    [Fact]
    public void Imports_three_ages_with_adjustments()
    {
        Import();
        Assert.Equal(3, _db.Ages.Count());
        var old = _db.Ages.Include(a => a.Adjustments).ThenInclude(j => j.Attribute).Single(a => a.Name == "Old");
        Assert.Equal(6, old.FreeSkills);
        Assert.Equal(["STR-2", "AGL-2", "CON-2", "INT+1", "WIL+1"],
            old.Adjustments.OrderBy(j => j.Id).Select(j => $"{j.Attribute.Code}{j.Delta:+0;-0}"));
        Assert.Empty(_db.Ages.Include(a => a.Adjustments).Single(a => a.Name == "Adult").Adjustments);
    }

    [Fact]
    public void Imports_d20_tables()
    {
        Import();
        Assert.Equal(20, _db.Mementos.Count());
        Assert.Equal(20, _db.Weaknesses.Count());
        Assert.Equal(20, _db.Appearances.Count());
        var weakness = _db.Weaknesses.Single(w => w.Roll == 5);
        Assert.Equal("Fainthearted", weakness.Name);
        Assert.Equal("I always stay at the back of the group.", weakness.Text);
    }

    [Fact]
    public void Malformed_kin_ability_throws()
    {
        var bad = Read(File_).Replace("**Hard to Catch (3 WP):**", "**Hard to Catch 3 WP:**");
        Assert.Throws<InvalidDataException>(() => Import(bad));
    }
}
