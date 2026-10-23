using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Dragonbane.Api.Tests.Sections;

public class SectionEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
    readonly HttpClient _client = factory.CreateClient();

    async Task<JsonElement[]> List(string url) =>
        (await _client.GetFromJsonAsync<JsonElement[]>(url, Json))!;

    async Task<int> IdOf(string section, string name) =>
        (await List($"/api/{section}?search={Uri.EscapeDataString(name)}"))
            .Single(e => e.GetProperty("name").GetString() == name).GetProperty("id").GetInt32();

    static string[] Names(JsonElement[] rows) => rows.Select(r => r.GetProperty("name").GetString()!).ToArray();

    [Theory]
    [InlineData("skills", 42)]
    [InlineData("heroic-abilities", 44)]
    [InlineData("spells", 316)]
    [InlineData("equipment", 157)]
    [InlineData("treasure", 40)]
    [InlineData("magic-schools", 13)]
    public async Task List_returns_all_rows(string section, int count) =>
        Assert.Equal(count, (await List($"/api/{section}")).Length);

    [Fact]
    public async Task Filters_skills_by_type()
    {
        var weapon = await IdOf("skill-types", "Weapon");

        Assert.Equal(10, (await List($"/api/skills?typeId={weapon}")).Length);
    }

    [Fact]
    public async Task Filters_spells_by_school_rank_kind()
    {
        var alchemy = await IdOf("magic-schools", "Alchemy");

        Assert.Equal(38, (await List("/api/spells?kind=Trick")).Length);
        Assert.Equal(33, (await List($"/api/spells?schoolId={alchemy}&kind=Recipe")).Length);
        Assert.Equal(10, (await List("/api/spells?rank=6")).Length);
    }

    [Fact]
    public async Task Filters_equipment_by_category()
    {
        var melee = await IdOf("equipment-categories", "Melee weapons");

        var rows = await List($"/api/equipment?categoryId={melee}");
        Assert.Equal(29, rows.Length);
        Assert.Equal("Unarmed", Names(rows)[0]);
    }

    [Fact]
    public async Task Search_is_case_insensitive()
    {
        Assert.Equal(["Acrobatics"], Names(await List("/api/skills?search=ACRO")));
        Assert.Contains("DISPEL", Names(await List("/api/spells?search=dispel")));
    }

    [Fact]
    public async Task Search_treats_wildcards_literally()
    {
        // Only Bartering's description contains a literal "%" ("improve the price by 20%").
        Assert.Equal(["Bartering"], Names(await List("/api/skills?search=%25")));
        Assert.Empty(await List("/api/skills?search=_"));
        Assert.NotEmpty(await List("/api/heroic-abilities?search=round's"));
    }

    [Fact]
    public async Task Unknown_id_returns_404()
    {
        var response = await _client.GetAsync("/api/spells/99999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Invalid_filter_returns_400() =>
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.GetAsync("/api/spells?rank=abc")).StatusCode);

    [Fact]
    public async Task Get_by_id_returns_typed_dto()
    {
        var dagger = await _client.GetFromJsonAsync<JsonElement>($"/api/equipment/{await IdOf("equipment", "Dagger")}", Json);

        Assert.Equal("Subtle, piercing, slashing, thrown", dagger.GetProperty("weapon").GetProperty("featuresText").GetString());
        Assert.Equal(JsonValueKind.Null, dagger.GetProperty("armour").ValueKind);
    }

    [Fact]
    public async Task Currency_rates_endpoint()
    {
        var rates = await List("/api/currency-rates");

        Assert.Equal([("Copper", 1), ("Silver", 10), ("Gold", 100)],
            rates.Select(r => (r.GetProperty("name").GetString(), r.GetProperty("copperValue").GetInt32())));
    }

    [Fact]
    public async Task Treasure_dto_nests_outcomes()
    {
        var bottle = (await List("/api/treasure")).Single(e => e.GetProperty("roll").GetInt32() == 36);

        var potion = bottle.GetProperty("rolls")[0].GetProperty("outcomes")[5];
        Assert.Equal("healing potion 3D6 HP", potion.GetProperty("label").GetString());
        Assert.Equal(0, potion.GetProperty("rolls").GetArrayLength());
    }

    [Fact]
    public async Task OpenApi_lists_every_section()
    {
        var doc = await _client.GetStringAsync("/openapi/v1.json");

        Assert.Contains("/api/skills/{id}", doc);
        Assert.Contains("/api/currency-rates", doc);
        Assert.Contains("\"Trick\"", doc);
    }

    [Fact]
    public async Task OpenApi_types_integers_as_numbers_only()
    {
        var doc = await _client.GetFromJsonAsync<JsonElement>("/openapi/v1.json");

        var id = doc.GetProperty("components").GetProperty("schemas").GetProperty("SkillDto").GetProperty("properties").GetProperty("id");
        Assert.Equal("integer", id.GetProperty("type").GetString());
    }
}
