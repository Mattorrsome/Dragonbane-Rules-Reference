using Dragonbane.Api.Data.Entities;

namespace Dragonbane.Api.Import;

/// <summary>One line of a package. More than one name in Items is a choice; Dice replace Quantity when set.</summary>
public sealed record SeedGear(GearEntryKind Kind, string[] Items, int Quantity = 1, int? DiceCount = null, int? DiceSides = null);

public sealed record SeedPackage(int From, int To, SeedGear[] Entries);

/// <summary>
/// Hand-transcribed starting gear from the Professions table (and the school notes) in
/// Dragonbane_Character_Creation.md, keyed by profession or school name. The markdown prose is never parsed.
/// Names resolve through Aliases, then the Equipment table, then Unlinked; anything else fails the import.
/// </summary>
public static class GearPackageSeed
{
    static SeedGear I(params string[] items) => new(GearEntryKind.Item, items);
    static SeedGear Q(string item, int quantity) => new(GearEntryKind.Item, [item], quantity);
    static SeedGear D(string item, int sides) => new(GearEntryKind.Item, [item], DiceCount: 1, DiceSides: sides);
    static SeedGear Silver(int sides) => new(GearEntryKind.Silver, [], DiceCount: 1, DiceSides: sides);
    static SeedPackage P(int from, int to, params SeedGear[] entries) => new(from, to, entries);

    static SeedGear Torch => I("torch");
    static SeedGear Flint => I("flint and tinder");

    /// <summary>Lowercase seed name to Equipment name, where they differ.</summary>
    public static IReadOnlyDictionary<string, string> Aliases { get; } = new Dictionary<string, string>
    {
        ["leather armour"] = "Leather",
        ["hemp rope"] = "Hemp rope, 10 m",
        ["quiver"] = "Wooden-headed arrow quiver",
        ["lamp oil"] = "Lamp oil, 10 doses",
        ["bandages"] = "Bandages, 10",
        ["one dose sleeping poison"] = "Sleeping poison, dose",
        ["book on any subject"] = "Book",
        ["quill"] = "Quill and ink",
        ["rations"] = "Field ration",
    };

    /// <summary>Items the Equipment tables do not list; seeded by name only.</summary>
    public static IReadOnlySet<string> Unlinked { get; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Small field laboratory",
        "General herbs",
    };

