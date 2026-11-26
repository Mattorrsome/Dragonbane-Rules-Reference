using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;
using Attribute = Dragonbane.Api.Data.Entities.Attribute;

namespace Dragonbane.Api.Import;

public static class SkillsImporter
{
    public static void Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)
    {
        var types = new Dictionary<string, SkillType>();
        // All six, in book order: not every attribute has a skill (CON has none), but the creator needs them all.
        var attributes = new[] { "STR", "CON", "AGL", "INT", "WIL", "CHA" }.ToDictionary(c => c, c => new Attribute { Code = c });
        db.Attributes.AddRange(attributes.Values);

        foreach (var row in doc.Single(s => s.Columns.Contains("Attribute")).Rows)
        {
            // "CHA (uses PERFORMANCE)" → code "CHA", note "uses PERFORMANCE".
            var cell = row["Attribute"];
            var paren = cell.IndexOf('(');
            var code = paren < 0 ? cell : cell[..paren].Trim();
            var note = paren < 0 ? null : cell[(paren + 1)..].TrimEnd(')').Trim();

            db.Skills.Add(new Skill
            {
                Name = row["Name"],
                SkillType = types.TryGetValue(row["Type"], out var type) ? type : types[row["Type"]] = new SkillType { Name = row["Type"] },
                Attribute = attributes.TryGetValue(code, out var attribute) ? attribute : throw new InvalidDataException($"Skill '{row["Name"]}' has unknown attribute '{code}'."),
                AttributeNote = note,
                Description = row["Description"],
            });
        }
        db.SaveChanges();
    }
}
