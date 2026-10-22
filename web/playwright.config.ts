import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4200', ...devices['Desktop Chrome'] },
  webServer: [
    {
      // Serves the committed dragonbane.db read-only; run `-- import` yourself after changing the markdown.
      command: 'dotnet run --project ../src/Dragonbane.Api',
      url: 'http://localhost:5080/api/currency-rates',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    { command: 'npm start', url: 'http://localhost:4200', reuseExistingServer: true, timeout: 120_000 },
  ],
});
