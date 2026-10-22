namespace Dragonbane.Api.Tests;

public static class TestPaths
{
    public static string SourceMaterial { get; } = Find();

    static string Find()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "Source Material");
            if (Directory.Exists(candidate)) return candidate;
        }
        throw new DirectoryNotFoundException("Source Material not found above " + AppContext.BaseDirectory);
    }
}
