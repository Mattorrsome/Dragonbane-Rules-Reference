using Dragonbane.Api.Import;

namespace Dragonbane.Api.Tests.Import;

public class MarkdownDocumentTests
{
    [Fact]
    public void Parses_heading_levels_and_table_rows()
    {
        var sections = MarkdownDocument.Parse("## A\n\n| X | Y |\n| --- | ---: |\n| 1 | two |");

        var a = Assert.Single(sections);
        Assert.Equal("A", a.Heading);
        Assert.Equal(2, a.Level);
        Assert.Equal(["X", "Y"], a.Columns);
        Assert.Equal("two", a.Rows[0]["Y"]);
    }

    [Fact]
    public void Converts_br_to_newline()
    {
        var sections = MarkdownDocument.Parse("# T\n\n| C |\n| --- |\n| a<br>b |");

        Assert.Equal("a\nb", sections[0].Rows[0]["C"]);
    }

    [Fact]
    public void Captures_note_without_emphasis()
    {
        var sections = MarkdownDocument.Parse(
            "## W\n\n| C |\n| --- |\n| x |\n\nA **mastercrafted** version costs 10 times normal.\n\n- [Link](#w)");

        Assert.StartsWith("A mastercrafted version", sections[0].Note);
        Assert.DoesNotContain("Link", sections[0].Note);
    }

    [Fact]
    public void Parses_real_equipment_file()
    {
        var sections = MarkdownDocument.Parse(
            File.ReadAllText(Path.Combine(TestPaths.SourceMaterial, "Dragonbane_Equipment_Tables.md")));

        Assert.Equal(29, sections.Single(s => s.Heading == "Melee weapons").Rows.Count);
        Assert.Equal(17, sections.Single(s => s.Heading == "Services").Rows.Count);
        Assert.Equal(3, sections.Single(s => s.Heading == "Currency Exchange").Rows.Count);
    }
}
