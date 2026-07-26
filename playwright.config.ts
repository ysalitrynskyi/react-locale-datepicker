import { defineConfig, devices } from "@playwright/test";

const viewports = [
  { name: "320", width: 320, height: 640 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
] as const;

// Browser matrix required by docs/TESTING.md: Chromium, Firefox and WebKit
// at 320 / 768 / 1280. Each project is one (browser × viewport) pair so a
// failure names both dimensions.
const projects = (["chromium", "firefox", "webkit"] as const).flatMap(
  (browser) =>
    viewports.map((vp) => ({
      name: `${browser}-${vp.name}`,
      use: {
        ...devices[
          browser === "chromium"
            ? "Desktop Chrome"
            : browser === "firefox"
              ? "Desktop Firefox"
              : "Desktop Safari"
        ],
        viewport: { width: vp.width, height: vp.height },
      },
    })),
);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run e2e:harness",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects,
});
