using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;
using Attribute = Dragonbane.Api.Data.Entities.Attribute;

namespace Dragonbane.Api.Import;

public static class SkillsImporter
{
    public static void Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)
    {
        var types = new Dictionary<string, SkillType>();
        var attributes = new Dictionary<string, Attribute>();

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
                Attribute = attributes.TryGetValue(code, out var attribute) ? attribute : attributes[code] = new Attribute { Code = code },
                AttributeNote = note,
                Description = row["Description"],
            });
        }
        db.SaveChanges();
    }
}
