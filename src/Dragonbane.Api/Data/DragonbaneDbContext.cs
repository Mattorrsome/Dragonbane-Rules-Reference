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
    public DbSet<Npc> Npcs => Set<Npc>();
    public DbSet<NpcSkill> NpcSkills => Set<NpcSkill>();
    public DbSet<NpcHeroicAbility> NpcHeroicAbilities => Set<NpcHeroicAbility>();
    public DbSet<NpcGear> NpcGear => Set<NpcGear>();
    public DbSet<Kin> Kin => Set<Kin>();
    public DbSet<KinAbility> KinAbilities => Set<KinAbility>();
    public DbSet<KinName> KinNames => Set<KinName>();
    public DbSet<Age> Ages => Set<Age>();
    public DbSet<AgeAdjustment> AgeAdjustments => Set<AgeAdjustment>();
    public DbSet<Memento> Mementos => Set<Memento>();
    public DbSet<Weakness> Weaknesses => Set<Weakness>();
    public DbSet<Appearance> Appearances => Set<Appearance>();
    public DbSet<Profession> Professions => Set<Profession>();
    public DbSet<ProfessionSkill> ProfessionSkills => Set<ProfessionSkill>();
    public DbSet<ProfessionHeroicAbility> ProfessionHeroicAbilities => Set<ProfessionHeroicAbility>();
    public DbSet<ProfessionNickname> ProfessionNicknames => Set<ProfessionNickname>();
    public DbSet<MagicSchoolStartingSkill> MagicSchoolStartingSkills => Set<MagicSchoolStartingSkill>();

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

        model.Entity<Npc>().HasMany(n => n.Skills).WithOne().HasForeignKey(s => s.NpcId);
        model.Entity<Npc>().HasMany(n => n.HeroicAbilities).WithOne().HasForeignKey(a => a.NpcId);
        model.Entity<Npc>().HasMany(n => n.Gear).WithOne().HasForeignKey(g => g.NpcId);
        model.Entity<NpcSkill>().ToTable(t => t.HasCheckConstraint(
            "CK_NpcSkill_OneName", "(\"SkillId\" IS NULL) <> (\"UnlinkedName\" IS NULL)"));
        model.Entity<Npc>().HasIndex(e => e.Name).IsUnique();

        model.Entity<Kin>().HasMany(k => k.Abilities).WithOne().HasForeignKey(a => a.KinId);
        model.Entity<Kin>().HasMany(k => k.Names).WithOne().HasForeignKey(n => n.KinId);
        model.Entity<Age>().HasMany(a => a.Adjustments).WithOne().HasForeignKey(j => j.AgeId);
        model.Entity<Kin>().HasIndex(e => e.Name).IsUnique();
        model.Entity<Age>().HasIndex(e => e.Name).IsUnique();
        model.Entity<Weakness>().HasIndex(e => e.Name).IsUnique();
        model.Entity<KinAbility>().HasIndex(e => new { e.KinId, e.Name }).IsUnique();
        model.Entity<KinName>().HasIndex(e => new { e.KinId, e.Roll }).IsUnique();

        model.Entity<Profession>().HasMany(p => p.Skills).WithOne().HasForeignKey(s => s.ProfessionId);
        model.Entity<Profession>().HasMany(p => p.HeroicAbilities).WithOne().HasForeignKey(a => a.ProfessionId);
        model.Entity<Profession>().HasMany(p => p.Nicknames).WithOne().HasForeignKey(n => n.ProfessionId);
        model.Entity<Profession>().HasIndex(e => e.Name).IsUnique();
        model.Entity<Profession>().HasIndex(e => e.Roll).IsUnique();
        model.Entity<ProfessionSkill>().HasIndex(e => new { e.ProfessionId, e.SkillId }).IsUnique();
        model.Entity<ProfessionHeroicAbility>().HasIndex(e => new { e.ProfessionId, e.HeroicAbilityId }).IsUnique();
        model.Entity<ProfessionNickname>().HasIndex(e => new { e.ProfessionId, e.Roll }).IsUnique();
        model.Entity<MagicSchool>().HasMany(s => s.StartingSkills).WithOne().HasForeignKey(k => k.MagicSchoolId);
        model.Entity<MagicSchool>().HasOne(s => s.Skill).WithMany().HasForeignKey(s => s.SkillId);
        model.Entity<MagicSchool>().HasOne(s => s.RequiredProfession).WithMany().HasForeignKey(s => s.RequiredProfessionId);
        model.Entity<MagicSchool>().HasOne(s => s.RequiredSkill).WithMany().HasForeignKey(s => s.RequiredSkillId);
        model.Entity<MagicSchoolStartingSkill>().HasIndex(e => new { e.MagicSchoolId, e.SkillId }).IsUnique();

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
