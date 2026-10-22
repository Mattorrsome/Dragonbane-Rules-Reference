namespace Dragonbane.Api.Import;

public sealed record MarkdownSection(string Heading, int Level, string? Note,
    IReadOnlyList<string> Columns, IReadOnlyList<IReadOnlyDictionary<string, string>> Rows);

/// <summary>Splits markdown into heading sections, each with its pipe table and prose note.</summary>
public static class MarkdownDocument
{
    public static IReadOnlyList<MarkdownSection> Parse(string markdown)
    {
        var sections = new List<MarkdownSection>();
        string? heading = null;
        var level = 0;
        List<string> columns = [];
        List<IReadOnlyDictionary<string, string>> rows = [];
        List<string> note = [];

        void Flush()
        {
            if (heading is null) return;
            sections.Add(new MarkdownSection(heading, level, note.Count == 0 ? null : string.Join("\n", note), columns, rows));
        }

        foreach (var raw in markdown.Split('\n'))
        {
            var line = raw.Trim();
            if (line.StartsWith('#'))
            {
                Flush();
                level = line.TakeWhile(c => c == '#').Count();
                heading = line[level..].Trim();
                columns = [];
                rows = [];
                note = [];
            }
            else if (line.StartsWith('|'))
            {
                var cells = SplitRow(line);
                if (columns.Count == 0) columns = cells;
                else if (cells.All(c => c.Length > 0 && c.All(ch => ch is '-' or ':'))) continue;
                else rows.Add(columns.Select((c, i) => (c, v: i < cells.Count ? cells[i] : ""))
                    .ToDictionary(p => p.c, p => p.v));
            }
            else if (line.Length > 0 && !line.StartsWith("- ") && !line.StartsWith("* "))
            {
                note.Add(line.Replace("**", "").Replace("*", ""));
            }
        }
        Flush();
        return sections;
    }

    static List<string> SplitRow(string line) =>
        line.Trim('|').Split('|').Select(c => c.Replace("<br>", "\n").Trim()).ToList();
}
