using Dragonbane.Api.Import;

namespace Dragonbane.Api.Tests.Import;

public class CostParserTests
{
    static readonly Dictionary<string, int> Coins = new() { ["Copper"] = 1, ["Silver"] = 10, ["Gold"] = 100 };

    [Theory]
    [InlineData("1", 1, null, false)]
    [InlineData("200/day", 200, "/day", false)]
    [InlineData("500/shift or more", 500, "/shift", true)]
    [InlineData("200 x potency", 200, " x potency", false)]
    [InlineData("2500, varies", 2500, ", varies", false)]
    [InlineData("-", null, null, false)]
    public void Parses_copper_column(string text, int? copper, string? unit, bool orMore) =>
        Assert.Equal(new ParsedCost(copper, unit, orMore), CostParser.ParseCopperColumn(text));

    [Theory]
    [InlineData("6 silver × potency", 60, " × potency")]
    [InlineData("5 GOLD", 500, null)]
    [InlineData("—", null, null)]
    public void Parses_coin_text(string text, int? copper, string? unit) =>
        Assert.Equal(new ParsedCost(copper, unit, false), CostParser.ParseCoinText(text, Coins));
}
