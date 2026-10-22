using System.Reflection;
using System.Text.Json.Serialization;
using Dragonbane.Api;
using Dragonbane.Api.Data;
using Dragonbane.Api.Data.Entities;
using Dragonbane.Api.Import;
using Dragonbane.Api.Sections;
using Dragonbane.Api.Sections.Dtos;
using Dragonbane.Api.Sections.Filters;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// `dotnet run -- import` rebuilds the database from the markdown, then exits. The API itself never imports.
if (args is ["import", ..])
{
    var paths = builder.Configuration.GetSection("Dragonbane").Get<DragonbaneOptions>()!.Resolve(builder.Environment);
    await using var importDb = new DragonbaneDbContext(
        new DbContextOptionsBuilder<DragonbaneDbContext>().UseSqlite($"Data Source={paths.DatabasePath}").Options);
    await SourceImporter.RebuildAsync(importDb, paths.SourceMaterialPath, CancellationToken.None);
    Console.WriteLine($"Imported {paths.SourceMaterialPath} into {paths.DatabasePath}");
    return;
}

builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    // Web defaults accept numbers as strings, which makes OpenAPI type every int as "integer | string".
    o.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});
builder.Services.Configure<DragonbaneOptions>(builder.Configuration.GetSection("Dragonbane"));
builder.Services.AddDbContext<DragonbaneDbContext>((sp, o) =>
    o.UseSqlite($"Data Source={sp.GetRequiredService<IOptions<DragonbaneOptions>>().Value.Resolve(builder.Environment).DatabasePath};Mode=ReadOnly"));

var app = builder.Build();

// Binding failures (e.g. ?rank=abc) throw BadHttpRequestException in Development; keep their 400.
app.UseExceptionHandler(new ExceptionHandlerOptions
{
    StatusCodeSelector = ex => ex is BadHttpRequestException bad ? bad.StatusCode : StatusCodes.Status500InternalServerError,
});
app.UseStatusCodePages();
app.MapOpenApi();

app.MapSection<Skill, SkillDto, SkillFilter>("skills");
app.MapSection<SkillType, SkillTypeDto, NameFilter<SkillType>>("skill-types");
app.MapSection<HeroicAbility, HeroicAbilityDto, HeroicAbilityFilter>("heroic-abilities");
app.MapSection<Spell, SpellDto, SpellFilter>("spells");
app.MapSection<MagicSchool, MagicSchoolDto, NameFilter<MagicSchool>>("magic-schools");
app.MapSection<EquipmentItem, EquipmentItemDto, EquipmentFilter>("equipment");
app.MapSection<EquipmentCategory, EquipmentCategoryDto, NameFilter<EquipmentCategory>>("equipment-categories");
app.MapSection<Supply, GlossaryDto<Supply>, NameFilter<Supply>>("supplies");
app.MapSection<WeaponTerm, GlossaryDto<WeaponTerm>, NameFilter<WeaponTerm>>("weapon-terms");
app.MapSection<WeaponFeature, GlossaryDto<WeaponFeature>, NameFilter<WeaponFeature>>("weapon-features");
app.MapSection<TreasureEntry, TreasureEntryDto, TreasureFilter>("treasure");

app.MapGet("/api/currency-rates", async (DragonbaneDbContext db, CancellationToken ct) =>
    TypedResults.Ok(await db.CurrencyRates.OrderBy(r => r.CopperValue).Select(r => new CurrencyRateDto(r.Name, r.CopperValue)).ToArrayAsync(ct)))
    .WithTags("currency-rates");

// Fail fast on a missing database. Build-time OpenAPI generation (GetDocument.Insider) needs routes, not data.
var databasePath = app.Services.GetRequiredService<IOptions<DragonbaneOptions>>().Value.Resolve(app.Environment).DatabasePath;
if (Assembly.GetEntryAssembly()?.GetName().Name != "GetDocument.Insider" && !File.Exists(databasePath))
    throw new FileNotFoundException(
        $"Database not found at {databasePath}. Build it with: dotnet run --project src/Dragonbane.Api -- import", databasePath);

app.Run();

public partial class Program;

namespace Dragonbane.Api
{
    public sealed class DragonbaneOptions
    {
        public string SourceMaterialPath { get; set; } = "";
        public string DatabasePath { get; set; } = "";

        /// <summary>Copy with relative paths resolved against the content root.</summary>
        public DragonbaneOptions Resolve(IHostEnvironment env) => new()
        {
            SourceMaterialPath = Path.GetFullPath(SourceMaterialPath, env.ContentRootPath),
            DatabasePath = Path.GetFullPath(DatabasePath, env.ContentRootPath),
        };
    }
}
