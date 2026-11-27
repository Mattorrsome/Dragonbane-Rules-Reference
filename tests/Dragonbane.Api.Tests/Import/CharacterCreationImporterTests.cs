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
        // Age adjustments link to attributes (skills import); professions link to skills, abilities and schools.
        SkillsImporter.Import(MarkdownDocument.Parse(Read("Dragonbane_Skills_Table.md")), _db);
        var equipment = MarkdownDocument.Parse(Read("Dragonbane_Equipment_Tables.md"));
        CurrencyImporter.Import(equipment, _db);
        EquipmentImporter.Import(equipment, _db);
        HeroicAbilitiesImporter.Import(MarkdownDocument.Parse(Read("Dragonbane_Heroic_Abilities_Table.md")), _db);
        SpellsImporter.Import(MarkdownDocument.Parse(Read("Dragonbane_Spell_Tables.md")), _db);
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

    [Fact]
    public void Imports_ten_professions_in_d10_order_with_key_attribute_and_skills()
    {
        Import();
        var professions = _db.Professions.Include(p => p.KeyAttribute).Include(p => p.Skills).ThenInclude(s => s.Skill)
            .OrderBy(p => p.Roll).ToList();
        Assert.Equal(["Artisan", "Bard", "Fighter", "Hunter", "Knight", "Mage", "Mariner", "Merchant", "Scholar", "Thief"],
            professions.Select(p => p.Name));
        Assert.Equal(Enumerable.Range(1, 10), professions.Select(p => p.Roll));
        var artisan = professions[0];
        Assert.Equal("STR", artisan.KeyAttribute.Code);
        Assert.Equal(8, artisan.Skills.Count);
        Assert.Contains("Sleight of Hand", artisan.Skills.Select(s => s.Skill.Name));
        Assert.Empty(professions.Single(p => p.Name == "Mage").Skills);
    }

    [Fact]
    public void Imports_profession_starting_heroic_abilities()
    {
        Import();
        string[] Abilities(string profession) => _db.ProfessionHeroicAbilities
            .Where(a => a.ProfessionId == _db.Professions.Single(p => p.Name == profession).Id)
            .OrderBy(a => a.Id).Select(a => a.HeroicAbility.Name).ToArray();
        Assert.Equal(["Master Blacksmith", "Master Carpenter", "Master Tanner"], Abilities("Artisan"));
        Assert.Empty(Abilities("Mage"));
        Assert.Equal(["Guardian"], Abilities("Knight"));
    }

    [Fact]
    public void Imports_six_nicknames_per_profession()
    {
        Import();
        Assert.All(_db.Professions.Include(p => p.Nicknames).ToList(), p => Assert.Equal(6, p.Nicknames.Count));
        var thief = _db.ProfessionNicknames.Where(n => n.ProfessionId == _db.Professions.Single(p => p.Name == "Thief").Id);
        Assert.Equal("Nightstabber", thief.Single(n => n.Roll == 6).Name);
        Assert.Equal("Stonehammer", _db.Professions.Include(p => p.Nicknames).Single(p => p.Name == "Artisan").Nicknames.Single(n => n.Roll == 1).Name);
    }

    [Fact]
    public void Harmonism_needs_a_bard_with_performance_12_and_has_no_skill_of_its_own()
    {
        Import();
        var school = _db.MagicSchools.Include(s => s.RequiredProfession).Include(s => s.RequiredSkill)
            .Include(s => s.StartingSkills).Single(s => s.Name == "Harmonism");
        Assert.Equal("Bard", school.RequiredProfession!.Name);
        Assert.Equal(("Performance", 12), (school.RequiredSkill!.Name, school.RequiredSkillLevel));
        Assert.Null(school.SkillId);
        Assert.Empty(school.StartingSkills);
        Assert.True(school.ChoosableAtCreation);
    }

    [Fact]
    public void Enchanting_needs_crafting_12_and_has_its_skill_and_eight_starting_skills()
    {
        Import();
        var school = _db.MagicSchools.Include(s => s.Skill).Include(s => s.RequiredSkill).Include(s => s.RequiredProfession)
            .Include(s => s.StartingSkills).Single(s => s.Name == "Enchanting");
        Assert.Equal(("Crafting", 12), (school.RequiredSkill!.Name, school.RequiredSkillLevel));
        Assert.Equal("Enchanting", school.Skill!.Name);
        Assert.Equal(8, school.StartingSkills.Count);
        Assert.Equal("Mage", school.RequiredProfession!.Name);
    }

    [Fact]
    public void Eleven_schools_are_choosable_at_creation_and_dracomancy_is_not()
    {
        Import();
        Assert.Equal(11, _db.MagicSchools.Count(s => s.ChoosableAtCreation));
        Assert.False(_db.MagicSchools.Single(s => s.Name == "Dracomancy").ChoosableAtCreation);
        var general = _db.MagicSchools.Include(s => s.StartingSkills).Single(s => s.Name == "General Magic");
        Assert.Equal((null, null, null, false), (general.SkillId, general.RequiredProfessionId, general.RequiredSkillId, general.ChoosableAtCreation));
        Assert.Empty(general.StartingSkills);
    }

    [Fact]
    public void Unknown_skill_in_a_profession_list_throws()
    {
        var bad = Read(File_).Replace("Axes, Brawling, Crafting,", "Axes, Brawling, Basketweaving,");
        Assert.Throws<InvalidDataException>(() => Import(bad));
    }

    [Fact]
    public void Missing_second_nickname_table_throws()
    {
        var bad = Read(File_).Replace("#### Nicknames (Mage to Thief)", "#### Other");
        Assert.Throws<InvalidDataException>(() => Import(bad));
    }

    [Fact]
    public void Non_numeric_roll_throws_invalid_data()
    {
        var bad = Read(File_).Replace("| 20 | Weathered face |", "| x | Weathered face |");
        Assert.Throws<InvalidDataException>(() => Import(bad));
    }

    [Fact]
    public void Every_profession_has_three_gear_packages_covering_one_to_six()
    {
        Import();
        var professions = _db.Professions.Include(p => p.GearPackages).ToList();
        Assert.Equal(10, professions.Count);
        foreach (var p in professions)
            Assert.Equal([(1, 2), (3, 4), (5, 6)], p.GearPackages.OrderBy(g => g.RollFrom).Select(g => (g.RollFrom, g.RollTo)));
    }

    GearPackage Package(string profession, int from) => _db.GearPackages
        .Include(g => g.Entries).ThenInclude(e => e.Options).ThenInclude(o => o.EquipmentItem)
        .Single(g => g.ProfessionId == _db.Professions.Single(p => p.Name == profession).Id && g.RollFrom == from);

    [Fact]
    public void Fighter_one_to_two_has_a_battleaxe_or_morningstar_choice()
    {
        Import();
        var choice = Package("Fighter", 1).Entries.Single(e => e.Options.Count > 1);
        Assert.Equal(["Battleaxe", "Morningstar"], choice.Options.Select(o => o.EquipmentItem!.Name));
    }

    [Fact]
    public void Mariner_silver_is_a_d10_and_rations_are_dice()
    {
        Import();
        var entries = Package("Mariner", 1).Entries;
        var silver = entries.Single(e => e.Kind == GearEntryKind.Silver);
        Assert.Equal((1, 10), (silver.DiceCount, silver.DiceSides));
        Assert.Empty(silver.Options);
        var rations = entries.Single(e => e.Options.Any(o => o.EquipmentItem!.Name == "Field ration"));
        Assert.Equal((1, 8), (rations.DiceCount, rations.DiceSides));
    }

    [Fact]
    public void Knight_five_to_six_has_a_combat_trained_horse()
    {
        Import();
        Assert.Contains(Package("Knight", 5).Entries, e => e.Options.Any(o => o.EquipmentItem!.Name == "Combat-trained horse"));
    }

    [Fact]
    public void Thief_five_to_six_has_two_daggers()
    {
        Import();
        var daggers = Package("Thief", 5).Entries.Single(e => e.Options.Any(o => o.EquipmentItem!.Name == "Dagger"));
        Assert.Equal(2, daggers.Quantity);
    }

    [Fact]
    public void Alchemy_extras_are_unlinked_laboratory_and_d6_herbs()
    {
        Import();
        var extras = _db.GearPackages.Include(g => g.Entries).ThenInclude(e => e.Options)
            .Single(g => g.MagicSchoolId == _db.MagicSchools.Single(s => s.Name == "Alchemy").Id);
        Assert.Equal((0, 0), (extras.RollFrom, extras.RollTo));
        Assert.Equal(["Small field laboratory", "General herbs"], extras.Entries.Select(e => e.Options.Single().UnlinkedName));
        Assert.Equal(6, extras.Entries[1].DiceSides);
    }

    [Fact]
    public void Enchanting_extras_are_a_choice_of_three_tool_sets()
    {
        Import();
        var extras = _db.GearPackages.Include(g => g.Entries).ThenInclude(e => e.Options).ThenInclude(o => o.EquipmentItem)
            .Single(g => g.MagicSchoolId == _db.MagicSchools.Single(s => s.Name == "Enchanting").Id);
        Assert.Equal(["Blacksmithing tools", "Carpentry tools", "Tanning tools"], extras.Entries.Single().Options.Select(o => o.EquipmentItem!.Name));
    }

    [Fact]
    public void Unknown_gear_seed_name_throws()
    {
        var bad = new Dictionary<string, SeedPackage[]>
        {
            ["Thief"] = [new(1, 2, [new SeedGear(GearEntryKind.Item, ["vorpal blade"])])],
        };
        var ex = Assert.Throws<InvalidDataException>(() => CharacterCreationImporter.Import(MarkdownDocument.Parse(Read(File_)), _db, bad));
        Assert.Contains("vorpal blade", ex.Message);
    }

    [Fact]
    public void Gear_packages_with_a_gap_throw()
    {
        var fighter = GearPackageSeed.Packages["Fighter"];
        var gapped = new Dictionary<string, SeedPackage[]>(GearPackageSeed.Packages) { ["Fighter"] = [fighter[0], fighter[2]] };
        var ex = Assert.Throws<InvalidDataException>(() => CharacterCreationImporter.Import(MarkdownDocument.Parse(Read(File_)), _db, gapped));
        Assert.Contains("Fighter", ex.Message);
    }

    [Fact]
    public void Gear_packages_that_overlap_throw()
    {
        var fighter = GearPackageSeed.Packages["Fighter"];
        var overlapping = new Dictionary<string, SeedPackage[]>(GearPackageSeed.Packages) { ["Fighter"] = [.. fighter, fighter[2] with { From = 6 }] };
        var ex = Assert.Throws<InvalidDataException>(() => CharacterCreationImporter.Import(MarkdownDocument.Parse(Read(File_)), _db, overlapping));
        Assert.Contains("Fighter", ex.Message);
    }
}
