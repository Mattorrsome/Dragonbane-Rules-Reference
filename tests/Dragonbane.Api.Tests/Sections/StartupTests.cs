using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Dragonbane.Api.Tests.Sections;

public class StartupTests
{
    [Fact]
    public void Startup_fails_when_database_missing()
    {
        var missing = Path.Combine(Path.GetTempPath(), $"missing-{Guid.NewGuid():N}.db");
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseSetting("Dragonbane:DatabasePath", missing);
            b.UseSetting("Dragonbane:SourceMaterialPath", TestPaths.SourceMaterial);
        });

        var ex = Assert.ThrowsAny<Exception>(() => factory.CreateClient());
        Assert.Contains("-- import", ex.Message);
        Assert.False(File.Exists(missing));
    }
}
