using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;

namespace Dragonbane.Api.Import;

public static class EquipmentImporter
{
    static readonly HashSet<string> GlossarySections = ["Currency Exchange", "Supply and Weapon Terms", "Weapon Features"];
    static readonly HashSet<string> SupplyNames = ["Common", "Uncommon", "Rare", "Unique"];
    static readonly string[] EffectHeaders = ["Effect", "Musician effect", "Capacity/effect", "Effect/capacity", "Capacity", "Features"];
    static readonly string[] DamageTypeNames = ["piercing", "slashing", "bludgeoning"];

    /// <summary>Weapon feature tokens as written in the weapon tables, mapped to glossary feature names.</summary>
    static readonly Dictionary<string, string> FeatureTokens = new(StringComparer.OrdinalIgnoreCase)
    {
        ["subtle"] = "Subtle", ["long"] = "Long", ["toppling"] = "Toppling", ["thrown"] = "Can be thrown",
    };

    public static void Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)
    {
        foreach (var row in Rows(doc, "Supply and Weapon Terms"))
        {
            if (SupplyNames.Contains(row["Name"])) db.Supplies.Add(new Supply { Name = row["Name"], Description = row["Description"] });
            else db.WeaponTerms.Add(new WeaponTerm { Name = row["Name"], Description = row["Description"] });
        }
        foreach (var row in Rows(doc, "Weapon Features"))
            db.WeaponFeatures.Add(new WeaponFeature { Name = row["Name"], Description = row["Description"] });
        foreach (var name in DamageTypeNames)
            db.DamageTypes.Add(new DamageType { Name = char.ToUpperInvariant(name[0]) + name[1..] });
        db.SaveChanges();

        var supplies = db.Supplies.ToDictionary(s => s.Name);
        var features = db.WeaponFeatures.ToDictionary(f => f.Name);
        var damageTypes = db.DamageTypes.ToDictionary(d => d.Name, StringComparer.OrdinalIgnoreCase);

        foreach (var section in doc.Where(s => s.Level == 2 && s.Columns.Count > 0 && !GlossarySections.Contains(s.Heading)))
        {
            var category = new EquipmentCategory
            {
                Name = section.Heading,
                NameHeader = section.Columns[0],
                EffectHeader = EffectHeaders.FirstOrDefault(section.Columns.Contains),
                HasWeight = section.Columns.Contains("Weight"),
                CanResell = section.Heading != "Services",
                Note = section.Note,
            };
            db.EquipmentCategories.Add(category);
            // Saved per category so Ids follow source order, which is the display order.
            db.SaveChanges();

            foreach (var row in section.Rows)
            {
                var item = section.Heading switch
                {
                    "Melee weapons" or "Ranged weapons" => Weapon(row, section.Heading == "Ranged weapons", features, damageTypes),
                    "Armour and helmets" => Armour(row),
                    _ => new EquipmentItem { Effect = Cell(row, category.EffectHeader) },
                };
                var cost = CostParser.ParseCopperColumn(row["Cost Copper"]);
                item.Category = category;
                item.Name = row[section.Columns[0]];
                item.CostCopper = cost.Copper;
                item.CostUnit = cost.Unit;
                item.CostOrMore = cost.OrMore;
                item.CostText = row["Cost"];
                item.Supply = Cell(row, "Supply") is { } supply ? supplies[supply] : null;
                item.Weight = Cell(row, "Weight");
                db.EquipmentItems.Add(item);
            }
            db.SaveChanges();
        }
    }

    static Weapon Weapon(IReadOnlyDictionary<string, string> row, bool isRanged,
        Dictionary<string, WeaponFeature> features, Dictionary<string, DamageType> damageTypes)
    {
        var text = row["Features"];
        var split = text.IndexOf(';');
        var weapon = new Weapon
        {
            Grip = Cell(row, "Grip"),
            StrRequirement = Cell(row, "STR") is { } str ? int.Parse(str) : null,
            Range = row["Range"],
            Damage = row["Damage"],
            Durability = Cell(row, "Durability") is { } durability ? int.Parse(durability) : null,
            IsRanged = isRanged,
            FeaturesText = text,
            Effect = split < 0 ? null : text[(split + 1)..].Trim(),
        };
        foreach (var token in (split < 0 ? text : text[..split]).Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
        {
            if (FeatureTokens.TryGetValue(token, out var feature)) weapon.Features.Add(features[feature]);
            else if (damageTypes.TryGetValue(token, out var damageType)) weapon.DamageTypes.Add(damageType);
            else throw new InvalidDataException($"Weapon '{row["Weapon"]}' has unknown feature '{token}'.");
        }
        return weapon;
    }

    static Armour Armour(IReadOnlyDictionary<string, string> row) => new()
    {
        Rating = int.Parse(row["Rating"]),
        IsHelmet = row["Rating"].StartsWith('+'),
        Effect = Cell(row, "Effect"),
    };

    static IEnumerable<IReadOnlyDictionary<string, string>> Rows(IReadOnlyList<MarkdownSection> doc, string heading) =>
        doc.FirstOrDefault(s => s.Heading == heading)?.Rows ?? [];

    /// <summary>Cell value, or null when the column is missing or the cell is "-".</summary>
    static string? Cell(IReadOnlyDictionary<string, string> row, string? column) =>
        column is not null && row.TryGetValue(column, out var value) && value != "-" ? value : null;
}
