using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;

namespace Dragonbane.Api.Import;

public static class CurrencyImporter
{
    public static void Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)
    {
        foreach (var row in doc.Single(s => s.Heading == "Currency Exchange").Rows)
            db.CurrencyRates.Add(new CurrencyRate { Name = row["Name"], CopperValue = int.Parse(row["Value Copper"]) });
        db.SaveChanges();
    }
}
