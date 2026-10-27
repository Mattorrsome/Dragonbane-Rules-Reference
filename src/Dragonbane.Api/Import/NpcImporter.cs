using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;

namespace Dragonbane.Api.Import;

public static class NpcImporter
{
    /// <summary>NPC gear written differently from the Equipment table, mapped to the item's name there (hand-curated).</summary>
    static readonly Dictionary<string, string> Aliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["leather armour"] = "Leather",
        ["wooden club"] = "Small wooden club",
        ["relevant book"] = "Book",
    };

    /// <summary>The Archmage's school skill: not a row in the Skills table, so it is kept by name.</summary>
    const string MagicSchool = "Magic school";
    const string BossSuffix = "(boss)";

    public static void Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)
    {
        var skills = db.Skills.ToDictionary(s => s.Name, StringComparer.OrdinalIgnoreCase);
        var abilities = db.HeroicAbilities.ToDictionary(h => h.Name, StringComparer.OrdinalIgnoreCase);
        var items = db.EquipmentItems.ToDictionary(i => i.Name, StringComparer.OrdinalIgnoreCase);
        var attributes = db.Attributes.ToDictionary(a => a.Code);

        foreach (var row in doc.Single(s => s.Columns.Contains("Typical gear")).Rows)
        {
            var type = row["Type"];
            var isBoss = type.EndsWith(BossSuffix);
            var npc = new Npc
            {
                Name = isBoss ? type[..^BossSuffix.Length].Trim() : type,
                IsBoss = isBoss,
                Hp = int.Parse(row["HP"]),
                Wp = row["WP"] == "-" ? null : int.Parse(row["WP"]),
            };
            T Find<T>(Dictionary<string, T> lookup, string name, string column) =>
                lookup.TryGetValue(name, out var found) ? found
                    : throw new InvalidDataException($"NPC '{npc.Name}' has unknown {column} '{name}'.");

            // "STR +D6" → STR, "D6".
            if (row["Bonus"] != "-")
            {
                var (code, dice) = Split(row["Bonus"], ' ');
                npc.DamageBonusAttribute = Find(attributes, code, "bonus attribute");
                npc.DamageBonusDice = dice.TrimStart('+');
            }

            // "Myths and Legends 13" → name, level (the level is after the last space).
            foreach (var cell in List(row["Skills"]))
            {
                var (name, level) = Split(cell, ' ', last: true);
                npc.Skills.Add(name.Equals(MagicSchool, StringComparison.OrdinalIgnoreCase)
                    ? new NpcSkill { UnlinkedName = MagicSchool, Level = int.Parse(level) }
                    : new NpcSkill { Skill = Find(skills, name, "skill"), Level = int.Parse(level) });
            }

            // "Robust x6" → Robust, 6.
            foreach (var cell in List(row["Heroic abilities"]))
            {
                var x = cell.LastIndexOf(" x", StringComparison.Ordinal);
                var count = 1;
                var counted = x > 0 && int.TryParse(cell[(x + 2)..], out count);
                npc.HeroicAbilities.Add(new NpcHeroicAbility
                {
                    HeroicAbility = Find(abilities, counted ? cell[..x] : cell, "heroic ability"),
                    Count = counted ? count : 1,
                });
            }

            foreach (var cell in List(row["Typical gear"]))
                npc.Gear.Add(new NpcGear { EquipmentItem = Find(items, Aliases.GetValueOrDefault(cell, cell), "gear") });

            db.Npcs.Add(npc);
            // Saved per NPC so Ids, and the Ids of its lists, follow source order.
            db.SaveChanges();
        }
    }

    static IEnumerable<string> List(string cell) =>
        cell == "-" ? [] : cell.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

    static (string Before, string After) Split(string text, char separator, bool last = false)
    {
        var at = last ? text.LastIndexOf(separator) : text.IndexOf(separator);
        return at < 0 ? throw new InvalidDataException($"Cannot split '{text}'.") : (text[..at], text[(at + 1)..]);
    }
}
