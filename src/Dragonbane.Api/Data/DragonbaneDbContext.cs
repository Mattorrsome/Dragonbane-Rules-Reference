using Dragonbane.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Attribute = Dragonbane.Api.Data.Entities.Attribute;

namespace Dragonbane.Api.Data;

public class DragonbaneDbContext(DbContextOptions<DragonbaneDbContext> options) : DbContext(options)
{
    public DbSet<CurrencyRate> CurrencyRates => Set<CurrencyRate>();
    public DbSet<EquipmentCategory> EquipmentCategories => Set<EquipmentCategory>();
    public DbSet<Supply> Supplies => Set<Supply>();
    public DbSet<WeaponTerm> WeaponTerms => Set<WeaponTerm>();
    public DbSet<WeaponFeature> WeaponFeatures => Set<WeaponFeature>();
    public DbSet<DamageType> DamageTypes => Set<DamageType>();
    public DbSet<EquipmentItem> EquipmentItems => Set<EquipmentItem>();
    public DbSet<Weapon> Weapons => Set<Weapon>();
    public DbSet<Armour> Armour => Set<Armour>();
    public DbSet<MagicSchool> MagicSchools => Set<MagicSchool>();
    public DbSet<Requirement> Requirements => Set<Requirement>();
    public DbSet<Spell> Spells => Set<Spell>();
    public DbSet<RankedSpell> RankedSpells => Set<RankedSpell>();
    public DbSet<Recipe> Recipes => Set<Recipe>();
    public DbSet<SkillType> SkillTypes => Set<SkillType>();
    public DbSet<Attribute> Attributes => Set<Attribute>();
    public DbSet<Skill> Skills => Set<Skill>();
    public DbSet<HeroicAbility> HeroicAbilities => Set<HeroicAbility>();
    public DbSet<TreasureEntry> TreasureEntries => Set<TreasureEntry>();
    public DbSet<TreasureRoll> TreasureRolls => Set<TreasureRoll>();
    public DbSet<TreasureOutcome> TreasureOutcomes => Set<TreasureOutcome>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<SpellKind>().HaveConversion<string>();
        configurationBuilder.Properties<RollPurpose>().HaveConversion<string>();
    }

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<EquipmentItem>().UseTptMappingStrategy();
        model.Entity<Spell>().UseTptMappingStrategy();

        model.Entity<Spell>().HasMany(s => s.Requirements).WithMany().UsingEntity("SpellRequirement");
        model.Entity<Weapon>().HasMany(w => w.Features).WithMany().UsingEntity("WeaponWeaponFeature");
        model.Entity<Weapon>().HasMany(w => w.DamageTypes).WithMany().UsingEntity("WeaponDamageType");

        model.Entity<TreasureEntry>().HasIndex(e => e.Roll).IsUnique();
        model.Entity<TreasureEntry>().HasMany(e => e.Rolls).WithOne().HasForeignKey(r => r.EntryId);
        model.Entity<TreasureRoll>().HasMany(r => r.Outcomes).WithOne().HasForeignKey(o => o.RollId);
        model.Entity<TreasureOutcome>().HasMany(o => o.Rolls).WithOne().HasForeignKey(r => r.OutcomeId);
        model.Entity<TreasureOutcome>().HasOne<EquipmentItem>().WithMany().HasForeignKey(o => o.EquipmentItemId);
        model.Entity<TreasureOutcome>().HasOne<MagicSchool>().WithMany().HasForeignKey(o => o.MagicSchoolId);
        model.Entity<TreasureRoll>().ToTable(t => t.HasCheckConstraint(
            "CK_TreasureRoll_OneParent", "(\"EntryId\" IS NULL) <> (\"OutcomeId\" IS NULL)"));

        model.Entity<CurrencyRate>().HasIndex(e => e.Name).IsUnique();
        model.Entity<EquipmentCategory>().HasIndex(e => e.Name).IsUnique();
        model.Entity<Supply>().HasIndex(e => e.Name).IsUnique();
        model.Entity<WeaponTerm>().HasIndex(e => e.Name).IsUnique();
        model.Entity<WeaponFeature>().HasIndex(e => e.Name).IsUnique();
        model.Entity<DamageType>().HasIndex(e => e.Name).IsUnique();
        model.Entity<MagicSchool>().HasIndex(e => e.Name).IsUnique();
        model.Entity<Requirement>().HasIndex(e => e.Name).IsUnique();
        model.Entity<SkillType>().HasIndex(e => e.Name).IsUnique();
        model.Entity<Attribute>().HasIndex(e => e.Code).IsUnique();

        // Table names match class names (Spell, not Spells) so the schema reads like the design.
        // Runs last so the join entities created above are renamed too.
        foreach (var type in model.Model.GetEntityTypes().Where(t => t.ClrType != typeof(Dictionary<string, object>)))
            type.SetTableName(type.ClrType.Name);
    }
}
