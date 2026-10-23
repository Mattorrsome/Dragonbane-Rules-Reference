using Dragonbane.Api.Data.Entities;

namespace Dragonbane.Api.Import;

public sealed record SeedRoll(string Label, int Count, int Sides, RollPurpose Purpose,
    int Modifier = 0, int Multiplier = 1, string? Coin = null, SeedOutcome[]? Outcomes = null);

public sealed record SeedOutcome(string Label, string? Item = null, bool Mastercrafted = false,
    string? School = null, int? Value = null, string? ValueCoin = null, SeedRoll[]? Rolls = null);

/// <summary>
/// Hand-curated dice specs for the treasure table, keyed by roll. Transcribed from
/// Dragonbane_Treasure_Table.md so the app never parses effect text at runtime.
/// Display text (names, effects) still comes from the markdown.
/// </summary>
public static class TreasureSeed
{
    static SeedRoll[] Coins(int count, string coin, int multiplier = 1) =>
        [new("value", count, 6, RollPurpose.Coins, Multiplier: multiplier, Coin: coin)];

    static SeedRoll[] Pick(string label, int sides, params SeedOutcome[] outcomes) =>
        [new(label, 1, sides, RollPurpose.Pick, Outcomes: outcomes)];

    static SeedOutcome Item(string label, string item) => new(label, Item: item);
    static SeedOutcome Mastercrafted(string label, string item) => new(label, Item: item, Mastercrafted: true);
    static SeedOutcome Gem(string label, int value, string coin) => new(label, Value: value, ValueCoin: coin);

    public static IReadOnlyDictionary<int, SeedRoll[]> Rolls { get; } = new Dictionary<int, SeedRoll[]>
    {
        [1] = Coins(1, "Copper"),
        [2] = Coins(2, "Copper"),
        [3] = Coins(4, "Copper"),
        [4] = Coins(2, "Copper", 10),
        [5] = Coins(4, "Copper", 10),
        [6] = Coins(1, "Silver"),
        [7] = Coins(3, "Silver"),
        [8] = Coins(1, "Silver", 5),
        [9] = Coins(1, "Silver", 10),
        [10] = Coins(2, "Silver", 10),
        [11] = Coins(3, "Silver", 10),
        [12] = Coins(1, "Gold"),
        [13] = Coins(2, "Gold"),
        [14] = Coins(4, "Gold"),
        [15] = Coins(1, "Gold", 10),
        [16] = Coins(2, "Gold", 10),
        [17] = Coins(2, "Gold", 5),
        [18] = Coins(2, "Silver", 10),
        [19] = Coins(2, "Gold", 10),
        [20] = Coins(2, "Silver", 5),
        [21] = Coins(2, "Gold"),
        [22] = Coins(2, "Silver"),
        [23] = Coins(4, "Gold"),
        [24] = Coins(2, "Silver", 5),
        [25] = Coins(2, "Gold", 5),
        [26] = Pick("gemstone", 6,
            Gem("glass", 2, "Copper"), Gem("crystal", 10, "Silver"), Gem("emerald", 10, "Gold"),
            Gem("sapphire", 15, "Gold"), Gem("ruby", 25, "Gold"), Gem("diamond", 100, "Gold")),
        [27] = Pick("clothing", 3, Item("boots", "Boots"), Item("cloak", "Cloak"), Item("fur", "Fur")),
        [28] = Pick("weapon", 6,
            Item("dagger", "Dagger"), Item("short sword", "Short sword"), Item("short spear", "Short spear"),
            Item("broadsword", "Broadsword"), Item("long spear", "Long spear"), Item("longsword", "Longsword")),
        [29] = Pick("weapon", 6,
            Item("handaxe", "Handaxe"), Item("scimitar", "Scimitar"), Item("morningstar", "Morningstar"),
            Item("parrying dagger", "Parrying dagger"), Item("light warhammer", "Light warhammer"), Item("flail", "Flail")),
        [30] = Pick("weapon", 6,
            Item("sling", "Sling"), Item("short bow", "Short bow"), Item("longbow", "Longbow"),
            Item("light crossbow", "Light crossbow"), Item("heavy crossbow", "Heavy crossbow"), Item("hand crossbow", "Hand crossbow")),
        [31] = Pick("weapon", 6,
            Mastercrafted("dagger", "Dagger"), Mastercrafted("short sword", "Short sword"), Mastercrafted("battleaxe", "Battleaxe"),
            Mastercrafted("broadsword", "Broadsword"), Mastercrafted("heavy warhammer", "Heavy warhammer"), Mastercrafted("longsword", "Longsword")),
        [32] = Pick("armour", 6,
            Item("small shield", "Small shield"), Item("large shield", "Large shield"), Item("open helmet", "Open helmet"),
            Item("great helm", "Great helm"), Item("studded leather", "Studded leather"), Item("chainmail", "Chainmail")),
        [33] = Pick("type", 3, new("lethal"), new("paralysing"), new("sleeping")),
        [34] = [new("damage", 1, 6, RollPurpose.Number)],
        [35] =
        [
            new("school", 1, 4, RollPurpose.Pick, Outcomes:
            [
                new("Animism", School: "Animism"), new("Elementalism", School: "Elementalism"),
                new("Mentalism", School: "Mentalism"), new("General Magic", School: "General Magic"),
            ]),
            new("spell rank (0 = tricks)", 1, 4, RollPurpose.SpellRank, Modifier: -1),
            new("spells", 1, 4, RollPurpose.Number),
        ],
        [36] = Pick("contents", 6,
            Item("lethal poison potency 12", "Lethal poison, dose"),
            Item("sleeping poison potency 14", "Sleeping poison, dose"),
            new("alcohol"),
            Item("herbal concoction", "Herbal concoction, dose"),
            // HP is shown as dice for the GM, not rolled (see DECISIONS.md).
            Item("healing potion 2D6 HP", "Healing potion, dose"),
            Item("healing potion 3D6 HP", "Healing potion, dose")),
        [38] = Pick("instrument", 6,
            Item("horn", "Horn"), Item("flute", "Flute"), Item("harp", "Harp"),
            Item("lyre", "Lyre"), Item("bagpipe", "Bagpipe"), Item("drum", "Drum")),
        [39] = Pick("trade goods", 6,
            Item("magnifying glass", "Magnifying glass"), Item("spyglass", "Spyglass"), Item("perfume", "Perfume, 10 doses"),
            Item("chess set", "Chess set"), Item("playing cards", "Playing cards"), Item("marbles", "Marbles")),
        [40] = [new("damage", 1, 4, RollPurpose.Number)],
    };
}
