using System.Text.RegularExpressions;
using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;

namespace Dragonbane.Api.Import;

/// <summary>Imports Dragonbane_Character_Creation.md, one method per table group.</summary>
public static partial class CharacterCreationImporter
{
    public static void Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db, IReadOnlyDictionary<string, SeedPackage[]>? gear = null)
    {
        ImportKin(doc, db);
        ImportAges(doc, db);
        ImportRollTables(doc, db);
        ImportProfessions(doc, db);
        ImportNicknames(doc, db);
        ImportMagicSchools(doc, db);
        ImportGearPackages(db, gear ?? GearPackageSeed.Packages);
    }

    static void ImportKin(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)
    {
        var names = Section(doc, "Names").Rows;
        foreach (var row in Section(doc, "Kin").Rows)
        {
            var (from, to) = Range(row["D12"]);
            var kin = new Kin { Name = row["Kin"], RollFrom = from, RollTo = to, Movement = RollValue(row["Base Movement"]) };
            var matches = AbilityPattern().Matches(row["Innate ability"]);
            if (matches.Count == 0) throw new InvalidDataException($"Kin '{kin.Name}' has no parsable ability.");
            foreach (var m in matches.Cast<Match>())
                kin.Abilities.Add(new KinAbility
                {
                    Name = m.Groups["name"].Value,
                    Wp = m.Groups["wp"].Success ? int.Parse(m.Groups["wp"].Value) : null,
                    Effect = m.Groups["effect"].Value.Trim(),
                });
            // One column per kin; a kin without a column is malformed data.
            foreach (var name in names)
                kin.Names.Add(new KinName
                {
                    Roll = RollValue(name["D6"]),
                    Name = name.GetValueOrDefault(kin.Name) ?? throw new InvalidDataException($"No names column for kin '{kin.Name}'."),
                });
            db.Kin.Add(kin);
        }
        db.SaveChanges();
    }

    static void ImportAges(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)
    {
        var attributes = db.Attributes.ToDictionary(a => a.Code);
        foreach (var row in Section(doc, "Age").Rows)
        {
            var (from, to) = Range(row["D6"]);
            var free = FreePattern().Match(row["Trained skills"]);
            if (!free.Success) throw new InvalidDataException($"Cannot parse trained skills '{row["Trained skills"]}'.");
            var age = new Age { Name = row["Age"], RollFrom = from, RollTo = to, FreeSkills = int.Parse(free.Groups[1].Value) };
            var cell = row["Attribute adjustments"];
            if (cell != "None")
                foreach (var part in cell.Split(',', StringSplitOptions.TrimEntries))
                {
                    var m = AdjustmentPattern().Match(part);
                    if (!m.Success || !attributes.TryGetValue(m.Groups[1].Value, out var attribute))
                        throw new InvalidDataException($"Cannot parse age adjustment '{part}'.");
                    age.Adjustments.Add(new AgeAdjustment { Attribute = attribute, Delta = int.Parse(m.Groups[2].Value) });
                }
            db.Ages.Add(age);
        }
        db.SaveChanges();
    }

    static void ImportRollTables(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)
    {
        foreach (var row in Section(doc, "Memento").Rows)
            db.Mementos.Add(new Memento { Roll = RollValue(row["D20"]), Text = row["Memento"] });
        foreach (var row in Section(doc, "Weakness").Rows)
        {
            var m = WeaknessPattern().Match(row["Weakness"]);
            if (!m.Success) throw new InvalidDataException($"Cannot parse weakness '{row["Weakness"]}'.");
            db.Weaknesses.Add(new Weakness { Roll = RollValue(row["D20"]), Name = m.Groups[1].Value, Text = m.Groups[2].Value });
        }
        foreach (var row in Section(doc, "Appearance").Rows)
            db.Appearances.Add(new Appearance { Roll = RollValue(row["D20"]), Text = row["Appearance"] });
        db.SaveChanges();
    }

    const string MageProfession = "Mage";

    static void ImportProfessions(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)
    {
        var attributes = db.Attributes.ToDictionary(a => a.Code);
        var skills = db.Skills.ToDictionary(s => s.Name, StringComparer.OrdinalIgnoreCase);
        var abilities = db.HeroicAbilities.ToDictionary(a => a.Name, StringComparer.OrdinalIgnoreCase);
        foreach (var row in Section(doc, "Professions").Rows)
        {
            var name = row["Profession"];
            var profession = new Profession
            {
                Name = name,
                Roll = RollValue(row["D10"]),
                KeyAttribute = attributes.GetValueOrDefault(row["Key"]) ?? throw new InvalidDataException($"Unknown attribute '{row["Key"]}' for profession '{name}'."),
            };
            // The mage's skills come from the school and it has no starting heroic ability.
            if (name != MageProfession)
            {
                foreach (var skill in SkillList(row["Profession skills"], skills))
                    profession.Skills.Add(new ProfessionSkill { Skill = skill });
                foreach (var ability in row["Starting benefit"].Replace("**", "").Split([",", " or "], StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
                    profession.HeroicAbilities.Add(new ProfessionHeroicAbility
                    {
                        HeroicAbility = abilities.GetValueOrDefault(ability) ?? throw new InvalidDataException($"Unknown heroic ability '{ability}' for profession '{name}'."),
                    });
            }
            db.Professions.Add(profession);
        }
        db.SaveChanges();
    }

    static void ImportNicknames(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)
    {
        var professions = db.Professions.ToDictionary(p => p.Name);
        var tables = doc.Where(s => s.Heading.StartsWith("Nicknames", StringComparison.Ordinal) && s.Rows.Count > 0).ToList();
        if (tables.Count < 2) throw new InvalidDataException("Character creation markdown needs two headed 'Nicknames' tables.");
        foreach (var table in tables)
            foreach (var row in table.Rows)
                foreach (var column in table.Columns.Skip(1))
                    (professions.GetValueOrDefault(column) ?? throw new InvalidDataException($"Nicknames column '{column}' is not a profession."))
                        .Nicknames.Add(new ProfessionNickname { Roll = RollValue(row[table.Columns[0]]), Name = row[column] });
        db.SaveChanges();
    }

    static void ImportMagicSchools(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)
    {
        var professions = db.Professions.ToDictionary(p => p.Name);
        var skills = db.Skills.ToDictionary(s => s.Name, StringComparer.OrdinalIgnoreCase);
        var schools = db.MagicSchools.ToDictionary(s => s.Name);
        foreach (var row in Section(doc, "Mage Starting").Rows)
        {
            var name = row["School"];
            var school = schools.GetValueOrDefault(name) ?? throw new InvalidDataException($"Unknown magic school '{name}'.");
            school.RequiredProfession = professions.GetValueOrDefault(row["Profession"]) ?? throw new InvalidDataException($"Unknown profession '{row["Profession"]}' for school '{name}'.");
            school.ChoosableAtCreation = row["At creation"] switch
            {
                "Yes" => true,
                "No" => false,
                var other => throw new InvalidDataException($"Cannot parse 'At creation' value '{other}' for school '{name}'."),
            };
            // Harmonism is cast with Performance and has no skill of its own.
            school.Skill = name == "Harmonism" ? null : skills.GetValueOrDefault(name) ?? throw new InvalidDataException($"No skill for school '{name}'.");
            foreach (var skill in SkillList(row["Starting skills"], skills))
                school.StartingSkills.Add(new MagicSchoolStartingSkill { Skill = skill });
            if (row["Requires"] != "-")
            {
                var m = RequirePattern().Match(row["Requires"]);
                if (!m.Success) throw new InvalidDataException($"Cannot parse requirement '{row["Requires"]}' for school '{name}'.");
                school.RequiredSkill = skills.GetValueOrDefault(m.Groups[1].Value) ?? throw new InvalidDataException($"Unknown skill '{m.Groups[1].Value}' for school '{name}'.");
                school.RequiredSkillLevel = int.Parse(m.Groups[2].Value);
            }
        }
        db.SaveChanges();
    }

    static void ImportGearPackages(DragonbaneDbContext db, IReadOnlyDictionary<string, SeedPackage[]> packagesByOwner)
    {
        var equipment = db.EquipmentItems.ToDictionary(e => e.Name, StringComparer.OrdinalIgnoreCase);
        var professions = db.Professions.ToDictionary(p => p.Name);
        var schools = db.MagicSchools.ToDictionary(s => s.Name);
        foreach (var (owner, seeds) in packagesByOwner)
        {
            var packages = professions.GetValueOrDefault(owner)?.GearPackages
                ?? schools.GetValueOrDefault(owner)?.ExtraGearPackages
                ?? throw new InvalidDataException($"Gear seed key '{owner}' is neither a profession nor a magic school.");
            foreach (var seed in seeds)
            {
                var package = new GearPackage { RollFrom = seed.From, RollTo = seed.To };
                foreach (var gear in seed.Entries)
                {
                    var entry = new GearPackageEntry { Kind = gear.Kind, Quantity = gear.Quantity, DiceCount = gear.DiceCount, DiceSides = gear.DiceSides };
                    foreach (var name in gear.Items)
                    {
                        var lookup = GearPackageSeed.Aliases.GetValueOrDefault(name.ToLowerInvariant(), name);
                        entry.Options.Add(equipment.TryGetValue(lookup, out var item) ? new GearPackageOption { EquipmentItem = item }
                            : GearPackageSeed.Unlinked.Contains(name) ? new GearPackageOption { UnlinkedName = name }
                            : throw new InvalidDataException($"Gear seed item '{name}' ({owner}) is not in Equipment, an alias or the unlinked list."));
                    }
                    package.Entries.Add(entry);
                }
                packages.Add(package);
            }
        }
        db.SaveChanges();
    }

    /// <summary>Comma-separated skill names ("-" for none), each of which must exist in the Skills table.</summary>
    static IEnumerable<Skill> SkillList(string cell, Dictionary<string, Skill> skills) =>
        cell == "-" ? [] : cell.Split(',', StringSplitOptions.TrimEntries).Select(n =>
            skills.GetValueOrDefault(n) ?? throw new InvalidDataException($"Unknown skill '{n}'."));

    static MarkdownSection Section(IReadOnlyList<MarkdownSection> doc, string heading) =>
        doc.SingleOrDefault(s => s.Heading.StartsWith(heading, StringComparison.Ordinal) && s.Rows.Count > 0)
        ?? throw new InvalidDataException($"Character creation markdown has no '{heading}' table.");

static int RollValue(string cell) =>        int.TryParse(cell, out var value) ? value : throw new InvalidDataException($"Cannot parse number '{cell}'.");
    /// <summary>"1-4" gives (1, 4); "10" gives (10, 10).</summary>
    static (int From, int To) Range(string cell)
    {
        var parts = cell.Split('-');
        return parts.Length is 1 or 2 && int.TryParse(parts[0], out var from) && int.TryParse(parts[^1], out var to)
            ? (from, to)
            : throw new InvalidDataException($"Cannot parse roll range '{cell}'.");
    }

    // "**Name (3 WP):** effect" or "**Name (no WP):** effect"; the effect runs to the next ability.
    [GeneratedRegex(@"\*\*(?<name>[^*(]+?) \((?:(?<wp>\d+) WP|no WP)\):\*\*(?<effect>.*?)(?=\*\*[^*(]+? \((?:\d+ WP|no WP)\):\*\*|$)", RegexOptions.Singleline)]
    private static partial Regex AbilityPattern();

    [GeneratedRegex(@"^(.+) (\d+)$")]
    private static partial Regex RequirePattern();

    [GeneratedRegex(@"^6 profession \+ (\d+) free$")]
    private static partial Regex FreePattern();

    [GeneratedRegex(@"^([A-Z]{3}) ([+-]\d+)$")]
    private static partial Regex AdjustmentPattern();

    [GeneratedRegex(@"^\*\*(.+?)\.\*\* (.+)$")]
    private static partial Regex WeaknessPattern();
}
