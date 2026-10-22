using System.Linq.Expressions;
using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Dragonbane.Api.Sections;

/// <summary>A section's response shape, with the EF projection that builds it from the entity.</summary>
public interface ISectionDto<TEntity, TSelf> where TSelf : ISectionDto<TEntity, TSelf>
{
    static abstract Expression<Func<TEntity, TSelf>> Projection { get; }
}

/// <summary>Query-string filter for a section's list route, bound with <c>[AsParameters]</c>.</summary>
public interface ISectionFilter<TEntity>
{
    IQueryable<TEntity> Apply(IQueryable<TEntity> query);
}

public static class SearchPattern
{
    public const string Escape = "\\";

    /// <summary>A LIKE pattern matching <paramref name="term"/> literally anywhere: \, % and _ are escaped.</summary>
    public static string Contains(string term) =>
        "%" + term.Replace(Escape, Escape + Escape).Replace("%", Escape + "%").Replace("_", Escape + "_") + "%";
}

public static class SectionEndpoints
{
    /// <summary>Maps <c>GET /api/{section}</c> (filtered list, by Id) and <c>GET /api/{section}/{id}</c>.</summary>
    public static RouteGroupBuilder MapSection<TEntity, TDto, TFilter>(this IEndpointRouteBuilder app, string section)
        where TEntity : class, IEntity
        where TDto : ISectionDto<TEntity, TDto>
        where TFilter : ISectionFilter<TEntity>
    {
        var group = app.MapGroup($"/api/{section}").WithTags(section);

        group.MapGet("/", async Task<Ok<TDto[]>> ([AsParameters] TFilter filter, DragonbaneDbContext db, CancellationToken ct) =>
            TypedResults.Ok(await filter.Apply(db.Set<TEntity>()).OrderBy(e => e.Id).Select(TDto.Projection).ToArrayAsync(ct)));

        group.MapGet("/{id:int}", async Task<Results<Ok<TDto>, NotFound>> (int id, DragonbaneDbContext db, CancellationToken ct) =>
            await db.Set<TEntity>().Where(e => e.Id == id).Select(TDto.Projection).FirstOrDefaultAsync(ct) is { } dto
                ? TypedResults.Ok(dto)
                : TypedResults.NotFound());

        return group;
    }
}
