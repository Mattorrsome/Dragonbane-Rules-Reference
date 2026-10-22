using Dragonbane.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using static Dragonbane.Api.Sections.SearchPattern;

namespace Dragonbane.Api.Sections.Filters;

public sealed record SkillFilter(string? Search, int? TypeId) : ISectionFilter<Skill>
{
    public IQueryable<Skill> Apply(IQueryable<Skill> query)
    {
        if (TypeId is { } typeId) query = query.Where(s => s.SkillTypeId == typeId);
        if (Search is { Length: > 0 } search)
            query = query.Where(s => EF.Functions.Like(s.Name, Contains(search), Escape) || EF.Functions.Like(s.Description, Contains(search), Escape));
        return query;
    }
}

public sealed record HeroicAbilityFilter(string? Search) : ISectionFilter<HeroicAbility>
{
    public IQueryable<HeroicAbility> Apply(IQueryable<HeroicAbility> query) =>
        Search is { Length: > 0 } search
            ? query.Where(h => EF.Functions.Like(h.Name, Contains(search), Escape) || EF.Functions.Like(h.Effect, Contains(search), Escape))
            : query;
}

public sealed record SpellFilter(string? Search, int? SchoolId, int? Rank, SpellKind? Kind) : ISectionFilter<Spell>
{
    public IQueryable<Spell> Apply(IQueryable<Spell> query)
    {
        if (SchoolId is { } schoolId) query = query.Where(s => s.SchoolId == schoolId);
        if (Rank is { } rank) query = query.Where(s => s.Rank == rank);
        if (Kind is { } kind) query = query.Where(s => s.Kind == kind);
        if (Search is { Length: > 0 } search)
            query = query.Where(s => EF.Functions.Like(s.Name, Contains(search), Escape) || EF.Functions.Like(s.Description, Contains(search), Escape));
        return query;
    }
}

public sealed record EquipmentFilter(string? Search, int? CategoryId) : ISectionFilter<EquipmentItem>
{
    public IQueryable<EquipmentItem> Apply(IQueryable<EquipmentItem> query)
    {
        if (CategoryId is { } categoryId) query = query.Where(i => i.CategoryId == categoryId);
        if (Search is { Length: > 0 } search)
            query = query.Where(i => EF.Functions.Like(i.Name, Contains(search), Escape) || EF.Functions.Like(i.Effect, Contains(search), Escape));
        return query;
    }
}

public sealed record TreasureFilter(string? Search) : ISectionFilter<TreasureEntry>
{
    public IQueryable<TreasureEntry> Apply(IQueryable<TreasureEntry> query) =>
        Search is { Length: > 0 } search
            ? query.Where(t => EF.Functions.Like(t.Name, Contains(search), Escape) || EF.Functions.Like(t.EffectText, Contains(search), Escape))
            : query;
}

/// <summary>Name search for lookup sections (skill types, schools, categories, glossaries).</summary>
public sealed record NameFilter<TEntity>(string? Search) : ISectionFilter<TEntity> where TEntity : class, INamedEntity
{
    public IQueryable<TEntity> Apply(IQueryable<TEntity> query) =>
        Search is { Length: > 0 } search ? query.Where(e => EF.Functions.Like(e.Name, Contains(search), Escape)) : query;
}
