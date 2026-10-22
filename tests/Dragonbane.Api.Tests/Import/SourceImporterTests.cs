using Dragonbane.Api.Data;
using Dragonbane.Api.Import;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Dragonbane.Api.Tests.Import;

public class SourceImporterTests
{
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