    public static IReadOnlyDictionary<string, SeedPackage[]> Packages { get; } = new Dictionary<string, SeedPackage[]>
    {
        ["Artisan"] = [
            P(1, 2, I("light warhammer"), I("leather armour"), I("blacksmithing tools"), Torch, Flint, D("rations", 8), Silver(8)),
            P(3, 4, I("handaxe"), I("leather armour"), I("carpentry tools"), Torch, I("hemp rope"), Flint, D("rations", 8), Silver(8)),
            P(5, 6, I("knife"), I("leather armour"), I("tanning tools"), I("lantern"), I("lamp oil"), Flint, D("rations", 8), Silver(8)),
        ],
        ["Bard"] = [
            P(1, 2, I("lyre"), I("knife"), I("oil lamp"), I("lamp oil"), Flint, D("rations", 6), Silver(8)),
            P(3, 4, I("flute"), I("dagger"), I("hemp rope"), Torch, Flint, D("rations", 6), Silver(8)),
            P(5, 6, I("horn"), I("knife"), Torch, Flint, D("rations", 6), Silver(8)),
        ],
        ["Fighter"] = [
            P(1, 2, I("broadsword"), I("battleaxe", "morningstar"), I("small shield"), I("chainmail"), Torch, Flint, D("rations", 6), Silver(6)),
            P(3, 4, I("short sword"), I("handaxe", "short spear"), I("light crossbow"), I("quiver"), I("leather armour"), Torch, Flint, D("rations", 6), Silver(6)),
            P(5, 6, I("long spear"), I("studded leather"), I("open helmet"), Torch, Flint, D("rations", 6), Silver(6)),
        ],
        ["Hunter"] = [
            P(1, 2, I("dagger"), I("short bow"), I("quiver"), I("leather armour"), I("sleeping fur"), Torch, Flint, I("hemp rope"), I("snare"), D("rations", 8), Silver(6)),
            P(3, 4, I("knife"), I("longbow"), I("quiver"), I("leather armour"), I("sleeping fur"), Torch, Flint, I("hemp rope"), I("fishing rod"), D("rations", 8), Silver(6)),
            P(5, 6, I("dagger"), I("sling"), I("leather armour"), I("sleeping fur"), Torch, Flint, I("hemp rope"), I("snare"), D("rations", 8), Silver(6)),
        ],
        ["Knight"] = [
            P(1, 2, I("broadsword", "morningstar"), I("small shield"), I("plate armour"), I("great helm"), Torch, Flint, D("rations", 6), Silver(12)),
            P(3, 4, I("flail", "light warhammer"), I("small shield"), I("chainmail"), I("open helmet"), Torch, Flint, D("rations", 6), Silver(12)),
            P(5, 6, I("short sword"), I("lance"), I("small shield"), I("chainmail"), I("open helmet"), I("combat-trained horse"), D("rations", 6), Silver(12)),
        ],
        ["Mage"] = [
            P(1, 2, I("staff"), I("orbuculum"), I("grimoire"), Torch, Flint, D("rations", 6), Silver(8)),
            P(3, 4, I("knife"), I("wand"), I("grimoire"), Torch, Flint, D("rations", 6), Silver(8)),
            P(5, 6, I("amulet"), I("grimoire"), I("sleeping fur"), Torch, Flint, D("rations", 6), Silver(8)),
        ],
        ["Mariner"] = [
            P(1, 2, I("dagger"), I("short bow"), I("quiver"), I("hemp rope"), I("grappling hook"), I("sleeping fur"), Torch, Flint, D("rations", 8), Silver(10)),
            P(3, 4, I("scimitar"), I("leather armour"), I("hemp rope"), I("grappling hook"), Torch, Flint, D("rations", 8), Silver(10)),
            P(5, 6, I("trident"), I("spyglass"), I("hemp rope"), I("grappling hook"), Torch, Flint, D("rations", 8), Silver(10)),
        ],
        ["Merchant"] = [
            P(1, 2, I("dagger"), I("sleeping fur"), Torch, Flint, I("hemp rope"), I("donkey"), D("rations", 6), Silver(12)),
            P(3, 4, I("knife"), I("sleeping fur"), I("lantern"), I("lamp oil"), Flint, I("field kitchen"), I("donkey"), I("cart"), D("rations", 6), Silver(12)),
            P(5, 6, I("dagger"), I("sleeping fur"), I("large tent"), I("oil lamp"), I("lamp oil"), Flint, I("backpack"), D("rations", 6), Silver(12)),
        ],
        ["Scholar"] = [
            P(1, 2, I("staff"), I("notebook"), I("quill"), I("sleeping fur"), Torch, Flint, D("rations", 6), Silver(10)),
            P(3, 4, I("knife"), I("book on any subject"), I("sleeping fur"), I("oil lamp"), I("lamp oil"), Flint, D("rations", 6), Silver(10)),
            P(5, 6, I("short sword"), I("bandages"), I("one dose sleeping poison"), I("sleeping fur"), I("lantern"), I("lamp oil"), Flint, D("rations", 6), Silver(10)),
        ],
        ["Thief"] = [
            P(1, 2, I("dagger"), I("sling"), I("hemp rope"), I("grappling hook"), Torch, Flint, D("rations", 6), Silver(10)),
            P(3, 4, I("knife"), I("simple lockpicks"), Torch, Flint, D("rations", 6), Silver(10)),
            P(5, 6, Q("dagger", 2), I("marbles"), I("hemp rope"), Torch, Flint, D("rations", 6), Silver(10)),
        ],
        // School extras: RollFrom = RollTo = 0.
        ["Alchemy"] = [P(0, 0, I("Small field laboratory"), D("General herbs", 6))],
        ["Enchanting"] = [P(0, 0, I("blacksmithing tools", "carpentry tools", "tanning tools"))],
        ["Harmonism"] = [P(0, 0, I("grimoire"))],
    };
}
