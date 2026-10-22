using System.Text;
using Dragonbane.Api.Import;
using Microsoft.Data.Sqlite;

namespace Dragonbane.Api.Tests.Import;

/// <summary>
/// The committed dragonbane.db is what gets deployed. It must hold exactly what the markdown imports to,
/// so a markdown edit without `dotnet run -- import` fails here instead of shipping stale data.
/// </summary>
public class CommittedDatabaseTests
{
    static readonly string Committed = Path.GetFullPath(
        Path.Combine(TestPaths.SourceMaterial, "..", "src", "Dragonbane.Api", "dragonbane.db"));

    [Fact]
    public async Task Committed_database_matches_a_fresh_import()
    {
        await WithFreshImport(fresh =>
            Assert.True(Dump(Committed) == Dump(fresh),
                "src/Dragonbane.Api/dragonbane.db is out of date with Source Material. Run: dotnet run --project src/Dragonbane.Api -- import"));
    }

    [Fact]
    public async Task Comparison_detects_a_changed_row()
    {
        await WithFreshImport(fresh =>
        {
            var changed = fresh + ".changed";
            File.Copy(fresh, changed);
            try
            {
                using (var connection = new SqliteConnection($"Data Source={changed};Pooling=False"))
                {
                    connection.Open();
                    using var cmd = connection.CreateCommand();
                    cmd.CommandText = "UPDATE Skill SET Description = 'edited' WHERE Id = 1";
                    cmd.ExecuteNonQuery();
                }
                Assert.NotEqual(Dump(fresh), Dump(changed));
            }
            finally
            {
                File.Delete(changed);
            }
        });
    }

    static async Task WithFreshImport(Action<string> check)
    {
        var dir = Directory.CreateTempSubdirectory("dragonbane-").FullName;
        try
        {
            var fresh = Path.Combine(dir, "fresh.db");
            await SourceImporter.ImportToFileAsync(fresh, TestPaths.SourceMaterial, CancellationToken.None);
            check(fresh);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            Directory.Delete(dir, recursive: true);
        }
    }

    /// <summary>Every table's rows as text, in a stable order.</summary>
    static string Dump(string path)
    {
        using var connection = new SqliteConnection($"Data Source={path};Mode=ReadOnly;Pooling=False");
        connection.Open();
        var tables = new List<string>();
        using (var list = connection.CreateCommand())
        {
            list.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name";
            using var reader = list.ExecuteReader();
            while (reader.Read()) tables.Add(reader.GetString(0));
        }

        var dump = new StringBuilder();
        foreach (var table in tables)
        {
            dump.AppendLine($"# {table}");
            using var cmd = connection.CreateCommand();
            cmd.CommandText = $"SELECT * FROM \"{table}\" ORDER BY 1, 2";
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
                dump.AppendLine(string.Join(" | ", Enumerable.Range(0, reader.FieldCount).Select(i => reader.IsDBNull(i) ? "∅" : reader.GetValue(i).ToString())));
        }
        return dump.ToString();
    }
}
