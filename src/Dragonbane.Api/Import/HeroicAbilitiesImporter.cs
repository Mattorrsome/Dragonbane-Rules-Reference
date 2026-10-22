using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;

namespace Dragonbane.Api.Import;

public static class HeroicAbilitiesImporter
{
    public static void Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)
    {
        foreach (var row in doc.Single(s => s.Columns.Contains("Ability")).Rows)
            db.HeroicAbilities.Add(new HeroicAbility
            {
                Name = row["Ability"],
                Prerequisite = row["Prerequisite"],
                Wp = row["WP"],
                Effect = row["Effect"],
            });
        db.SaveChanges();
    }
}
