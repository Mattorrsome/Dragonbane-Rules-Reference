using System.Text.RegularExpressions;
using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;

namespace Dragonbane.Api.Import;

public static partial class SpellsImporter
{
    public static void Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)
    {
        var schools = new Dictionary<string, MagicSchool>();
        foreach (var row in doc.Single(s => s.Heading == "Schools of Magic").Rows)
            db.MagicSchools.Add(schools[row["Name"]] = new MagicSchool { Name = row["Name"], Description = row["Description"] });

        var requirements = new Dictionary<string, Requirement>(StringComparer.OrdinalIgnoreCase);
        var supplies = db.Supplies.ToDictionary(s => s.Name);
        var coins = db.CurrencyRates.ToDictionary(c => c.Name, c => c.CopperValue);
        MagicSchool? school = null;

        foreach (var section in doc)
        {
            if (section.Level == 2)
            {
                school = schools.GetValueOrDefault(section.Heading);
                if (school is not null) school.Note = section.Note;
                continue;
            }
            if (section.Level != 3 || school is null) continue;

            foreach (var row in section.Rows)
            {
                Spell spell;
                if (section.Heading.EndsWith("Magic Tricks"))
                {
                    // User-supplied rule, not in the source: every trick takes one action and needs a gesture.
                    spell = new Spell { Kind = SpellKind.Trick, Rank = 0, CastingTime = "Action", RequirementText = "Gesture" };
                }
                else
                {
                    var ranked = section.Heading.EndsWith("Recipes")
                        ? Recipe(row["Description"], supplies, coins)
                        : new RankedSpell { Kind = SpellKind.Spell };
                    ranked.Rank = int.Parse(row["Rank"]);
                    ranked.Prerequisite = row["Prerequisite"];
                    ranked.Range = row["Range"];
                    ranked.Duration = row["Duration"];
                    ranked.CastingTime = row["Casting Time"];
                    ranked.RequirementText = row["Requirement"];
                    spell = ranked;
                }
                spell.School = school;
                spell.Name = row["Name"];
                spell.Description = row["Description"];
                foreach (var name in SplitRequirements(spell.RequirementText))
                    spell.Requirements.Add(requirements.TryGetValue(name, out var r) ? r : requirements[name] = new Requirement { Name = name });
                db.Spells.Add(spell);
            }
        }
        db.SaveChanges();
    }

    /// <summary>"Word, gesture" splits on commas; "Laboratory; ingredients: a, b" splits on semicolons only.</summary>
    static IEnumerable<string> SplitRequirements(string text) =>
        text.Split(text.Contains(';') ? ';' : ',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Select(part => char.ToUpperInvariant(part[0]) + part[1..]);

    static Recipe Recipe(string description, Dictionary<string, Supply> supplies, Dictionary<string, int> coins)
    {
        var recipe = new Recipe { Kind = SpellKind.Recipe };
        var m = CostPerDose().Match(description.Split('\n')[^1]);
        if (!m.Success) return recipe;
        var cost = CostParser.ParseCoinText(m.Groups["cost"].Value, coins);
        recipe.CostPerDoseCopper = cost.Copper;
        recipe.CostPerDoseUnit = cost.Unit;
        recipe.Supply = m.Groups["supply"].Success ? supplies[m.Groups["supply"].Value] : null;
        return recipe;
    }

    [GeneratedRegex(@"Cost per dose: (?<cost>[^(<\n]+?)\s*(\((?<supply>\w+)\))?$")]
    private static partial Regex CostPerDose();
}
