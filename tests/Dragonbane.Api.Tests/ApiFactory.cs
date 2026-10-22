using Dragonbane.Api.Data;
using Dragonbane.Api.Import;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Dragonbane.Api.Tests;

/// <summary>Imports the real source material into a throwaway SQLite file, then runs the API against it.</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"dragonbane-{Guid.NewGuid():N}.db");

    public ApiFactory()
    {
        using var db = new DragonbaneDbContext(new DbContextOptionsBuilder<DragonbaneDbContext>().UseSqlite($"Data Source={_databasePath}").Options);
        SourceImporter.RebuildAsync(db, TestPaths.SourceMaterial, CancellationToken.None).GetAwaiter().GetResult();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Dragonbane:DatabasePath", _databasePath);
        builder.UseSetting("Dragonbane:SourceMaterialPath", TestPaths.SourceMaterial);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        SqliteConnection.ClearAllPools();
        try { File.Delete(_databasePath); } catch (IOException) { }
    }
}
