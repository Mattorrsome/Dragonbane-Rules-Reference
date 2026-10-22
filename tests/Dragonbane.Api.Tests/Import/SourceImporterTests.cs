using Dragonbane.Api.Data;
using Dragonbane.Api.Import;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Dragonbane.Api.Tests.Import;

public class SourceImporterTests
{
    [Fact]
    public async Task Failed_import_leaves_existing_database_untouched()
    {
        var dir = Directory.CreateTempSubdirectory("dragonbane-").FullName;
        var database = Path.Combine(dir, "dragonbane.db");
        var broken = Path.Combine(dir, "source");
        Directory.CreateDirectory(broken);
        foreach (var file in Directory.GetFiles(TestPaths.SourceMaterial))
            File.Copy(file, Path.Combine(broken, Path.GetFileName(file)));
        File.Delete(Path.Combine(broken, "Dragonbane_Treasure_Table.md")); // fails after the other sections imported
        await File.WriteAllTextAsync(database, "previous good build");
        try
        {
            await Assert.ThrowsAnyAsync<Exception>(() => SourceImporter.ImportToFileAsync(database, broken, CancellationToken.None));

            Assert.Equal("previous good build", await File.ReadAllTextAsync(database));
            Assert.Equal(["dragonbane.db"], Directory.GetFiles(dir).Select(Path.GetFileName));
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            Directory.Delete(dir, recursive: true);
        }
    }

    [Fact]
    public async Task Successful_import_replaces_database()
    {
        var dir = Directory.CreateTempSubdirectory("dragonbane-").FullName;
        var database = Path.Combine(dir, "dragonbane.db");
        await File.WriteAllTextAsync(database, "previous good build");
        try
        {
            await SourceImporter.ImportToFileAsync(database, TestPaths.SourceMaterial, CancellationToken.None);

            await using var connection = new SqliteConnection($"Data Source={database};Mode=ReadOnly");
            await connection.OpenAsync();
            await using var cmd = connection.CreateCommand();
            cmd.CommandText = "SELECT COUNT(*) FROM TreasureEntry";
            Assert.Equal(40L, (long)(await cmd.ExecuteScalarAsync())!);
            Assert.Equal(["dragonbane.db"], Directory.GetFiles(dir).Select(Path.GetFileName));
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            Directory.Delete(dir, recursive: true);
        }
    }

    [Fact]
    public async Task Rebuild_produces_single_self_contained_file()
    {
        var path = Path.Combine(Path.GetTempPath(), $"dragonbane-{Guid.NewGuid():N}.db");
        try
        {
            await using (var db = new DragonbaneDbContext(new DbContextOptionsBuilder<DragonbaneDbContext>().UseSqlite($"Data Source={path}").Options))
                await SourceImporter.RebuildAsync(db, TestPaths.SourceMaterial, CancellationToken.None);
            SqliteConnection.ClearAllPools();

            Assert.False(File.Exists(path + "-wal"));
            Assert.False(File.Exists(path + "-shm"));
            await using var connection = new SqliteConnection($"Data Source={path};Mode=ReadOnly");
            await connection.OpenAsync();
            await using var cmd = connection.CreateCommand();
            cmd.CommandText = "PRAGMA journal_mode";
            Assert.Equal("delete", (string?)await cmd.ExecuteScalarAsync());
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            File.Delete(path);
        }
    }
}
