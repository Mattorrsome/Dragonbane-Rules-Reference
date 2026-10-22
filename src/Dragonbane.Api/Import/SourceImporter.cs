using Dragonbane.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Dragonbane.Api.Import;

public static class SourceImporter
{
    /// <summary>Drops and recreates the database, then imports every section from the markdown in dependency order.</summary>
    public static async Task RebuildAsync(DragonbaneDbContext db, string sourceDirectory, CancellationToken ct)
    {
        await db.Database.EnsureDeletedAsync(ct);
        await db.Database.EnsureCreatedAsync(ct);

        IReadOnlyList<MarkdownSection> Read(string file) =>
            MarkdownDocument.Parse(File.ReadAllText(Path.Combine(sourceDirectory, file)));

        var equipment = Read("Dragonbane_Equipment_Tables.md");
        CurrencyImporter.Import(equipment, db);
        EquipmentImporter.Import(equipment, db);
        SkillsImporter.Import(Read("Dragonbane_Skills_Table.md"), db);
        HeroicAbilitiesImporter.Import(Read("Dragonbane_Heroic_Abilities_Table.md"), db);
        SpellsImporter.Import(Read("Dragonbane_Spell_Tables.md"), db);
        TreasureImporter.Import(Read("Dragonbane_Treasure_Table.md"), db);
        db.ChangeTracker.Clear();

        // Leave one self-contained file (no -wal/-shm sidecars) that can be copied to a server and opened read-only.
        await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=DELETE", ct);
        await db.Database.ExecuteSqlRawAsync("VACUUM", ct);
    }
}
