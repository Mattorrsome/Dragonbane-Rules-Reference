using Dragonbane.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Dragonbane.Api.Import;

public static class SourceImporter
{
    /// <summary>
    /// Builds the database next to <paramref name="databasePath"/> and swaps it in only when the whole import succeeds,
    /// so a failed import never leaves a half-built file for the API to serve.
    /// </summary>
    public static async Task ImportToFileAsync(string databasePath, string sourceDirectory, CancellationToken ct)
    {
        var building = databasePath + ".building";
        try
        {
            await using (var db = new DragonbaneDbContext(
                new DbContextOptionsBuilder<DragonbaneDbContext>().UseSqlite($"Data Source={building};Pooling=False").Options))
                await RebuildAsync(db, sourceDirectory, ct);
            File.Move(building, databasePath, overwrite: true);
        }
        finally
        {
            File.Delete(building);
        }
    }

    /// <summary>Drops and recreates the database, then imports every section from the markdown in dependency order.</summary>
    public static async Task RebuildAsync(DragonbaneDbContext db, string sourceDirectory, CancellationToken ct)
    {
        await db.Database.EnsureDeletedAsync(ct);
        await db.Database.EnsureCreatedAsync(ct);

        IReadOnlyList<MarkdownSection> Read(string file) =>
            MarkdownDocument.Parse(File.ReadAllText(Path.Combine(sourceDirectory, file)));

        // Skills first: weapons link to their skill.
        SkillsImporter.Import(Read("Dragonbane_Skills_Table.md"), db);
        var equipment = Read("Dragonbane_Equipment_Tables.md");
        CurrencyImporter.Import(equipment, db);
        EquipmentImporter.Import(equipment, db);
        HeroicAbilitiesImporter.Import(Read("Dragonbane_Heroic_Abilities_Table.md"), db);
        SpellsImporter.Import(Read("Dragonbane_Spell_Tables.md"), db);
        TreasureImporter.Import(Read("Dragonbane_Treasure_Table.md"), db);
        db.ChangeTracker.Clear();

        // Leave one self-contained file (no -wal/-shm sidecars) that can be copied to a server and opened read-only.
        await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=DELETE", ct);
        await db.Database.ExecuteSqlRawAsync("VACUUM", ct);
    }
}
