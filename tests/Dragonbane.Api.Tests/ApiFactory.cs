using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Dragonbane.Api.Tests;

/// <summary>Runs the API against the real source material and a throwaway SQLite file.</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"dragonbane-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Dragonbane:DatabasePath", _databasePath);
        builder.UseSetting("Dragonbane:SourceMaterialPath", TestPaths.SourceMaterial);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        try { File.Delete(_databasePath); } catch (IOException) { }
    }
}
