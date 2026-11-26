using System.Text.RegularExpressions;
using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;

namespace Dragonbane.Api.Import;

/// <summary>Imports Dragonbane_Character_Creation.md, one method per table group.</summary>
public static partial class CharacterCreationImporter
{
    public static void Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)
    {
        ImportKin(doc, db);
        ImportAges(doc, db);
        ImportRollTables(doc, db);
    }

    static void ImportKin(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)
    {
        var names = Section(doc, "Names").Rows;
        foreach (var row in Section(doc, "Kin").Rows)
        {
            var (from, to) = Range(row["D12"]);
            var kin = new Kin { Name = row["Kin"], RollFrom = from, RollTo = to, Movement = int.Parse(row["Base Movement"]) };
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
                    Roll = int.Parse(name["D6"]),
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
            db.Mementos.Add(new Memento { Roll = int.Parse(row["D20"]), Text = row["Memento"] });
        foreach (var row in Section(doc, "Weakness").Rows)
        {
            var m = WeaknessPattern().Match(row["Weakness"]);
            if (!m.Success) throw new InvalidDataException($"Cannot parse weakness '{row["Weakness"]}'.");
            db.Weaknesses.Add(new Weakness { Roll = int.Parse(row["D20"]), Name = m.Groups[1].Value, Text = m.Groups[2].Value });
        }
        foreach (var row in Section(doc, "Appearance").Rows)
            db.Appearances.Add(new Appearance { Roll = int.Parse(row["D20"]), Text = row["Appearance"] });
        db.SaveChanges();
    }

    static MarkdownSection Section(IReadOnlyList<MarkdownSection> doc, string heading) =>
        doc.SingleOrDefault(s => s.Heading.StartsWith(heading, StringComparison.Ordinal) && s.Rows.Count > 0)
        ?? throw new InvalidDataException($"Character creation markdown has no '{heading}' table.");

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

    [GeneratedRegex(@"^6 profession \+ (\d+) free$")]
    private static partial Regex FreePattern();

    [GeneratedRegex(@"^([A-Z]{3}) ([+-]\d+)$")]
    private static partial Regex AdjustmentPattern();

    [GeneratedRegex(@"^\*\*(.+?)\.\*\* (.+)$")]
    private static partial Regex WeaknessPattern();
}
