import { defineConfig, devices } from "@playwright/test";

const port = 8099;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx expo start --web --port ${port}`,
    url: `http://localhost:${port}`,
    env: { CI: "1", BROWSER: "none" },
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
