using System.Text.RegularExpressions;

namespace Dragonbane.Api.Import;

/// <summary>A cost in copper plus its verbatim suffix ("/day", " x potency") and whether it reads "or more".</summary>
public sealed record ParsedCost(int? Copper, string? Unit, bool OrMore);

public static partial class CostParser
{
    static readonly ParsedCost None = new(null, null, false);

    /// <summary>Parses a "Cost Copper" cell such as "200/day" or "500/shift or more".</summary>
    public static ParsedCost ParseCopperColumn(string text)
    {
        if (IsBlank(text)) return None;
        var m = CopperPattern().Match(text.Trim());
        if (!m.Success) throw new InvalidDataException($"Unreadable copper cost '{text}'.");
        return Build(int.Parse(m.Groups["n"].Value), m);
    }

    /// <summary>Parses coin text such as "6 silver × potency" using the imported coin values.</summary>
    public static ParsedCost ParseCoinText(string text, IReadOnlyDictionary<string, int> copperPerCoin)
    {
        if (IsBlank(text)) return None;
        var m = CoinPattern().Match(text.Trim());
        if (!m.Success) throw new InvalidDataException($"Unreadable coin cost '{text}'.");
        var coin = m.Groups["coin"].Value;
        var perCoin = copperPerCoin.FirstOrDefault(c => c.Key.Equals(coin, StringComparison.OrdinalIgnoreCase)).Value;
        if (perCoin == 0) throw new InvalidDataException($"Unknown coin '{coin}' in '{text}'.");
        return Build(int.Parse(m.Groups["n"].Value) * perCoin, m);
    }

    static bool IsBlank(string text) => text.Trim() is "" or "-" or "—";

    static ParsedCost Build(int copper, Match m) =>
        new(copper, m.Groups["unit"].Value is "" ? null : m.Groups["unit"].Value, m.Groups["more"].Success);

    [GeneratedRegex(@"^(?<n>\d+)(?<unit>.*?)(?<more> or more)?$")]
    private static partial Regex CopperPattern();

    [GeneratedRegex(@"^(?<n>\d+) (?<coin>[A-Za-z]+)(?<unit>.*?)(?<more> or more)?$")]
    private static partial Regex CoinPattern();
}
