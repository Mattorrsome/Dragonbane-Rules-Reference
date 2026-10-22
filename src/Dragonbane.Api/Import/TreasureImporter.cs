using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;

namespace Dragonbane.Api.Import;

public static class TreasureImporter
{
    /// <summary>Rolls whose entry is text only, with nothing to roll.</summary>
    static readonly HashSet<int> TextOnly = [37];

    public static void Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db) => Import(doc, db, TreasureSeed.Rolls);

    internal static void Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db, IReadOnlyDictionary<int, SeedRoll[]> seed)
    {
        var rows = doc.Single(s => s.Columns.Contains("Roll")).Rows;
        var rolls = rows.Select(r => int.Parse(r["Roll"])).ToHashSet();
        if (seed.Keys.FirstOrDefault(k => !rolls.Contains(k)) is var orphan and > 0)
            throw new InvalidDataException($"Treasure seed has roll {orphan} with no markdown row.");
        if (rolls.FirstOrDefault(r => !seed.ContainsKey(r) && !TextOnly.Contains(r)) is var unseeded and > 0)
            throw new InvalidDataException($"Treasure row {unseeded} has no seed entry.");

        var lookup = new Lookup(
            db.EquipmentItems.ToDictionary(i => i.Name),
            db.MagicSchools.ToDictionary(s => s.Name),
            db.CurrencyRates.ToDictionary(c => c.Name));

        foreach (var row in rows)
        {
            var roll = int.Parse(row["Roll"]);
            var entry = new TreasureEntry { Roll = roll, Name = row["Treasure"], EffectText = row["Value or Effect"] };
            entry.Rolls.AddRange(seed.GetValueOrDefault(roll, []).Select((r, i) => BuildRoll(r, i + 1, lookup, depth: 1, roll)));
            db.TreasureEntries.Add(entry);
        }
        db.SaveChanges();
    }

    sealed record Lookup(
        Dictionary<string, EquipmentItem> Items,
        Dictionary<string, MagicSchool> Schools,
        Dictionary<string, CurrencyRate> Coins);

    static TreasureRoll BuildRoll(SeedRoll seed, int sequence, Lookup lookup, int depth, int entryRoll)
    {
        var outcomes = seed.Outcomes ?? [];
        if (depth > 1 && outcomes.Length > 0)
            throw new InvalidDataException($"Treasure {entryRoll}: nested roll '{seed.Label}' cannot have outcomes.");
        if (seed.Purpose == RollPurpose.Pick && outcomes.Length != seed.Sides)
            throw new InvalidDataException($"Treasure {entryRoll}: pick '{seed.Label}' has {outcomes.Length} outcomes for D{seed.Sides}.");

        var roll = new TreasureRoll
        {
            Sequence = sequence,
            Label = seed.Label,
            DiceCount = seed.Count,
            DieSides = seed.Sides,
            Modifier = seed.Modifier,
            Multiplier = seed.Multiplier,
            Purpose = seed.Purpose,
            Coin = seed.Coin is null ? null : Find(lookup.Coins, seed.Coin, "coin", entryRoll),
        };
        roll.Outcomes.AddRange(outcomes.Select((o, i) => BuildOutcome(o, i + 1, lookup, depth, entryRoll)));
        return roll;
    }

    static TreasureOutcome BuildOutcome(SeedOutcome seed, int face, Lookup lookup, int depth, int entryRoll)
    {
        var outcome = new TreasureOutcome
        {
            Face = face,
            Label = seed.Label,
            EquipmentItemId = seed.Item is null ? null : Find(lookup.Items, seed.Item, "item", entryRoll).Id,
            IsMastercrafted = seed.Mastercrafted,
            MagicSchoolId = seed.School is null ? null : Find(lookup.Schools, seed.School, "school", entryRoll).Id,
        };
        if (seed.Value is { } value)
        {
            var coin = Find(lookup.Coins, seed.ValueCoin ?? "", "coin", entryRoll);
            outcome.ValueCopper = value * coin.CopperValue;
            outcome.ValueText = $"{value} {coin.Name.ToLowerInvariant()}";
        }
        outcome.Rolls.AddRange((seed.Rolls ?? []).Select((r, i) => BuildRoll(r, i + 1, lookup, depth + 1, entryRoll)));
        return outcome;
    }

    static T Find<T>(Dictionary<string, T> map, string name, string kind, int entryRoll) =>
        map.TryGetValue(name, out var found) ? found : throw new InvalidDataException($"Treasure {entryRoll}: unknown {kind} '{name}'.");
}
