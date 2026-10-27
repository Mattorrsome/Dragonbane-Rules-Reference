using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;
using Dragonbane.Api.Import;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Dragonbane.Api.Tests.Import;

public sealed class NpcImporterTests : IDisposable
{
    readonly SqliteConnection _connection = new("Data Source=:memory:");
    readonly DragonbaneDbContext _db;

    public NpcImporterTests()
    {
        _connection.Open();
        _db = new DragonbaneDbContext(new DbContextOptionsBuilder<DragonbaneDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();
        // NPCs link to skills, heroic abilities and equipment, so those import first.
        SkillsImporter.Import(Read("Dragonbane_Skills_Table.md"), _db);
        var equipment = Read("Dragonbane_Equipment_Tables.md");
        CurrencyImporter.Import(equipment, _db);
        EquipmentImporter.Import(equipment, _db);
        HeroicAbilitiesImporter.Import(Read("Dragonbane_Heroic_Abilities_Table.md"), _db);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    static string Source => File.ReadAllText(Path.Combine(TestPaths.SourceMaterial, "Dragonbane_NPC_Table.md"));

    static IReadOnlyList<MarkdownSection> Read(string file) =>
        MarkdownDocument.Parse(File.ReadAllText(Path.Combine(TestPaths.SourceMaterial, file)));

    List<Npc> ImportReal()
    {
        NpcImporter.Import(MarkdownDocument.Parse(Source), _db);
        _db.ChangeTracker.Clear();
        return _db.Npcs
            .Include(n => n.DamageBonusAttribute)
            .Include(n => n.Skills).ThenInclude(s => s.Skill)
            .Include(n => n.HeroicAbilities).ThenInclude(a => a.HeroicAbility)
            .Include(n => n.Gear).ThenInclude(g => g.EquipmentItem)
            .OrderBy(n => n.Id).AsSplitQuery().ToList();
    }

    static string Skills(Npc npc) =>
        string.Join(", ", npc.Skills.OrderBy(s => s.Id).Select(s => $"{s.Skill?.Name ?? s.UnlinkedName} {s.Level}"));
    static string Abilities(Npc npc) =>
        string.Join(", ", npc.HeroicAbilities.OrderBy(a => a.Id).Select(a => $"{a.HeroicAbility.Name} x{a.Count}"));
    static string[] Gear(Npc npc) => npc.Gear.OrderBy(g => g.Id).Select(g => g.EquipmentItem.Name).ToArray();

    [Fact]
    public void Imports_eleven_npcs_in_source_order()
    {
        var npcs = ImportReal();

        Assert.Equal(11, npcs.Count);
        Assert.Equal(["Guard", "Cultist", "Thief", "Villager"], npcs.Take(4).Select(n => n.Name));
    }

    [Fact]
    public void Bandit_chief()
    {
        var chief = ImportReal().Single(n => n.Name == "Bandit chief");

        Assert.True(chief.IsBoss);
        Assert.Equal((30, 16), (chief.Hp, chief.Wp));
        Assert.Equal(("STR", "D6"), (chief.DamageBonusAttribute!.Code, chief.DamageBonusDice));
        Assert.Equal("Awareness 12, Brawling 15, Hammers 15", Skills(chief));
        Assert.Equal("Berserker x1, Robust x6, Veteran x1", Abilities(chief));
        Assert.Equal(["Heavy warhammer", "Chainmail", "Open helmet"], Gear(chief));
    }

    [Fact]
    public void Aliases_and_case_resolve()
    {
        var npcs = ImportReal().ToDictionary(n => n.Name);

        Assert.Contains("Leather", Gear(npcs["Hunter"]));
        Assert.Equal(["Small wooden club"], Gear(npcs["Villager"]));
        Assert.Equal(["Book"], Gear(npcs["Scholar"]));
        Assert.Equal(["Short sword", "Short bow"], Gear(npcs["Bandit"]));
        Assert.False(npcs["Guard"].IsBoss);
    }

    [Fact]
    public void Magic_school_is_unlinked()
    {
        var archmage = ImportReal().Single(n => n.Name == "Archmage");

        var school = archmage.Skills.Single(s => s.SkillId is null);
        Assert.Equal(("Magic school", 15), (school.UnlinkedName, school.Level));
        Assert.Equal("Focused x6, Master Spellcaster x1, Robust x4", Abilities(archmage));
    }

    [Fact]
    public void Dashes_are_null()
    {
        var npcs = ImportReal().ToDictionary(n => n.Name);

        Assert.Null(npcs["Guard"].Wp);
        Assert.Null(npcs["Villager"].DamageBonusAttribute);
        Assert.Null(npcs["Villager"].DamageBonusDice);
        Assert.Empty(npcs["Guard"].HeroicAbilities);
    }

    [Fact]
    public void Unknown_name_fails_loudly()
    {
        var doc = MarkdownDocument.Parse(Source.Replace("Awareness 10, Swords 12 | - | STR +D4 | 12", "Juggling 12 | - | STR +D4 | 12"));

        var ex = Assert.Throws<InvalidDataException>(() => NpcImporter.Import(doc, _db));
        Assert.Contains("Juggling", ex.Message);
        Assert.Contains("Guard", ex.Message);
    }

    [Fact]
    public void Npc_skill_needs_exactly_one_name()
    {
        var npc = new Npc { Name = "Test", Hp = 1 };
        npc.Skills.Add(new NpcSkill { Level = 5 });
        _db.Add(npc);

        Assert.Throws<DbUpdateException>(() => _db.SaveChanges());
    }
}
